"""No real filesystem mutation, sudo, SSH, credentials or network in these tests."""
import importlib.util
import os
from pathlib import Path
import stat
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("receiver", Path(__file__).with_name("provision-r2-custody-vps.py"))
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)
OWNER = types.SimpleNamespace(pw_uid=1000, pw_gid=1000)
PAYLOAD = (b"CLOUDFLARE_R2_ACCOUNT_ID=" + receiver.ACCOUNT.encode()
           + b"\nCLOUDFLARE_R2_BUCKET_NAME=" + receiver.BUCKET.encode()
           + b"\nCLOUDFLARE_R2_ACCESS_KEY_ID=" + b"1" * 32
           + b"\nCLOUDFLARE_R2_SECRET_ACCESS_KEY=" + b"2" * 64 + b"\n")


class MemoryOs:
    def __init__(self):
        self.nodes = {}
        self.fds = {}
        self.mutations = []
        self.closed = []
        self.chunk = 1024
        self.race = False
        self.fail_after_publish = False
        self.add("/", stat.S_IFDIR | 0o755, 0)
        self.add("/opt", stat.S_IFDIR | 0o755, 0)

    def add(self, path, mode, uid):
        self.nodes[path] = types.SimpleNamespace(st_mode=mode, st_uid=uid, st_gid=uid,
                                                st_ino=len(self.nodes) + 100, st_nlink=1, st_size=0, data=b"")

    def path(self, name, fd=None):
        if fd is None:
            return name
        return self.fds[fd][0].rstrip("/") + "/" + name

    def open(self, name, flags, mode=None, dir_fd=None):
        path = self.path(name, dir_fd)
        node = self.nodes.get(path)
        if node and flags & os.O_EXCL:
            raise FileExistsError()
        if node and stat.S_ISLNK(node.st_mode) and flags & os.O_NOFOLLOW:
            raise OSError()
        if not node:
            if not flags & os.O_CREAT:
                raise FileNotFoundError()
            self.add(path, stat.S_IFREG | mode, 0)
            node = self.nodes[path]
            self.mutations.append(("create", path))
        if flags & os.O_DIRECTORY and not stat.S_ISDIR(node.st_mode):
            raise NotADirectoryError()
        fd = max(self.fds, default=10) + 1
        self.fds[fd] = (path, node)
        return fd

    def fstat(self, fd):
        return self.fds[fd][1]

    def stat(self, name, dir_fd, follow_symlinks):
        assert follow_symlinks is False
        path = self.path(name, dir_fd)
        if path not in self.nodes:
            raise FileNotFoundError()
        return self.nodes[path]

    def mkdir(self, name, mode, dir_fd):
        path = self.path(name, dir_fd)
        if path in self.nodes:
            raise FileExistsError()
        self.add(path, stat.S_IFDIR | mode, 0)
        self.mutations.append(("mkdir", path))

    def fchown(self, fd, uid, gid):
        self.fstat(fd).st_uid = uid
        self.fstat(fd).st_gid = gid
        self.mutations.append(("chown", self.fds[fd][0]))

    def write(self, fd, data):
        count = min(len(data), self.chunk)
        node = self.fstat(fd)
        node.data += data[:count]
        node.st_size = len(node.data)
        return count

    def fsync(self, fd):
        if self.fail_after_publish and receiver.DESTINATION in self.nodes:
            raise OSError()

    def link(self, name, target, src_dir_fd, dst_dir_fd, follow_symlinks):
        assert follow_symlinks is False
        path = self.path(target, dst_dir_fd)
        if self.race:
            self.add(path, stat.S_IFREG | 0o600, 1000)
        if path in self.nodes:
            raise FileExistsError()
        node = self.nodes[self.path(name, src_dir_fd)]
        self.nodes[path] = node
        node.st_nlink += 1
        self.mutations.append(("publish", path))

    def unlink(self, name, dir_fd):
        path = self.path(name, dir_fd)
        self.nodes.pop(path).st_nlink -= 1
        self.mutations.append(("remove_temporary", path))

    def close(self, fd):
        self.closed.append(fd)

    def urandom(self, size):
        return b"\x11" * size


class ReceiverTests(unittest.TestCase):
    def invoke(self, memory, action, payload=None):
        with patch.object(receiver, "require_identity", return_value=OWNER):
            with patch.multiple(receiver.os, **{name: getattr(memory, name) for name in
                               ["open", "fstat", "stat", "mkdir", "fchown", "write", "fsync", "link", "unlink", "close", "urandom"]}):
                return receiver.run(action, payload)

    def parents(self, memory):
        memory.add("/opt/sinegasi-prod", stat.S_IFDIR | 0o700, 1000)
        memory.add("/opt/sinegasi-prod/config", stat.S_IFDIR | 0o700, 1000)

    def test_missing_directory_inspection_never_writes(self):
        memory = MemoryOs()
        result = self.invoke(memory, "inspect")
        self.assertTrue(result["directoryCreationRequired"])
        self.assertFalse(result["configurationContentsRead"])
        self.assertEqual(memory.mutations, [])

    def test_safe_existing_parents(self):
        memory = MemoryOs()
        self.parents(memory)
        self.assertTrue(self.invoke(memory, "inspect")["privateParentsReady"])
        self.assertEqual(memory.mutations, [])

    def test_unsafe_owner_permissions_symlink_or_parent(self):
        for path, mode, uid in [("/opt/sinegasi-prod", stat.S_IFDIR | 0o700, 0),
                                ("/opt/sinegasi-prod", stat.S_IFDIR | 0o755, 1000),
                                ("/opt/sinegasi-prod/config", stat.S_IFLNK | 0o777, 1000),
                                ("/opt", stat.S_IFDIR | 0o777, 0)]:
            memory = MemoryOs()
            self.parents(memory)
            memory.add(path, mode, uid)
            with self.assertRaises(Exception):
                self.invoke(memory, "inspect")
            self.assertEqual(memory.mutations, [])

    def test_existing_file_or_dangling_symlink_never_overwritten(self):
        for mode in [stat.S_IFREG | 0o600, stat.S_IFLNK | 0o777]:
            memory = MemoryOs()
            self.parents(memory)
            memory.add(receiver.DESTINATION, mode, 1000)
            original = memory.nodes[receiver.DESTINATION]
            with self.assertRaises(receiver.CustodyError):
                self.invoke(memory, "write", PAYLOAD)
            self.assertIs(memory.nodes[receiver.DESTINATION], original)
            self.assertEqual(memory.mutations, [])

    def test_atomic_publish_exact_payload_owner_mode_no_read(self):
        memory = MemoryOs()
        result = self.invoke(memory, "write", PAYLOAD)
        node = memory.nodes[receiver.DESTINATION]
        self.assertEqual(node.data, PAYLOAD)
        self.assertEqual((node.st_uid, node.st_gid, stat.S_IMODE(node.st_mode), node.st_nlink), (1000, 1000, 0o600, 1))
        self.assertEqual(result["bytes"], len(PAYLOAD))
        self.assertTrue(result["temporaryRemoved"])
        self.assertFalse(result["contentReadBack"])
        self.assertFalse(any(".tmp" in path for path in memory.nodes))
        self.assertEqual(len(memory.fds), len(memory.closed))

    def test_malformed_payload_before_any_creation(self):
        for payload in [None, PAYLOAD + b"JWT_SECRET=bad\n", PAYLOAD.replace(b"cms-dashboard-storage", b"cms-dashboard-storage-dev"),
                        PAYLOAD.replace(b"1" * 32, b"z" * 32), PAYLOAD + b"\n", b"x" * 1025]:
            memory = MemoryOs()
            with self.assertRaises(receiver.CustodyError):
                self.invoke(memory, "write", payload)
            self.assertEqual(memory.mutations, [])

    def test_partial_writes_complete(self):
        memory = MemoryOs()
        memory.chunk = 17
        self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(memory.nodes[receiver.DESTINATION].data, PAYLOAD)

    def test_zero_write_cleans_only_own_temporary(self):
        memory = MemoryOs()
        memory.chunk = 0
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertNotIn(receiver.DESTINATION, memory.nodes)
        self.assertFalse(any(".tmp" in path for path in memory.nodes))

    def test_competing_destination_cannot_be_replaced(self):
        memory = MemoryOs()
        memory.race = True
        with self.assertRaises(FileExistsError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(memory.nodes[receiver.DESTINATION].data, b"")
        self.assertFalse(any(".tmp" in path for path in memory.nodes))

    def test_failure_after_publish_preserves_destination_and_forbids_replay(self):
        memory = MemoryOs()
        memory.fail_after_publish = True
        with self.assertRaises(OSError):
            self.invoke(memory, "write", PAYLOAD)
        self.assertEqual(memory.nodes[receiver.DESTINATION].data, PAYLOAD)
        memory.fail_after_publish = False
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "write", PAYLOAD)

    def test_invalid_action_never_mutates(self):
        memory = MemoryOs()
        with self.assertRaises(receiver.CustodyError):
            self.invoke(memory, "overwrite", PAYLOAD)
        self.assertEqual(memory.mutations, [])

    def test_wrong_host_or_privileged_identity(self):
        with patch.object(receiver.pwd, "getpwnam", return_value=OWNER):
            with patch.object(receiver.socket, "gethostname", return_value="wrong-host"):
                with self.assertRaises(receiver.CustodyError):
                    receiver.require_identity()


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ReceiverTests)
    result = unittest.TextTestRunner(verbosity=0).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    print("R2_RECEIVER_IN_MEMORY_TESTS_PASSED " + str(result.testsRun))
