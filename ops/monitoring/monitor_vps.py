#!/usr/bin/python3
"""Bounded, first-party operator monitoring; never stores raw application logs."""

from __future__ import annotations

import argparse
import collections
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import socket
import stat
import subprocess
import sys
import time
from typing import Any

STATE_DIR = Path("/var/lib/sinegasi-monitor")
CONTAINER = "sinegasi-api-prod"
DOCKER = ["/usr/bin/docker", "--host", "unix:///var/run/docker.sock"]
SERVICES = ("docker", "cron", "ssh", "sinegasi-prod-tunnel")
RETENTION_SECONDS = 14 * 86400
MAX_EVENTS = 20_000
MAX_BYTES = 15 * 1024 * 1024  # Old + atomic replacement stay below 32 MiB.
MAX_COMMAND_BYTES = 16 * 1024 * 1024
MAX_LOG_LINES = 5000
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
REQUEST_ID = re.compile(r"^(?:req-[a-z0-9]{1,12}|[0-9a-f-]{36})$", re.I)
METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
EVENTS = {"monitoring.login", "monitoring.activity", "monitoring.client_error", "monitoring.api_error"}
OUTCOMES = {"success", "invalid_credentials", "rate_limited", "unavailable", "rejected", "error"}
CLIENT_KINDS = {"render", "runtime", "unhandled_rejection", "api"}
CLIENT_CODES = {"RENDER_ERROR", "RUNTIME_ERROR", "UNHANDLED_REJECTION", "API_ERROR", "NETWORK_ERROR"}
API_CODES = {"HTTP_5XX", "FORBIDDEN", "RATE_LIMITED"}
ROUTE_GROUPS = {"auth", "users", "students", "productions", "production", "contests", "contest", "cash", "media", "reports", "audit", "dashboard", "monitoring", "classes", "subjects", "assignments", "settings", "recap", "returns", "attendance", "grades", "equipment", "borrowing", "borrowings", "private-media"}
EXACT_ROUTES = {"/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/monitoring/client-errors"}
UTC = dt.timezone.utc
WIB = dt.timezone(dt.timedelta(hours=7), "WIB")


def member(value: object, allowed: set[str]) -> bool:
    return isinstance(value, str) and value in allowed


def timestamp(value: object) -> float | None:
    try:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            result = float(value) / 1000 if value > 10_000_000_000 else float(value)
        elif isinstance(value, str):
            # Docker emits nanoseconds; datetime supports microseconds.
            normalized = re.sub(r"(\.\d{6})\d+(?=Z|[+-])", r"\1", value)
            parsed = dt.datetime.fromisoformat(normalized.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return None
            result = parsed.timestamp()
        else:
            return None
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, OverflowError, OSError):
        return None


def wib(value: float | None) -> str:
    return dt.datetime.fromtimestamp(value, WIB).strftime("%d-%m-%Y %H:%M:%S WIB") if value is not None else "BELUM DIKETAHUI"


def route_bucket(value: object) -> str:
    # Never persist path parameters, query strings, arbitrary URLs or filenames.
    if not isinstance(value, str):
        return "/api/*"
    path = value.split("?", 1)[0]
    if path in EXACT_ROUTES:
        return path
    parts = path.split("/")
    return f"/api/{parts[2]}/*" if len(parts) > 2 and parts[1] == "api" and parts[2] in ROUTE_GROUPS else "/api/*"


def sanitized_event(raw: dict[str, Any], log_time: float, identity: str) -> dict[str, Any] | None:
    event = raw.get("event")
    if not member(event, EVENTS):
        if raw.get("msg") != "request completed" or not all(key in raw for key in ("route", "method", "statusCode", "durationMs")):
            return None  # Excludes Fastify's second, automatic completion log.
        event = "request"
    status = raw.get("statusCode")
    method = raw.get("method")
    if type(status) is not int or not 100 <= status <= 599 or not member(method, METHODS):
        return None
    result: dict[str, Any] = {"id": identity, "time": log_time, "event": event, "route": route_bucket(raw.get("route")), "method": method, "status": status}
    request_id = raw.get("requestId")
    if isinstance(request_id, str) and REQUEST_ID.fullmatch(request_id) and (request_id.startswith("req-") or UUID.fullmatch(request_id)):
        result["requestId"] = request_id
    if event == "request":
        duration = raw.get("durationMs")
        if isinstance(duration, (int, float)) and not isinstance(duration, bool) and math.isfinite(duration) and 0 <= duration <= 3_600_000:
            result["durationMs"] = round(duration, 2)
    if event == "monitoring.login":
        if not member(raw.get("outcome"), OUTCOMES):
            return None
        result["outcome"] = raw["outcome"]
    actor = raw.get("actorId")
    if event in {"monitoring.activity", "monitoring.client_error", "monitoring.api_error"} or (event == "monitoring.login" and raw.get("outcome") == "success"):
        if isinstance(actor, str) and UUID.fullmatch(actor):
            result["actorId"] = actor.lower()
    if event == "monitoring.client_error":
        if member(raw.get("kind"), CLIENT_KINDS):
            result["kind"] = raw["kind"]
        if member(raw.get("code"), CLIENT_CODES):
            result["code"] = raw["code"]
        client_status = raw.get("clientStatusCode")
        if type(client_status) is int and 400 <= client_status <= 599:
            result["clientStatus"] = client_status
        client_request_id = raw.get("clientRequestId")
        if isinstance(client_request_id, str) and UUID.fullmatch(client_request_id):
            result["clientRequestId"] = client_request_id.lower()
    elif event == "monitoring.api_error" and member(raw.get("code"), API_CODES):
        result["code"] = raw["code"]
    # Error descriptions, stack traces, release labels and arbitrary codes are
    # deliberately not copied. Only fixed error categories survive the allowlist.
    return result


def parse_logs(data: bytes, container_id: str, now: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    events: list[dict[str, Any]] = []
    counts = {"lines": 0, "invalid": 0, "ignored": 0}
    occurrences: collections.Counter[str] = collections.Counter()
    for line in data.splitlines():
        if not line.strip():
            continue
        counts["lines"] += 1
        if counts["lines"] > MAX_LOG_LINES:
            break
        if len(line) > 256 * 1024:
            counts["invalid"] += 1
            continue
        prefix, _, payload = line.partition(b" ")
        docker_time = timestamp(prefix.decode("ascii", errors="ignore"))
        try:
            raw = json.loads(payload)
        except (ValueError, UnicodeDecodeError, RecursionError):
            counts["invalid"] += 1
            continue
        if not isinstance(raw, dict) or docker_time is None or docker_time > now + 60:
            counts["invalid"] += 1
            continue
        event_id = raw.get("eventId")
        if member(raw.get("event"), EVENTS) and isinstance(event_id, str) and UUID.fullmatch(event_id):
            identity = "event:" + event_id.lower()
        else:
            # Docker timestamp + full immutable container ID + exact raw line hash
            # disambiguates process restarts/request-ID reuse. No raw line persists.
            digest = hashlib.sha256(container_id.encode() + b"\0" + line).hexdigest()
            occurrences[digest] += 1
            identity = f"legacy:{digest}:{occurrences[digest]}"
        item = sanitized_event(raw, docker_time, identity)
        if item is None:
            counts["ignored"] += 1
        else:
            events.append(item)
    return events, counts


def bounded_run(args: list[str], timeout: float = 15, max_bytes: int = MAX_COMMAND_BYTES) -> dict[str, Any]:
    """Drain both pipes with a hard byte budget and deadline; never print stderr."""
    env = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C", "TZ": "UTC"}
    try:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    except OSError:
        return {"ok": False, "stdout": b"", "stderr": b"", "limited": False}
    output = {"stdout": bytearray(), "stderr": bytearray()}
    limited = False
    deadline = time.monotonic() + timeout
    selector = selectors.DefaultSelector()
    try:
        for name, pipe in (("stdout", process.stdout), ("stderr", process.stderr)):
            assert pipe is not None
            selector.register(pipe, selectors.EVENT_READ, name)
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                limited = True
                break
            for key, _ in selector.select(min(remaining, 0.25)):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                available = max_bytes - sum(map(len, output.values()))
                output[key.data].extend(chunk[:available])
                if len(chunk) > available:
                    limited = True
                    break
            if limited:
                break
        if limited:
            process.kill()
        process.wait(timeout=max(0.1, deadline - time.monotonic()) if not limited else 2)
    except (OSError, subprocess.TimeoutExpired):
        limited = True
        process.kill()
        process.wait(timeout=2)
    finally:
        selector.close()
        if process.stdout:
            process.stdout.close()
        if process.stderr:
            process.stderr.close()
    return {"ok": process.returncode == 0 and not limited, "stdout": bytes(output["stdout"]), "stderr": bytes(output["stderr"]), "limited": limited}


def decode_json(result: dict[str, Any]) -> object | None:
    if not result["ok"]:
        return None
    try:
        return json.loads(result["stdout"])
    except (ValueError, UnicodeDecodeError):
        return None


class PrivateState:
    def __init__(self, directory: Path = STATE_DIR, owner: int = 0):
        self.directory = directory
        self.owner = owner
        info = directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != owner or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError("Direktori state bukan direktori privat milik root.")
        self.fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)

    def close(self) -> None:
        os.close(self.fd)

    def open_file(self, name: str, flags: int) -> int:
        fd = os.open(name, flags | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600, dir_fd=self.fd)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != self.owner or stat.S_IMODE(info.st_mode) != 0o600:
            os.close(fd)
            raise ValueError("Berkas state tidak privat, tertaut, atau bukan berkas biasa.")
        return fd

    @contextlib.contextmanager
    def locked(self, exclusive: bool):
        fd = self.open_file("lock", os.O_RDWR | (os.O_CREAT if exclusive else 0))
        deadline = time.monotonic() + 5
        try:
            while True:
                try:
                    fcntl.flock(fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise ValueError("Collector sedang sibuk; coba lagi sebentar.") from None
                    time.sleep(0.05)
            yield
        finally:
            os.close(fd)

    def read(self) -> dict[str, Any]:
        try:
            fd = self.open_file("state.json", os.O_RDONLY)
        except FileNotFoundError:
            return {"version": 1, "events": [], "collections": [], "dropped": 0}
        with os.fdopen(fd, "rb") as stream:
            data = stream.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("State melewati batas aman; jangan hapus sebelum diperiksa.")
        state_data = json.loads(data)
        if not isinstance(state_data, dict) or state_data.get("version") != 1 or not isinstance(state_data.get("events"), list) or not isinstance(state_data.get("collections"), list):
            raise ValueError("Format state tidak valid; histori belum dikonfirmasi.")
        return state_data

    def write(self, state_data: dict[str, Any], now: float) -> None:
        events = sorted((event for event in state_data["events"] if event["time"] >= now - RETENTION_SECONDS), key=lambda event: event["time"])
        excess = max(0, len(events) - MAX_EVENTS)
        state_data["dropped"] = state_data.get("dropped", 0) + excess
        state_data["events"] = events[excess:]
        state_data["collections"] = state_data["collections"][-4032:]
        data = json.dumps(state_data, separators=(",", ":"), ensure_ascii=True).encode()
        while len(data) > MAX_BYTES and state_data["events"]:
            count = min(1000, len(state_data["events"]))
            state_data["events"] = state_data["events"][count:]
            state_data["dropped"] += count
            data = json.dumps(state_data, separators=(",", ":"), ensure_ascii=True).encode()
        if len(data) > MAX_BYTES:
            raise ValueError("Metadata state terlalu besar.")
        # All writers hold the same lock. Only the known private temporary file
        # may be recovered after a crash; refuse symlinks/hardlinks/fifos.
        try:
            stale_fd = self.open_file(".state.tmp", os.O_RDONLY)
        except FileNotFoundError:
            pass
        else:
            os.close(stale_fd)
            os.unlink(".state.tmp", dir_fd=self.fd)
        fd = self.open_file(".state.tmp", os.O_WRONLY | os.O_CREAT | os.O_EXCL)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            # Validate the current destination again before replacing it.
            try:
                dest_fd = self.open_file("state.json", os.O_RDONLY)
            except FileNotFoundError:
                pass
            else:
                os.close(dest_fd)
            os.replace(".state.tmp", "state.json", src_dir_fd=self.fd, dst_dir_fd=self.fd)
            os.fsync(self.fd)
        finally:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(".state.tmp", dir_fd=self.fd)


def container_snapshot(run=bounded_run) -> dict[str, Any] | None:
    # Explicit format excludes Env, command arguments, mounts and tunnel tokens.
    template = '{"id":{{json .Id}},"status":{{json .State.Status}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"not_configured"{{end}},"restarts":{{.RestartCount}},"oom":{{.State.OOMKilled}},"logging":{{json .HostConfig.LogConfig}}}'
    value = decode_json(run(DOCKER + ["inspect", "--format", template, CONTAINER], timeout=5, max_bytes=16384))
    return value if isinstance(value, dict) and re.fullmatch(r"[0-9a-f]{64}", str(value.get("id", ""))) else None


def collect(store: PrivateState, now: float, run=bounded_run) -> dict[str, Any]:
    with store.locked(True):
        state_data = store.read()
        previous = timestamp(state_data.get("lastObserved"))
        if previous is None or previous > now:
            # Upgrade old state without treating a failed attempt as a read cursor.
            observed = [timestamp(record.get("time")) for record in state_data["collections"]
                        if isinstance(record, dict) and record.get("status") == "observed"]
            previous = max((value for value in observed if value is not None and value <= now), default=None)
        since = max(now - 3600, previous - 60) if previous is not None else now - 3600
        snapshot = container_snapshot(run)
        marker: dict[str, Any] = {"time": now, "since": since, "status": "unknown", "new": 0}
        if snapshot:
            marker["containerChanged"] = "containerId" in state_data and state_data["containerId"] != snapshot["id"]
            state_data["containerId"] = snapshot["id"]
            result = run(DOCKER + ["logs", "--timestamps", "--since", str(int(since)), "--until", str(int(now)), "--tail", str(MAX_LOG_LINES), snapshot["id"]])
            if result["ok"]:
                events, counts = parse_logs(result["stdout"] + b"\n" + result["stderr"], snapshot["id"], now)
                seen = {event["id"] for event in state_data["events"]}
                new_events = []
                for event in events:
                    if event["id"] not in seen:
                        seen.add(event["id"])
                        new_events.append(event)
                state_data["events"].extend(new_events)
                state_data["lastObserved"] = now
                marker.update({"status": "observed", "new": len(new_events), "lines": counts["lines"], "invalid": counts["invalid"], "limited": counts["lines"] >= MAX_LOG_LINES})
            else:
                marker["limited"] = result["limited"]
        marker["gap"] = previous is not None and now - previous > 3600
        state_data["lastAttempt"] = now
        state_data["collections"].append(marker)
        store.write(state_data, now)
        return marker


def ssh_summary(run=bounded_run) -> dict[str, Any] | None:
    # Restrict JSON metadata at the source; 10k full journal records can exceed
    # the same fixed byte budget despite their actual messages being small.
    result = run(
        ["/usr/bin/journalctl", "-u", "ssh", "--since", "24 hours ago",
         "--no-pager", "--output=json", "--output-fields=MESSAGE,__REALTIME_TIMESTAMP",
         "--lines=10000"],
        timeout=8,
        max_bytes=8 * 1024 * 1024,
    )
    if not result["ok"]:
        return None
    counts = {"failed_password": 0, "invalid_user": 0, "accepted_publickey": 0, "accepted_password": 0}
    recent = []
    lines = result["stdout"].splitlines()
    malformed = 0
    for line in lines[:10000]:
        try:
            entry = json.loads(line)
            if not isinstance(entry, dict):
                malformed += 1
                continue
            message = entry.get("MESSAGE", "")
            if not isinstance(message, str):
                continue
            for needle, key in (("Failed password", "failed_password"), ("Invalid user", "invalid_user"), ("Accepted publickey", "accepted_publickey"), ("Accepted password", "accepted_password")):
                if needle in message:
                    counts[key] += 1
                    if key.startswith("accepted_"):
                        recorded = float(entry.get("__REALTIME_TIMESTAMP", "0")) / 1_000_000
                        if recorded > 0:
                            recent.append({"time": recorded, "method": key.removeprefix("accepted_")})
        except (ValueError, TypeError):
            malformed += 1
    return {"counts": counts, "recent": sorted(recent, key=lambda entry: entry["time"], reverse=True)[:5], "limited": len(lines) >= 10000 or malformed > 0, "lines": len(lines)}


def backup_summary(run=bounded_run) -> dict[str, Any] | None:
    result = run(["/usr/local/sbin/sinegasi-backup", "status"], timeout=10, max_bytes=65536)
    # Existing status emits JSON plus CRON_ENABLED, not all stdout is JSON.
    try:
        values = [json.loads(line) for line in result["stdout"].splitlines() if line.startswith(b"{")]
        raw = next(value for value in values if isinstance(value, dict) and "ageHours" in value)
        age = raw.get("ageHours")
        if type(age) not in (int, float) or not math.isfinite(age) or age < 0 or type(raw.get("stale")) is not bool:
            return None
        return {"confirmed": result["ok"], "ageHours": age, "stale": raw["stale"], "cron": b"CRON_ENABLED" in result["stdout"].splitlines(), "uploaded": raw.get("status") == "UPLOAD_VERIFIED_RESTORE_SEPARATE"}
    except (ValueError, StopIteration, TypeError):
        return None


def resources() -> dict[str, Any]:
    result: dict[str, Any] = {}
    try:
        result["load"] = os.getloadavg()[0]
        result["cpus"] = os.cpu_count()
        info = os.statvfs("/")
        result["disk"] = 100 * (1 - info.f_bavail / info.f_blocks)
        memory = {}
        with open("/proc/meminfo", encoding="ascii") as stream:
            for line in stream:
                key, _, raw = line.partition(":")
                if key in {"MemTotal", "MemAvailable"}:
                    memory[key] = int(raw.split()[0])
        result["ram"] = 100 * (1 - memory["MemAvailable"] / memory["MemTotal"])
    except (OSError, ValueError, KeyError, ZeroDivisionError):
        pass
    return result


def render_events(state_data: dict[str, Any], now: float) -> list[str]:
    markers = state_data["collections"]
    if not markers:
        return ["Catatan aplikasi  : BELUM TERSEDIA; collector belum menyimpan histori."]
    last = markers[-1]
    recent_markers = [item for item in markers if item["time"] >= now - 86400]
    incomplete = any(item.get("status") != "observed" or item.get("limited") or item.get("gap") or item.get("containerChanged") or item.get("invalid", 0) for item in recent_markers)
    stale = now - last["time"] > 900
    dropped = state_data.get("dropped", 0)
    events = [event for event in state_data["events"] if now - 86400 <= event["time"] <= now]
    requests = [event for event in events if event["event"] == "request" and event["route"] != "/api/health"]
    lines = [f"Collector terakhir: {wib(last['time'])}", f"Collector segar   : {'TIDAK / PERLU DICEK' if stale else 'YA (≤15 menit)'}", "Cakupan log       : SELALU TERBATAS; hanya subset yang sempat dikumpulkan."]
    if incomplete or dropped:
        lines.append(f"Peringatan histori: ada gap/batas/kegagalan; event dibuang karena kapasitas: {dropped}.")
    lines.extend([f"Awal pengumpulan  : {wib(markers[0]['since'])}; ini bukan histori sebelum instalasi.", f"API non-health    : {len(requests)} request TERCATAT dalam 24 jam terakhir", f"API error tercatat: {sum(event['status'] >= 500 for event in requests)} status 5xx; {sum(event['status'] == 401 for event in requests)} status 401; {sum(event['status'] == 403 for event in requests)} status 403; {sum(event['status'] == 429 for event in requests)} status 429"])
    for route, count in collections.Counter(event["route"] for event in requests).most_common(8):
        lines.append(f"  Rute {route}: {count}")
    logins = collections.Counter(event.get("outcome") for event in events if event["event"] == "monitoring.login")
    if logins:
        labels = {"success": "berhasil", "invalid_credentials": "kredensial ditolak", "rate_limited": "dibatasi", "unavailable": "layanan tak tersedia", "rejected": "ditolak", "error": "error"}
        lines.append("Login tercatat    : " + "; ".join(f"{labels[key]}={value}" for key, value in sorted(logins.items())))
    else:
        lines.append("Login terstruktur : BELUM ADA EVENT (bukan berarti tidak ada percobaan).")
    actors: dict[str, float] = {}
    for event in events:
        if event["event"] == "monitoring.activity" and "actorId" in event:
            actors[event["actorId"]] = max(actors.get(event["actorId"], 0), event["time"])
    active = [(actor, seen) for actor, seen in actors.items() if now - seen <= 600]
    lines.append(f"Aktivitas akun    : {len(active)} ID akun terverifikasi terlihat ≤10 menit; BUKAN bukti sedang online.")
    for actor, seen in sorted(active, key=lambda item: item[1], reverse=True)[:10]:
        lines.append(f"  ID {actor} — terakhir {wib(seen)}")
    errors = [event for event in events if (event["event"] == "request" and event["status"] >= 500) or event["event"] in {"monitoring.api_error", "monitoring.client_error"}]
    lines.append("Error terbaru (subset; satu request dapat memiliki beberapa jenis event):")
    for event in sorted(errors, key=lambda item: item["time"], reverse=True)[:10]:
        category = event.get("code", "HTTP_5XX" if event["status"] >= 500 else "EVENT")
        client_status = f"; HTTP browser={event['clientStatus']}" if "clientStatus" in event else ""
        original_request = f"; request asal={event['clientRequestId']}" if "clientRequestId" in event else ""
        transport = "HTTP penerimaan laporan" if event["event"] == "monitoring.client_error" else "HTTP"
        lines.append(f"  {wib(event['time'])} | {category} | {event['method']} {event['route']} | {transport} {event['status']}{client_status} | request={event.get('requestId', 'tidak tersedia')}{original_request}")
    if not errors:
        lines.append("  Tidak ada event error tersimpan; bukan jaminan aplikasi bebas error.")
    return lines


def report(store: PrivateState, now: float, run=bounded_run) -> str:
    lines = ["MONITOR SINEGASI — PEMERIKSAAN LOKAL", f"Waktu pemeriksaan : {wib(now)}", "Bukan sertifikat aman, bukan seluruh trafik Cloudflare, dan bukan alert saat VPS mati.", "", "LAYANAN"]
    for service in SERVICES:
        result = run(["/usr/bin/systemctl", "is-active", service], timeout=3, max_bytes=4096)
        state = result["stdout"].strip()
        label = "AKTIF" if result["ok"] and state == b"active" else "TIDAK AKTIF" if state in {b"inactive", b"failed"} else "BELUM TERKONFIRMASI"
        lines.append(f"{service:22}: {label}")
    snapshot = container_snapshot(run)
    if snapshot:
        lines.extend([f"Container API          : {snapshot.get('status') if snapshot.get('status') in {'running', 'exited', 'restarting', 'paused', 'dead', 'created'} else 'UNKNOWN'}", f"Health container       : {snapshot.get('health') if snapshot.get('health') in {'healthy', 'unhealthy', 'starting', 'not_configured'} else 'UNKNOWN'} (liveness, bukan tes DB)", f"Restart / OOM          : {snapshot.get('restarts') if type(snapshot.get('restarts')) is int else 'UNKNOWN'} / {'YA' if snapshot.get('oom') is True else 'TIDAK' if snapshot.get('oom') is False else 'UNKNOWN'}"])
        log = snapshot.get("logging", {})
        config = log.get("Config", {}) if isinstance(log, dict) else {}
        capped = log.get("Type") == "json-file" and config.get("max-size") == "10m" and config.get("max-file") == "3" if isinstance(log, dict) and isinstance(config, dict) else False
        lines.append(f"Rotasi log API         : {'TERKONFIRMASI json-file 3 × 10 MiB' if capped else 'PERLU DICEK; konfigurasi berbeda/tidak terbaca'}")
    else:
        lines.append("Container API          : BELUM TERKONFIRMASI (inspect gagal)")
    usage = resources()
    lines.extend(["", "SUMBER DAYA"])
    lines.append(f"CPU beban rata-rata 1m : {usage['load']:.2f} pada {usage.get('cpus', '?')} CPU (bukan persen)" if "load" in usage else "CPU                    : BELUM TERKONFIRMASI")
    for key, label in (("ram", "RAM terpakai"), ("disk", "Disk root terpakai")):
        lines.append(f"{label:22}: {usage[key]:.1f}%" if key in usage else f"{label:22}: BELUM TERKONFIRMASI")
    lines.extend(["", "APLIKASI — 24 JAM / SUBSET TERSIMPAN"])
    try:
        with store.locked(False):
            state_data = store.read()
        lines.extend(render_events(state_data, now))
    except (OSError, ValueError, KeyError, TypeError, RecursionError):
        lines.append("Histori aplikasi       : BELUM TERKONFIRMASI; state tidak terbaca/collector sibuk.")
    lines.extend(["", "SSH — 24 JAM / MAKSIMUM 10.000 BARIS JURNAL"])
    ssh = ssh_summary(run)
    if ssh:
        lines.append(f"Gagal password         : {ssh['counts']['failed_password']} kejadian; invalid user: {ssh['counts']['invalid_user']}")
        lines.append(f"Login sukses tercatat  : key={ssh['counts']['accepted_publickey']}; password={ssh['counts']['accepted_password']}")
        lines.append("Hitungan kejadian log, bukan orang unik/bukti kompromi; jurnal mungkin sudah terotasi.")
        if ssh["limited"]:
            lines.append("BATAS JURNAL TERCAPAI / ADA BARIS TAK TERBACA; hitungan tidak lengkap.")
        if not ssh["lines"]:
            lines.append("Jurnal kosong; nol bukan konfirmasi tidak ada aktivitas SSH.")
        for entry in ssh["recent"]:
            lines.append(f"  Sukses {wib(entry['time'])} — metode {entry['method']} (identitas/IP tidak ditampilkan)")
    else:
        lines.append("Jurnal SSH             : BELUM TERKONFIRMASI (gagal/timeout/batas byte)")
    lines.extend(["", "BACKUP"])
    backup = backup_summary(run)
    if backup:
        lines.append(f"Backup terakhir        : usia {backup['ageHours']:.2f} jam; terlambat={'YA' if backup['stale'] else 'TIDAK'}; jadwal={'AKTIF' if backup['cron'] else 'BELUM TERKONFIRMASI'}")
        lines.append(f"Upload terverifikasi   : {'YA' if backup['confirmed'] and backup['uploaded'] else 'BELUM TERKONFIRMASI'}; uji restore tetap terpisah.")
    else:
        lines.append("Backup                 : BELUM TERKONFIRMASI; cek sinegasi-backup report.")
    lines.extend(["", "Lanjut: Cloudflare → Security/Analytics untuk edge/bot; Supabase → Logs untuk DB.", "Tidak ada raw IP, username, password, token, body atau stack trace dalam laporan ini."])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor privat Sinegasi: laporan lokal atau pengumpulan aman.")
    parser.add_argument("action", choices=("report", "collect"))
    args = parser.parse_args()
    if sys.platform != "linux" or socket.gethostname() != "VM-11-154-ubuntu" or os.geteuid() != 0:
        print("STOP: jalankan dengan sudo pada VPS VM-11-154-ubuntu; bukan Terminal Mac lokal.", file=sys.stderr)
        return 1
    store = None
    try:
        store = PrivateState()
        if args.action == "collect":
            marker = collect(store, time.time())
            print(json.dumps({"time": wib(marker["time"]), "status": marker["status"], "newEvents": marker["new"], "limited": marker.get("limited", False), "gap": marker["gap"]}))
            return 0 if marker["status"] == "observed" and not marker.get("limited") else 1
        print(report(store, time.time()))
        return 0
    except (OSError, ValueError, KeyError, TypeError, RecursionError):
        print("STOP: monitor belum terkonfirmasi; periksa izin/state/instalasi. Detail mentah tidak dicetak.", file=sys.stderr)
        return 1
    finally:
        if store:
            store.close()


if __name__ == "__main__":
    raise SystemExit(main())
