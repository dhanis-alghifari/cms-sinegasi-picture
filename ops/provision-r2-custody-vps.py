"""Fixed R2 custody receiver; stdin secrets, no configuration reads or services."""
import json
import os
import pwd
import re
import resource
import signal
import socket
import stat
import sys

ACCOUNT = "be04d420dc59ae25397156881c1c68ab"
BUCKET = "cms-dashboard-storage"
DESTINATION = "/opt/sinegasi-prod/config/r2.env"
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


def open_child(parent, name, owner, create):
    try:
        return os.open(name, DIRECTORY_FLAGS, dir_fd=parent)
    except FileNotFoundError:
        if not create:
            return None
    os.mkdir(name, 0o700, dir_fd=parent)
    fd = os.open(name, DIRECTORY_FLAGS, dir_fd=parent)
    try:
        os.fchown(fd, owner.pw_uid, owner.pw_gid)
        os.fsync(parent)
        return fd
    except Exception:
        os.close(fd)
        raise


def target_absent(config_fd):
    try:
        os.stat("r2.env", dir_fd=config_fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    raise CustodyError("DESTINATION_EXISTS")


def validate_payload(payload):
    pattern = (b"CLOUDFLARE_R2_ACCOUNT_ID=" + ACCOUNT.encode("ascii")
               + b"\nCLOUDFLARE_R2_BUCKET_NAME=" + BUCKET.encode("ascii")
               + b"\nCLOUDFLARE_R2_ACCESS_KEY_ID=[a-fA-F0-9]{32}"
               + b"\nCLOUDFLARE_R2_SECRET_ACCESS_KEY=[a-fA-F0-9]{64}\n")
    if not isinstance(payload, bytes) or len(payload) > 1024 or not re.fullmatch(pattern, payload):
        raise CustodyError("INVALID_R2_PAYLOAD")


def write_new_file(config_fd, owner, payload):
    # A random, private temporary file is published with link(), which never
    # replaces an existing destination. Cleanup targets only our exact inode.
    name = ".r2-custody-" + os.urandom(16).hex() + ".tmp"
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
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1
                or info.st_size != len(payload)):
            raise CustodyError("UNSAFE_NEW_FILE")
        os.link(name, "r2.env", src_dir_fd=config_fd, dst_dir_fd=config_fd, follow_symlinks=False)
    finally:
        try:
            temporary = os.stat(name, dir_fd=config_fd, follow_symlinks=False)
            if temporary.st_ino == inode and stat.S_ISREG(temporary.st_mode):
                os.unlink(name, dir_fd=config_fd)
        finally:
            os.close(fd)
    os.fsync(config_fd)
    published = os.stat("r2.env", dir_fd=config_fd, follow_symlinks=False)
    if (not stat.S_ISREG(published.st_mode) or published.st_ino != inode
            or published.st_uid != owner.pw_uid or published.st_gid != owner.pw_gid
            or stat.S_IMODE(published.st_mode) != 0o600 or published.st_nlink != 1
            or published.st_size != len(payload)):
        raise CustodyError("PUBLISHED_METADATA_MISMATCH")
    return {
        "status": "R2_CUSTODY_CREATED", "destination": DESTINATION,
        "owner": "ubuntu", "mode": "0600", "directoryMode": "0700",
        "bytes": published.st_size, "nlink": 1, "contentReadBack": False,
        "existingFileOverwritten": False, "temporaryRemoved": True,
    }


def run(action, payload=None):
    if action not in ("inspect", "write"):
        raise CustodyError("INVALID_ACTION")
    owner = require_identity()
    if action == "write":
        validate_payload(payload)
    descriptors = []
    try:
        root_fd = os.open("/", DIRECTORY_FLAGS)
        descriptors.append(root_fd)
        require_directory(root_fd, 0, False)
        opt_fd = os.open("opt", DIRECTORY_FLAGS, dir_fd=root_fd)
        descriptors.append(opt_fd)
        require_directory(opt_fd, 0, False)
        parent = opt_fd
        missing = []
        for name in ("sinegasi-prod", "config"):
            fd = open_child(parent, name, owner, action == "write")
            if fd is None:
                missing.append(name)
                break
            descriptors.append(fd)
            require_directory(fd, owner.pw_uid, True)
            parent = fd
        if not missing:
            target_absent(parent)
        if action == "inspect":
            return {
                "status": "R2_CUSTODY_DESTINATION_READY", "destination": DESTINATION,
                "owner": "ubuntu", "destinationAbsent": True,
                "privateParentsReady": not missing, "directoryCreationRequired": bool(missing),
                "configurationContentsRead": False,
            }
        return write_new_file(parent, owner, payload)
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


def main():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.umask(0o077)
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(CustodyError("TIMEOUT")))
    signal.alarm(30)
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("inspect", "write"):
            raise CustodyError("INVALID_ACTION")
        action = sys.argv[1]
        payload = sys.stdin.buffer.read(1025) if action == "write" else None
        result = run(action, payload)
        signal.alarm(0)
        print(json.dumps(result))
    except Exception as error:
        # No raw exceptions, traceback, input, environment or credentials.
        code = str(error) if isinstance(error, CustodyError) else "R2_CUSTODY_RECEIVER_FAILED"
        print(json.dumps({"status": "R2_CUSTODY_FAILED", "code": code,
                          "automaticRetryAllowed": False, "destinationMayExist": True}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
