"""Fixed inactive backend custody: stdin keys, private VPS JWT, no config reads."""
import base64
import json
import os
import pwd
import re
import resource
import signal
import socket
import stat
import sys
import time

PROJECT = "pvbdiftvzoeelibxlxzb"
DESTINATION = "/opt/sinegasi-prod/config/backend.env"
FIXED_ENV = {
    "ENV_FILE_LOADING": "disabled", "NODE_ENV": "production", "PUBLIC_DEPLOYMENT": "true",
    "HOST": "0.0.0.0", "PORT": "5001", "CORS_ORIGINS": "https://sinegasi.pictures",
    "ALLOW_DEV_AUTH": "false", "BACKGROUND_JOBS_ENABLED": "false", "NTFY_ENABLED": "false",
    "TRUST_PROXY": "0", "SUPABASE_URL": "https://" + PROJECT + ".supabase.co",
    "CLOUDFLARE_R2_ACCOUNT_ID": "be04d420dc59ae25397156881c1c68ab",
    "CLOUDFLARE_R2_BUCKET_NAME": "cms-dashboard-storage",
    "CLOUDFLARE_R2_PUBLIC_DOMAIN": "", "R2_PUBLIC_DOMAIN": "", "PRODUCTION_MEDIA_PUBLIC_DOMAIN": "",
}
DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
FILE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC


class CustodyError(Exception):
    pass


def require_identity():
    owner = pwd.getpwnam("ubuntu")
    if (os.geteuid() != 0 or os.environ.get("SUDO_USER") != "ubuntu"
            or os.environ.get("SUDO_UID") != "1000" or owner.pw_uid != 1000
            or socket.gethostname() != "VM-11-154-ubuntu"):
        raise CustodyError("WRONG_VPS_IDENTITY")
    return owner


def require_directory(fd, uid, private):
    info = os.fstat(fd)
    mode = stat.S_IMODE(info.st_mode)
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != uid
            or (private and mode != 0o700) or (not private and mode & 0o022)):
        raise CustodyError("UNSAFE_DIRECTORY")


def r2_metadata(config_fd, owner):
    info = os.stat("r2.env", dir_fd=config_fd, follow_symlinks=False)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != owner.pw_uid
            or info.st_gid != owner.pw_gid or stat.S_IMODE(info.st_mode) != 0o600
            or info.st_nlink != 1 or info.st_size != 264):
        raise CustodyError("R2_CUSTODY_METADATA_INVALID")
    return (info.st_dev, info.st_ino, info.st_uid, info.st_gid, info.st_mode, info.st_nlink, info.st_size)


def target_absent(config_fd):
    try:
        os.stat("backend.env", dir_fd=config_fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    raise CustodyError("DESTINATION_EXISTS")


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise CustodyError("INVALID_BACKEND_PAYLOAD")
        value[key] = item
    return value


def validate_payload(payload):
    if not isinstance(payload, bytes) or not 1 <= len(payload) <= 8192:
        raise CustodyError("INVALID_BACKEND_PAYLOAD")
    try:
        value = json.loads(payload.decode("ascii"), object_pairs_hook=unique_object)
        if (not isinstance(value, dict) or set(value) != {"supabaseKey", "r2AccessKeyId", "r2SecretAccessKey"}
                or any(not isinstance(item, str) for item in value.values())):
            raise ValueError()
        if (not re.fullmatch(r"[a-fA-F0-9]{32}", value["r2AccessKeyId"])
                or not re.fullmatch(r"[a-fA-F0-9]{64}", value["r2SecretAccessKey"])):
            raise ValueError()
        key = value["supabaseKey"]
        if re.fullmatch(r"sb_secret_[A-Za-z0-9_-]{16,128}", key):
            return value
        if len(key) > 4096 or not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", key):
            raise ValueError()
        encoded = key.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf8"),
                            object_pairs_hook=unique_object)
        if (not isinstance(claims, dict) or claims.get("ref") != PROJECT or claims.get("role") != "service_role"
                or type(claims.get("exp")) is not int or claims["exp"] > 9007199254740991
                or claims["exp"] <= time.time()):
            raise ValueError()
        return value
    except Exception:
        # Format/role guard, NOT verification of authenticity or modern-key project binding.
        raise CustodyError("INVALID_BACKEND_PAYLOAD") from None


def backend_environment(values):
    # Called only after filesystem guards pass; no JWT returned in a receipt.
    jwt_secret = os.urandom(64).hex()
    lines = [key + "=" + value for key, value in FIXED_ENV.items()]
    lines.extend(["SUPABASE_SERVICE_ROLE_KEY=" + values["supabaseKey"], "JWT_SECRET=" + jwt_secret,
                  "CLOUDFLARE_R2_ACCESS_KEY_ID=" + values["r2AccessKeyId"],
                  "CLOUDFLARE_R2_SECRET_ACCESS_KEY=" + values["r2SecretAccessKey"]])
    return ("\n".join(lines) + "\n").encode("ascii")


def write_new_file(config_fd, owner, payload):
    name = ".backend-custody-" + os.urandom(16).hex() + ".tmp"
    fd = os.open(name, FILE_FLAGS, 0o600, dir_fd=config_fd)
    inode = os.fstat(fd).st_ino
    try:
        os.fchown(fd, owner.pw_uid, owner.pw_gid)
        written = 0
        while written < len(payload):
            count = os.write(fd, payload[written:])
            if count <= 0:
                raise CustodyError("INCOMPLETE_WRITE")
            written += count
        os.fsync(fd)
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != owner.pw_uid
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1 or info.st_size != len(payload)):
            raise CustodyError("UNSAFE_NEW_FILE")
        os.link(name, "backend.env", src_dir_fd=config_fd, dst_dir_fd=config_fd, follow_symlinks=False)
    finally:
        try:
            temporary = os.stat(name, dir_fd=config_fd, follow_symlinks=False)
            if temporary.st_ino == inode and stat.S_ISREG(temporary.st_mode):
                os.unlink(name, dir_fd=config_fd)
        finally:
            os.close(fd)
    os.fsync(config_fd)
    published = os.stat("backend.env", dir_fd=config_fd, follow_symlinks=False)
    if (not stat.S_ISREG(published.st_mode) or published.st_ino != inode
            or published.st_uid != owner.pw_uid or published.st_gid != owner.pw_gid
            or stat.S_IMODE(published.st_mode) != 0o600 or published.st_nlink != 1 or published.st_size != len(payload)):
        raise CustodyError("PUBLISHED_METADATA_MISMATCH")
    return {
        "status": "BACKEND_CUSTODY_CREATED", "destination": DESTINATION, "owner": "ubuntu",
        "mode": "0600", "directoryMode": "0700", "bytes": published.st_size, "nlink": 1,
        "contentReadBack": False, "existingFileOverwritten": False, "temporaryRemoved": True,
        "appJwtGenerated": True, "appJwtRandomBytes": 64, "r2CustodyMetadataUnchanged": True,
        "managedSupabaseSigningKeyChanged": False,
    }


def run(action, payload=None):
    if action not in ("inspect", "write"):
        raise CustodyError("INVALID_ACTION")
    owner = require_identity()
    values = validate_payload(payload) if action == "write" else None
    descriptors = []
    try:
        root_fd = os.open("/", DIRECTORY_FLAGS)
        descriptors.append(root_fd)
        require_directory(root_fd, 0, False)
        parent = root_fd
        for name, uid, private in [("opt", 0, False), ("sinegasi-prod", owner.pw_uid, True), ("config", owner.pw_uid, True)]:
            fd = os.open(name, DIRECTORY_FLAGS, dir_fd=parent)
            descriptors.append(fd)
            require_directory(fd, uid, private)
            parent = fd
        target_absent(parent)
        existing_r2 = r2_metadata(parent, owner)
        if action == "inspect":
            return {
                "status": "BACKEND_CUSTODY_DESTINATION_READY", "destination": DESTINATION, "owner": "ubuntu",
                "destinationAbsent": True, "privateParentsReady": True, "r2CustodyMetadataVerified": True,
                "configurationContentsRead": False,
            }
        result = write_new_file(parent, owner, backend_environment(values))
        if r2_metadata(parent, owner) != existing_r2:
            raise CustodyError("R2_CUSTODY_METADATA_CHANGED")
        return result
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


def timeout(*_):
    raise CustodyError("TIMEOUT")


def main():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.umask(0o077)
    signal.signal(signal.SIGALRM, timeout)
    signal.alarm(30)
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("inspect", "write"):
            raise CustodyError("INVALID_ACTION")
        action = sys.argv[1]
        result = run(action, sys.stdin.buffer.read(8193) if action == "write" else None)
        signal.alarm(0)
        print(json.dumps(result))
    except Exception as error:
        code = str(error) if isinstance(error, CustodyError) else "BACKEND_CUSTODY_RECEIVER_FAILED"
        print(json.dumps({"status": "BACKEND_CUSTODY_FAILED", "code": code,
                          "automaticRetryAllowed": False, "destinationMayExist": True}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
