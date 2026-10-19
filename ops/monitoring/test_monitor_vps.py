"""Offline tests only: fixture subprocesses, private temporary directories."""

import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("monitor_vps", Path(__file__).with_name("monitor_vps.py"))
monitor = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(monitor)

NOW = 1792400000.0
ACTOR = "4df37e50-82ed-4cad-85dc-c5dfcd3641f8"
EVENT = "eb0bf7a7-3e23-42ce-842c-80bc8a3df07a"
REQUEST = "f22e67eb-a43b-4db3-af94-72ba3ba7ea88"
CONTAINER = "a" * 64


def result(value=b"", ok=True, limited=False):
    return {"ok": ok, "stdout": value, "stderr": b"", "limited": limited}


def line(raw, epoch=NOW - 10):
    instant = monitor.dt.datetime.fromtimestamp(epoch, monitor.UTC).isoformat().replace("+00:00", "Z")
    return instant.encode() + b" " + json.dumps(raw).encode() + b"\n"


def completion(**extra):
    return {"msg": "request completed", "requestId": REQUEST, "method": "GET", "route": "/api/students/:id", "statusCode": 200, "durationMs": 12.5, **extra}


def structured(event="monitoring.login", **extra):
    return {"event": event, "eventId": EVENT, "requestId": REQUEST, "method": "POST", "route": "/api/auth/login", "statusCode": 401, "outcome": "invalid_credentials", **extra}


class LogParsingTests(unittest.TestCase):
    def test_no_sensitive_fields_or_dynamic_paths_persist(self):
        payload = completion(route="/api/students/secret-name?password=bad", password="super-secret", token="secret-token", ip="1.2.3.4", username="student-name", err={"stack": "sensitive"})
        events, counts = monitor.parse_logs(line(payload), CONTAINER, NOW)
        encoded = json.dumps(events)
        for sensitive in ("secret-name", "password", "super-secret", "token", "1.2.3.4", "student-name", "stack"):
            self.assertNotIn(sensitive, encoded)
        self.assertEqual(events[0]["route"], "/api/students/*")
        self.assertEqual(counts["invalid"], 0)

    def test_automatic_duplicate_is_ignored(self):
        automatic = {"msg": "request completed", "res": {"statusCode": 200}, "responseTime": 1}
        events, counts = monitor.parse_logs(line(completion()) + line(automatic) + b"\n", CONTAINER, NOW)
        self.assertEqual(len(events), 1)
        self.assertEqual(counts["ignored"], 1)
        self.assertEqual(counts["invalid"], 0)

    def test_health_omitted_from_traffic_and_no_online_claim(self):
        events, _ = monitor.parse_logs(line(completion(route="/api/health")), CONTAINER, NOW)
        report = "\n".join(monitor.render_events({"events": events, "collections": [{"time": NOW, "since": NOW - 3600, "status": "observed"}]}, NOW))
        self.assertIn("0 request TERCATAT", report)
        self.assertIn("BUKAN bukti sedang online", report)

    def test_structured_id_actor_uuid_and_invalid_credentials(self):
        raw = structured(outcome="success", actorId=ACTOR, statusCode=200)
        events, _ = monitor.parse_logs(line(raw), CONTAINER, NOW)
        self.assertEqual(events[0]["id"], "event:" + EVENT)
        self.assertEqual(events[0]["actorId"], ACTOR)
        raw["outcome"] = "invalid_credentials"
        events, _ = monitor.parse_logs(line(raw), CONTAINER, NOW)
        self.assertNotIn("actorId", events[0])

    def test_failed_login_username_cannot_become_actor(self):
        events, _ = monitor.parse_logs(line(structured(actorId="admin", username="admin")), CONTAINER, NOW)
        self.assertNotIn("actorId", events[0])

    def test_same_timestamp_distinct_payload_restart_and_occurrences(self):
        repeated = line(completion())
        events, _ = monitor.parse_logs(repeated + repeated + line(completion(statusCode=500)), CONTAINER, NOW)
        self.assertEqual(len({event["id"] for event in events}), 3)
        other, _ = monitor.parse_logs(repeated, "b" * 64, NOW)
        self.assertNotEqual(events[0]["id"], other[0]["id"])

    def test_bad_json_future_dates_and_oversized_lines(self):
        events, counts = monitor.parse_logs(b"invalid-line\n" + line(completion(), NOW + 120) + b"x" * (256 * 1024 + 1), CONTAINER, NOW)
        self.assertEqual(events, [])
        self.assertEqual(counts["invalid"], 3)

    def test_nan_status_and_duration_not_persisted(self):
        events, _ = monitor.parse_logs(line(completion(durationMs=float("nan"))), CONTAINER, NOW)
        self.assertNotIn("durationMs", events[0])
        self.assertIsNone(monitor.sanitized_event(completion(statusCode=True), NOW, "test"))

    def test_unknown_route_and_url_bucket(self):
        self.assertEqual(monitor.route_bucket("https://secret.invalid/secret"), "/api/*")
        self.assertEqual(monitor.route_bucket("/api/auth/login?secret=oops"), "/api/auth/login")

    def test_operational_routes_use_only_static_module_names(self):
        for group in ("attendance", "grades", "equipment", "borrowing", "borrowings", "private-media"):
            self.assertEqual(monitor.route_bucket(f"/api/{group}/private-student-id?token=secret"), f"/api/{group}/*")

    def test_fixed_browser_error_categories_and_transport_status(self):
        raw = structured("monitoring.client_error", kind="api", code="API_ERROR", statusCode=204, clientStatusCode=503, actorId=ACTOR, clientRequestId=REQUEST)
        events, _ = monitor.parse_logs(line(raw), CONTAINER, NOW)
        self.assertEqual(events[0]["clientStatus"], 503)
        self.assertEqual(events[0]["code"], "API_ERROR")
        self.assertEqual(events[0]["clientRequestId"], REQUEST)
        report = "\n".join(monitor.render_events({"events": events, "collections": [{"time": NOW, "since": NOW - 3600, "status": "observed"}]}, NOW))
        self.assertIn("HTTP penerimaan laporan 204; HTTP browser=503", report)
        raw.update({"kind": "private-message", "code": "SECRET_PASSWORD", "clientStatusCode": True, "clientRequestId": "arbitrary-private-request"})
        events, _ = monitor.parse_logs(line(raw), CONTAINER, NOW)
        self.assertNotIn("private-message", json.dumps(events))
        self.assertNotIn("SECRET_PASSWORD", json.dumps(events))
        self.assertNotIn("clientStatus", events[0])
        self.assertNotIn("clientRequestId", events[0])

    def test_error_categories_forbidden_rate_limited(self):
        events, _ = monitor.parse_logs(line(structured("monitoring.api_error", code="FORBIDDEN", statusCode=403)), CONTAINER, NOW)
        self.assertEqual(events[0]["code"], "FORBIDDEN")

    def test_unhashable_log_fields_do_not_crash_collector(self):
        for field in ("event", "method", "outcome", "kind", "code"):
            raw = structured("monitoring.client_error")
            raw[field] = ["malformed"]
            monitor.parse_logs(line(raw), CONTAINER, NOW)


class PrivateStateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sinegasi-monitor-test-")
        self.directory = Path(self.temp.name)
        self.directory.chmod(0o700)
        self.store = monitor.PrivateState(self.directory, owner=os.getuid())

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_atomic_private_round_trip(self):
        with self.store.locked(True):
            self.store.write({"version": 1, "events": [], "collections": [], "dropped": 0}, NOW)
            self.assertEqual(self.store.read()["version"], 1)
        self.assertEqual(stat.S_IMODE((self.directory / "state.json").stat().st_mode), 0o600)
        self.assertFalse((self.directory / ".state.tmp").exists())

    def test_reject_directory_symlink(self):
        linked = self.directory / "symlink"
        linked.symlink_to(self.directory, target_is_directory=True)
        with self.assertRaises(ValueError):
            monitor.PrivateState(linked, owner=os.getuid())

    def test_reject_state_symlink_and_hardlink(self):
        target = self.directory / "other"
        target.write_text("private")
        target.chmod(0o600)
        state = self.directory / "state.json"
        state.symlink_to(target)
        with self.assertRaises(OSError):
            self.store.read()
        state.unlink()
        os.link(target, state)
        with self.assertRaises(ValueError):
            self.store.read()

    def test_reject_nonprivate_lock(self):
        lock = self.directory / "lock"
        lock.write_text("")
        lock.chmod(0o644)
        with self.assertRaises(ValueError):
            with self.store.locked(True):
                self.fail("lock accepted")

    def test_refuse_symlink_temp_without_overwriting_target(self):
        target = self.directory / "other"
        target.write_text("do-not-overwrite")
        (self.directory / ".state.tmp").symlink_to(target)
        with self.assertRaises(OSError):
            self.store.write({"version": 1, "events": [], "collections": []}, NOW)
        self.assertEqual(target.read_text(), "do-not-overwrite")

    def test_retention_event_and_byte_caps(self):
        events = [{"id": str(index), "time": NOW - index, "event": "request"} for index in range(30)]
        events.append({"id": "expired", "time": NOW - monitor.RETENTION_SECONDS - 1, "event": "request"})
        with patch.object(monitor, "MAX_EVENTS", 10):
            self.store.write({"version": 1, "events": events, "collections": []}, NOW)
        data = self.store.read()
        self.assertEqual(len(data["events"]), 10)
        self.assertEqual(data["dropped"], 20)
        self.assertNotIn("expired", {event["id"] for event in data["events"]})
        self.assertLess((self.directory / "state.json").stat().st_size, monitor.MAX_BYTES)

    def test_byte_cap_discards_events_without_expanding_disk(self):
        events = [{"id": str(index), "time": NOW, "event": "request", "route": "x" * 500} for index in range(20)]
        with patch.object(monitor, "MAX_BYTES", 1500):
            self.store.write({"version": 1, "events": events, "collections": []}, NOW)
        data = self.store.read()
        self.assertGreater(data["dropped"], 0)
        self.assertLessEqual((self.directory / "state.json").stat().st_size, 1500)

    def test_collect_dedup_repeat_overlap_and_error_marker(self):
        data = line(completion()) + line(structured())
        snapshot = {"id": CONTAINER}
        def fake_run(args, **kwargs):
            return result(json.dumps(snapshot).encode()) if "inspect" in args else result(data)
        first = monitor.collect(self.store, NOW, fake_run)
        second = monitor.collect(self.store, NOW + 30, fake_run)
        self.assertEqual(first["new"], 2)
        self.assertEqual(second["new"], 0)
        self.assertEqual(len(self.store.read()["events"]), 2)
        failed = monitor.collect(self.store, NOW + 4000, lambda *args, **kwargs: result(ok=False))
        self.assertEqual(failed["status"], "unknown")
        self.assertTrue(failed["gap"])

    def test_container_replacement_marks_gap(self):
        def fake_run(args, **kwargs):
            return result(json.dumps({"id": CONTAINER}).encode()) if "inspect" in args else result()
        monitor.collect(self.store, NOW, fake_run)
        def replacement(args, **kwargs):
            return result(json.dumps({"id": "b" * 64}).encode()) if "inspect" in args else result()
        marker = monitor.collect(self.store, NOW + 300, replacement)
        self.assertTrue(marker["containerChanged"])

    def test_failed_read_does_not_advance_successful_cursor(self):
        def successful(args, **kwargs):
            return result(json.dumps({"id": CONTAINER}).encode()) if "inspect" in args else result()
        monitor.collect(self.store, NOW, successful)
        failed = monitor.collect(self.store, NOW + 300, lambda *args, **kwargs: result(ok=False))
        self.assertEqual(failed["status"], "unknown")
        self.assertEqual(self.store.read()["lastObserved"], NOW)
        recovered = monitor.collect(self.store, NOW + 600, successful)
        self.assertEqual(recovered["since"], NOW - 60)
        self.assertEqual(self.store.read()["lastObserved"], NOW + 600)
        # The existing overlap/dedup and byte/line caps still apply on recovery.
        self.assertFalse(recovered["gap"])

    def test_legacy_state_cursor_uses_observed_marker_not_last_attempt(self):
        self.store.write({"version": 1, "events": [], "collections": [
            {"time": NOW - 1000, "status": "observed"},
            {"time": NOW - 300, "status": "unknown"},
        ], "lastAttempt": NOW - 300}, NOW)
        def successful(args, **kwargs):
            return result(json.dumps({"id": CONTAINER}).encode()) if "inspect" in args else result()
        marker = monitor.collect(self.store, NOW, successful)
        self.assertEqual(marker["since"], NOW - 1060)


class ReportAndCommandTests(unittest.TestCase):
    def test_bounded_command_output_and_timeout(self):
        excessive = monitor.bounded_run([sys.executable, "-c", "import sys;sys.stdout.write('x'*100000)"], max_bytes=1000)
        self.assertTrue(excessive["limited"])
        self.assertFalse(excessive["ok"])
        self.assertLessEqual(len(excessive["stdout"]), 1000)
        timeout = monitor.bounded_run([sys.executable, "-c", "import time;time.sleep(1)"], timeout=0.05)
        self.assertTrue(timeout["limited"])

    def test_ssh_summary_contains_no_ip_or_username(self):
        records = [{"MESSAGE": "Failed password for secret-user from 10.2.3.4"}, {"MESSAGE": "Accepted publickey for admin from 1.2.3.4", "__REALTIME_TIMESTAMP": str(int(NOW * 1_000_000))}]
        summary = monitor.ssh_summary(lambda *args, **kwargs: result(b"\n".join(json.dumps(value).encode() for value in records)))
        self.assertEqual(summary["counts"]["failed_password"], 1)
        self.assertEqual(summary["recent"][0]["method"], "publickey")
        encoded = json.dumps(summary)
        for sensitive in ("secret-user", "admin", "1.2.3.4", "10.2.3.4"):
            self.assertNotIn(sensitive, encoded)

    def test_failures_unknown_not_zero(self):
        self.assertIsNone(monitor.ssh_summary(lambda *args, **kwargs: result(ok=False)))
        self.assertIsNone(monitor.backup_summary(lambda *args, **kwargs: result(ok=False)))
        self.assertIsNone(monitor.container_snapshot(lambda *args, **kwargs: result(ok=False)))

    def test_ssh_requests_only_required_fields_without_raising_limits(self):
        calls = []
        def fake_run(args, **kwargs):
            calls.append((args, kwargs))
            return result()
        monitor.ssh_summary(fake_run)
        args, limits = calls[0]
        self.assertIn("--output=json", args)
        self.assertIn("--output-fields=MESSAGE,__REALTIME_TIMESTAMP", args)
        self.assertIn("--lines=10000", args)
        self.assertEqual(limits, {"timeout": 8, "max_bytes": 8 * 1024 * 1024})
        self.assertIsNone(monitor.ssh_summary(lambda *args, **kwargs: result(ok=False, limited=True)))

    def test_backup_only_selected_known_fields(self):
        raw = {"ageHours": 1.2, "stale": False, "status": "UPLOAD_VERIFIED_RESTORE_SEPARATE", "token": "secret"}
        summary = monitor.backup_summary(lambda *args, **kwargs: result(json.dumps(raw).encode() + b"\nCRON_ENABLED\n"))
        self.assertTrue(summary["confirmed"])
        self.assertTrue(summary["uploaded"])
        self.assertNotIn("secret", json.dumps(summary))

    def test_unknown_events_history_warns(self):
        output = "\n".join(monitor.render_events({"events": [], "collections": [{"time": NOW - 1200, "since": NOW - 3600, "status": "unknown", "gap": True}], "dropped": 9}, NOW))
        self.assertIn("PERLU DICEK", output)
        self.assertIn("ada gap/batas/kegagalan", output)
        self.assertIn("9", output)
        self.assertIn("SELALU TERBATAS", output)

    def test_full_report_failures_do_not_claim_healthy(self):
        class FakeStore:
            @monitor.contextlib.contextmanager
            def locked(self, exclusive):
                yield
            def read(self):
                return {"events": [], "collections": []}
        report = monitor.report(FakeStore(), NOW, lambda *args, **kwargs: result(ok=False))
        self.assertIn("BELUM TERKONFIRMASI", report)
        self.assertIn("bukan seluruh trafik Cloudflare", report)
        self.assertNotIn("SEHAT", report)


if __name__ == "__main__":
    unittest.main()
