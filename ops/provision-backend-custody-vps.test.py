"""Offline in-memory receiver tests; no real secrets or VPS filesystem access."""
import base64
import importlib.util
import json
from pathlib import Path
import stat
import unittest
from unittest.mock import patch


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


receiver = load("backend_receiver", "provision-backend-custody-vps.py")
fixtures = load("r2_receiver_fixtures", "provision-r2-custody-vps.test.py")
OWNER = fixtures.OWNER
VALUES = {"supabaseKey": "sb_secret_" + "synthetic" * 4, "r2AccessKeyId": "1" * 32, "r2SecretAccessKey": "2" * 64}
PAYLOAD = json.dumps(VALUES).encode("ascii")


class MemoryOs(fixtures.MemoryOs):
    def __init__(self):
        super().__init__()
        self.add("/opt/sinegasi-prod", stat.S_IFDIR | 0o700, 1000)
        self.add("/opt/sinegasi-prod/config", stat.S_IFDIR | 0o700, 1000)
        self.add("/opt/sinegasi-prod/config/r2.env", stat.S_IFREG | 0o600, 1000)
        for node in self.nodes.values():
            node.st_dev = 1
        self.nodes["/opt/sinegasi-prod/config/r2.env"].st_size = 264
        self.random_sizes = []

    def urandom(self, size):
        self.random_sizes.append(size)
        return b"\x11" * size

    def fsync(self, fd):
        if self.fail_after_publish and receiver.DESTINATION in self.nodes:
            raise OSError()


class BackendReceiverTests(unittest.TestCase):
    def invoke(self, memory, action, payload=None):
        with patch.object(receiver, "require_identity", return_value=OWNER):
            with patch.multiple(receiver.os, **{name: getattr(memory, name) for name in
                               ["open", "fstat", "stat", "fchown", "write", "fsync", "link", "unlink", "close", "urandom"]}):
                return receiver.run(action, payload)

    def test_inspection_never_reads_files_or_generates_jwt(self):
        memory = MemoryOs()
        result = self.invoke(memory, "inspect")
        self.assertTrue(result["r2CustodyMetadataVerified"])
        self.assertFalse(result["configurationContentsRead"])
        self.assertEqual(memory.mutations, [])
        self.assertEqual(memory.random_sizes, [])
        self.assertEqual(len(memory.fds), len(memory.closed))

    def test_missing_unsafe_or_symlink_parents_fail_without_creation(self):
        for path, mode, uid in [("/opt/sinegasi-prod", None, 0),
                                ("/opt/sinegasi-prod", stat.S_IFDIR | 0o755, 1000),
                                ("/opt/sinegasi-prod/config", stat.S_IFDIR | 0o700, 0),
                                ("/opt/sinegasi-prod/config", stat.S_IFLNK | 0o777, 1000),
                                ("/opt", stat.S_IFDIR | 0o777, 0)]:
            memory = MemoryOs()
            if mode is None:
                memory.nodes.pop(path)
            else:
                memory.add(path, mode, uid)
            with self.assertRaises(Exception):
                self.invoke(memory, "write", PAYLOAD)
            self.assertEqual(memory.mutations, [])
            self.assertEqual(memory.random_sizes, [])

    def test_r2_metadata_required_without_reading_it(self):
        for mutation in ["missing", "symlink", "permissions", "owner", "gid", "size", "hardlink"]:
            memory = MemoryOs()
            node = memory.nodes["/opt/sinegasi-prod/config/r2.env"]
            if mutation == "missing":
                memory.nodes.pop("/opt/sinegasi-prod/config/r2.env")
            elif mutation == "symlink":
                node.st_mode = stat.S_IFLNK | 0o777
            elif mutation == "permissions":
                node.st_mode = stat.S_IFREG | 0o644
            elif mutation == "owner":
                node.st_uid = 0
            elif mutation == "gid":
                node.st_gid = 0
            elif mutation == "size":
                node.st_size = 1
            else:
                node.st_nlink = 2
            with self.assertRaises(Exception):
                self.invoke(memory, "write", PAYLOAD)
            self.assertEqual(memory.mutations, [])
            self.assertEqual(memory.random_sizes, [])

    def test_existing_backend_or_dangling_symlink_blocks_jwt_and_overwrite(self):
        for mode in [stat.S_IFREG | 0o600, stat.S_IFLNK | 0o777]:
            memory = MemoryOs()
            memory.add(receiver.DESTINATION, mode, 1000)
            original = memory.nodes[receiver.DESTINATION]
            with self.assertRaises(receiver.CustodyError):
                self.invoke(memory, "write", PAYLOAD)
            self.assertIs(memory.nodes[receiver.DESTINATION], original)
            self.assertEqual(memory.mutations, [])
            self.assertEqual(memory.random_sizes, [])

    def test_payload_blocks_extra_fields_and_injection_before_mutation(self):
        cases = [None, b"x" * 8193, b"{}", b"[]", PAYLOAD + b"\nDATABASE_URL=bad",
                 PAYLOAD[:-1] + b', "supabaseKey": "duplicate"}',
                 json.dumps({**VALUES, "jwtSecret": "not permitted"}).encode(),
                 json.dumps({**VALUES, "supabaseKey": "sb_publishable_" + "x" * 32}).encode(),
                 json.dumps({**VALUES, "supabaseKey": VALUES["supabaseKey"] + "\nJWT_SECRET=bad"}).encode(),
                 json.dumps({**VALUES, "r2AccessKeyId": "g" * 32}).encode(),
                 json.dumps({**VALUES, "r2SecretAccessKey": None}).encode()]
        for payload in cases:
            memory = MemoryOs()
            with self.assertRaises(receiver.CustodyError):
                self.invoke(memory, "write", payload)
            self.assertEqual(memory.mutations, [])
            self.assertEqual(memory.random_sizes, [])

    def test_legacy_claims_wrong_project_role_expiry_are_rejected(self):
        def legacy(claims):
            encoded = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
            return "eyJhbGciOiJIUzI1NiJ9." + encoded + ".c3ludGhldGlj"
        claims = {"ref": receiver.PROJECT, "role": "service_role", "exp": 4102444800}
        for changes in [{"ref": "wrong-project"}, {"role": "anon"}, {"exp": 1}, {"exp": "4102444800"}, {"exp": True}]:
            with self.assertRaises(receiver.CustodyError):
                receiver.validate_payload(json.dumps({**VALUES, "supabaseKey": legacy({**claims, **changes})}).encode())
        valid = json.dumps({**VALUES, "supabaseKey": legacy(claims)}).encode()
        self.assertEqual(receiver.validate_payload(valid)["supabaseKey"], legacy(claims))

    def test_new_file_exact_environment_single_private_jwt_and_r2_unchanged(self):
        memory = MemoryOs()
        old_r2 = vars(memory.nodes["/opt/sinegasi-prod/config/r2.env"]).copy()
        result = self.invoke(memory, "write", PAYLOAD)
        node = memory.nodes[receiver.DESTINATION]
        environment = dict(line.split("=", 1) for line in node.data.decode().splitlines())
        self.assertEqual(len(environment), len(receiver.FIXED_ENV) + 4)
        self.assertEqual({key: environment[key] for key in receiver.FIXED_ENV}, receiver.FIXED_ENV)
        self.assertEqual(environment["SUPABASE_SERVICE_ROLE_KEY"], VALUES["supabaseKey"])
        self.assertEqual(environment["JWT_SECRET"], "11" * 64)
        self.assertEqual(environment["CLOUDFLARE_R2_ACCESS_KEY_ID"], VALUES["r2AccessKeyId"])
        self.assertEqual(environment["CLOUDFLARE_R2_SECRET_ACCESS_KEY"], VALUES["r2SecretAccessKey"])
        self.assertEqual(memory.random_sizes.count(64), 1)
        self.assertEqual(vars(memory.nodes["/opt/sinegasi-prod/config/r2.env"]), old_r2)
        self.assertEqual((node.st_uid, node.st_gid, stat.S_IMODE(node.st_mode), node.st_nlink), (1000, 1000, 0o600, 1))
        self.assertEqual(result["bytes"], len(node.data))
        self.assertNotIn("sb_secret_", json.dumps(result))
        self.assertNotIn("11" * 64, json.dumps(result))
        self.assertFalse(any(".tmp" in path for path in memory.nodes))
        self.assertFalse(any(key in environment for key in ["DATABASE_URL", "VITE_API_URL", "SUPABASE_JWT_SECRET"]))
        self.assertEqual(len(memory.fds), len(memory.closed))

    def test_partial_writes_complete_and_zero_write_preserves_existing_files(self):
        memory = MemoryOs()
        memory.chunk = 13
        result = self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(result["bytes"], len(memory.nodes[receiver.DESTINATION].data))
        memory = MemoryOs()
        memory.chunk = 0
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertNotIn(receiver.DESTINATION, memory.nodes)
        self.assertFalse(any(".tmp" in path for path in memory.nodes))
        self.assertIn("/opt/sinegasi-prod/config/r2.env", memory.nodes)

    def test_racing_destination_never_overwritten(self):
        memory = MemoryOs()
        memory.race = True
        with self.assertRaises(FileExistsError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(memory.nodes[receiver.DESTINATION].data, b"")
        self.assertFalse(any(".tmp" in path for path in memory.nodes))

    def test_failure_after_publish_preserves_file_and_replay_generates_no_jwt(self):
        memory = MemoryOs()
        memory.fail_after_publish = True
        with self.assertRaises(OSError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertIn(receiver.DESTINATION, memory.nodes)
        memory.fail_after_publish = False
        before = memory.random_sizes.copy()
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(memory.random_sizes, before)

    def test_invalid_action_and_wrong_identity(self):
        memory = MemoryOs()
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "overwrite", PAYLOAD)
        self.assertEqual(memory.mutations, [])
        with patch.object(receiver.pwd, "getpwnam", return_value=OWNER):
            with patch.object(receiver.socket, "gethostname", return_value="wrong-host"):
                with self.assertRaises(receiver.CustodyError):
                    receiver.require_identity()


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=0).run(unittest.defaultTestLoader.loadTestsFromTestCase(BackendReceiverTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    print("BACKEND_RECEIVER_IN_MEMORY_TESTS_PASSED " + str(result.testsRun))
    # Non-secret fixed fields only, to assert the TypeScript/Python contract matches.
    print("FIXED_ENVIRONMENT " + json.dumps(receiver.FIXED_ENV))
