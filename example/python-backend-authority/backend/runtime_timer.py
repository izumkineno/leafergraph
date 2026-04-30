from __future__ import annotations

import json
import queue
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import urlparse

from .protocol import (
    DEMO_GRAPH_ID,
    NODE_IDS,
    NODE_TIMER_ID,
    NODE_TITLES,
    NODE_TYPES,
    TimerConfig,
    make_acknowledgement,
    make_envelope,
    normalize_timer_config,
    resolve_route_nodes,
)


class TimerRuntimeService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self._listeners: list[queue.Queue[dict[str, Any]]] = []
        self._history: list[dict[str, Any]] = []
        self._next_seq = 1
        self._run_counter = 0
        self._current_run_id = "run-000"
        self._graph_status = "idle"
        self._graph_step_count = 0
        self._graph_started_at: int | None = None
        self._graph_stopped_at: int | None = self._now_ms()
        self._graph_last_source = "manual"
        self._graph_last_route = DEFAULT_ROUTE_STRING
        self._graph_last_tick_at: int | None = None
        self._active_token = 0
        self._timer_thread: threading.Thread | None = None
        self._config = TimerConfig()
        self._node_states = {
            node_id: {
                "title": NODE_TITLES[node_id],
                "status": "idle",
                "runCount": 0,
                "lastExecutedAt": None,
                "lastSucceededAt": None,
                "lastFailedAt": None,
                "lastErrorMessage": None,
                "progress": None,
            }
            for node_id in NODE_IDS
        }

    def handle_command(self, command: str, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        graph_id = payload.get("graphId") or DEMO_GRAPH_ID
        if graph_id != DEMO_GRAPH_ID:
            return HTTPStatus.BAD_REQUEST, {"accepted": False, "error": f"Unknown graphId: {graph_id}"}

        config = normalize_timer_config(payload.get("config"))

        with self._condition:
            if command == "update-config":
                self._config = config
                self._graph_last_source = "config-update"
                self._condition.notify_all()
                return HTTPStatus.OK, make_acknowledgement(command, self._current_run_id, self._next_ack_seq_locked())

            if command == "start":
                if self._graph_status == "running":
                    return self._reject("Run already active")
                self._config = config
                self._start_run_locked()
                ack = make_acknowledgement(command, self._current_run_id, self._next_ack_seq_locked())
                self._emit_graph_execution_locked("started")
                self._start_worker_locked()
                return HTTPStatus.OK, ack

            if command == "stop":
                if self._graph_status == "idle" and self._graph_step_count == 0 and self._timer_thread is None:
                    return self._reject("No active run to stop")
                thread = self._timer_thread
                self._stop_run_locked()
                ack = make_acknowledgement(command, self._current_run_id, self._next_ack_seq_locked())

        if thread and thread.is_alive():
            thread.join(timeout=1.0)
        with self._condition:
            if self._timer_thread is thread:
                self._timer_thread = None
        return HTTPStatus.OK, ack

    def create_sse_session(self, last_event_id: str | None) -> tuple[queue.Queue[dict[str, Any]], list[dict[str, Any]]]:
        listener: queue.Queue[dict[str, Any]] = queue.Queue()
        with self._condition:
            self._listeners.append(listener)
            history = self._history.copy()
            initial_events = self._build_initial_events_locked()

        if last_event_id:
            try:
                last_id = int(last_event_id)
            except ValueError:
                last_id = -1
            replay = [event for event in history if int(event["seq"]) > last_id]
            return listener, replay or initial_events

        return listener, initial_events

    def remove_listener(self, listener: queue.Queue[dict[str, Any]]) -> None:
        with self._condition:
            if listener in self._listeners:
                self._listeners.remove(listener)

    def _start_run_locked(self) -> None:
        self._run_counter += 1
        self._current_run_id = f"run-{self._run_counter:03d}"
        self._graph_status = "running"
        self._graph_step_count = 0
        self._graph_started_at = self._now_ms()
        self._graph_stopped_at = None
        self._graph_last_source = "start"
        self._graph_last_route = self._config.route
        self._graph_last_tick_at = None
        self._active_token += 1
        self._reset_node_states_locked()

    def _start_worker_locked(self) -> None:
        if self._timer_thread and self._timer_thread.is_alive():
            return

        token = self._active_token
        self._timer_thread = threading.Thread(target=self._run_loop, args=(token,), daemon=True)
        self._timer_thread.start()

    def _run_loop(self, token: int) -> None:
        while True:
            with self._condition:
                if token != self._active_token or self._graph_status != "running":
                    return
                wait_seconds = max(self._config.interval_ms, 1) / 1000.0
                notified = self._condition.wait(timeout=wait_seconds)
                if token != self._active_token or self._graph_status != "running":
                    return
                if notified:
                    continue
                self._emit_tick_locked()

    def _emit_tick_locked(self) -> None:
        tick_at = self._now_ms()
        self._graph_step_count += 1
        self._graph_last_tick_at = tick_at
        self._graph_last_source = "tick"
        self._graph_last_route = self._config.route
        route_nodes = resolve_route_nodes(self._config.route)
        self._emit_graph_execution_locked("advanced")

        for index, node_id in enumerate(route_nodes):
            state = self._node_states[node_id]
            state["status"] = "success"
            state["runCount"] += 1
            state["lastExecutedAt"] = tick_at
            state["lastSucceededAt"] = tick_at
            state["lastFailedAt"] = None
            state["lastErrorMessage"] = None
            state["progress"] = None
            self._emit_node_execution_locked(node_id)

            if index + 1 < len(route_nodes):
                self._emit_link_propagation_locked(node_id, route_nodes[index + 1], tick_at)

    def _stop_run_locked(self) -> None:
        self._active_token += 1
        self._graph_status = "idle"
        self._graph_stopped_at = self._now_ms()
        self._graph_last_source = "stop"
        self._condition.notify_all()
        self._emit_graph_execution_locked("stopped")
        self._reset_node_states_locked()
        for node_id in NODE_IDS:
            self._emit_node_execution_locked(node_id)

    def _reset_node_states_locked(self) -> None:
        for node_id in NODE_IDS:
            state = self._node_states[node_id]
            state["title"] = NODE_TITLES[node_id]
            state["status"] = "idle"
            state["runCount"] = 0
            state["lastExecutedAt"] = None
            state["lastSucceededAt"] = None
            state["lastFailedAt"] = None
            state["lastErrorMessage"] = None
            state["progress"] = None

    def _build_initial_events_locked(self) -> list[dict[str, Any]]:
        events = [self._make_envelope_locked(self._build_graph_feedback_locked("stopped"))]
        for node_id in NODE_IDS:
            events.append(self._make_envelope_locked(self._build_node_feedback_locked(node_id)))
        return events

    def _build_graph_feedback_locked(self, event_type: str, node_id: str | None = None) -> dict[str, Any]:
        return {
            "type": "graph.execution",
            "event": {
                "type": event_type,
                "state": {
                    "status": self._graph_status,
                    "runId": self._current_run_id,
                    "queueSize": 0,
                    "stepCount": self._graph_step_count,
                    "startedAt": self._graph_started_at,
                    "stoppedAt": self._graph_stopped_at,
                    "lastSource": self._graph_last_source,
                    "lastRoute": self._graph_last_route,
                    "lastTickAt": self._graph_last_tick_at,
                },
                "runId": self._current_run_id,
                "source": self._graph_last_source,
                "nodeId": node_id,
                "timestamp": self._now_ms(),
            },
        }

    def _build_node_feedback_locked(self, node_id: str) -> dict[str, Any]:
        state = self._node_states[node_id]
        return {
            "type": "node.execution",
            "event": {
                "chainId": f"{self._current_run_id}:{node_id}",
                "rootNodeId": NODE_TIMER_ID,
                "rootNodeType": NODE_TYPES[NODE_TIMER_ID],
                "rootNodeTitle": self._node_states[NODE_TIMER_ID]["title"],
                "nodeId": node_id,
                "nodeType": NODE_TYPES[node_id],
                "nodeTitle": state["title"],
                "depth": self._depth_for_node(node_id),
                "sequence": self._graph_step_count,
                "source": self._graph_last_source,
                "trigger": "direct",
                "timestamp": self._now_ms(),
                "executionContext": {
                    "source": self._graph_last_source,
                    "runId": self._current_run_id,
                    "entryNodeId": NODE_TIMER_ID,
                    "stepIndex": self._graph_step_count,
                    "startedAt": self._graph_started_at or self._now_ms(),
                },
                "state": {
                    "status": state["status"],
                    "runCount": state["runCount"],
                    "progress": state["progress"],
                    "lastExecutedAt": state["lastExecutedAt"],
                    "lastSucceededAt": state["lastSucceededAt"],
                    "lastFailedAt": state["lastFailedAt"],
                    "lastErrorMessage": state["lastErrorMessage"],
                },
            },
        }

    def _emit_graph_execution_locked(self, event_type: str, node_id: str | None = None) -> None:
        self._broadcast_locked(self._build_graph_feedback_locked(event_type, node_id=node_id))

    def _emit_node_execution_locked(self, node_id: str) -> None:
        self._broadcast_locked(self._build_node_feedback_locked(node_id))

    def _emit_link_propagation_locked(self, source_node_id: str, target_node_id: str, timestamp: int) -> None:
        feedback = {
            "type": "link.propagation",
            "event": {
                "linkId": f"link-{source_node_id}-{target_node_id}",
                "chainId": f"{self._current_run_id}:{source_node_id}",
                "sourceNodeId": source_node_id,
                "sourceSlot": 0,
                "targetNodeId": target_node_id,
                "targetSlot": 0,
                "payload": {
                    "runId": self._current_run_id,
                    "step": self._graph_step_count,
                    "from": source_node_id,
                    "to": target_node_id,
                    "route": self._config.route,
                    "config": {
                        "intervalMs": self._config.interval_ms,
                        "payload": self._config.payload,
                    },
                },
                "timestamp": timestamp,
            },
        }
        self._broadcast_locked(feedback)

    def _broadcast_locked(self, feedback: dict[str, Any]) -> None:
        envelope = self._make_envelope_locked(feedback)
        self._history.append(envelope)
        self._history = self._history[-200:]
        for listener in list(self._listeners):
            listener.put(envelope)

    def _make_envelope_locked(self, feedback: dict[str, Any]) -> dict[str, Any]:
        envelope = make_envelope(self._next_seq, self._current_run_id, feedback)
        self._next_seq += 1
        return envelope

    def _next_ack_seq_locked(self) -> int:
        seq = self._next_seq
        self._next_seq += 1
        return seq

    def _reject(self, message: str) -> tuple[int, dict[str, Any]]:
        return HTTPStatus.CONFLICT, {"accepted": False, "error": message}

    def _depth_for_node(self, node_id: str) -> int:
        if node_id == NODE_TIMER_ID:
            return 0
        if node_id == NODE_IDS[1]:
            return 1
        return 2

    @staticmethod
    def _now_ms() -> int:
        return int(time.time() * 1000)


DEFAULT_ROUTE_STRING = "timer -> processor -> sink"


class TimerRequestHandler(BaseHTTPRequestHandler):
    runtime: TimerRuntimeService

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID")
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/commands/start", "/commands/update-config", "/commands/stop"}:
            self._send_json(HTTPStatus.NOT_FOUND, {"accepted": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        payload: dict[str, Any] = {}
        if length > 0:
            raw = self.rfile.read(length)
            if raw:
                payload = json.loads(raw.decode("utf-8"))

        command = parsed.path.rsplit("/", 1)[-1]
        status, response = self.runtime.handle_command(command, payload)
        self._send_json(status, response)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/events":
            self._handle_events()
            return
        if parsed.path == "/health":
            self._send_json(HTTPStatus.OK, {"ok": True})
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def _handle_events(self) -> None:
        last_event_id = self.headers.get("Last-Event-ID")
        listener, initial_events = self.runtime.create_sse_session(last_event_id)
        self.send_response(HTTPStatus.OK)
        self._send_cors_headers()
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        try:
            for event in initial_events:
                self._write_sse(event)
            while True:
                try:
                    event = listener.get(timeout=15)
                except queue.Empty:
                    try:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError, OSError):
                        return
                    continue
                self._write_sse(event)
        except (BrokenPipeError, ConnectionResetError, OSError):
            return
        finally:
            self.runtime.remove_listener(listener)

    def _write_sse(self, event: dict[str, Any]) -> None:
        body = json.dumps(event, ensure_ascii=False)
        self.wfile.write(f"id: {event['seq']}\n".encode("utf-8"))
        self.wfile.write(b"event: runtime\n")
        self.wfile.write(f"data: {body}\n\n".encode("utf-8"))
        self.wfile.flush()

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")

    def log_message(self, format: str, *args: Any) -> None:
        return
