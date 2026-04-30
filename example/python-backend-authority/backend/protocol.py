from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, TypedDict

DEMO_GRAPH_ID = "timer-graph"
SUPPORTED_COMMANDS = {"start", "stop", "update-config"}

NODE_TIMER_ID = "node-timer"
NODE_PROCESSOR_ID = "node-processor"
NODE_SINK_ID = "node-sink"
NODE_IDS = (NODE_TIMER_ID, NODE_PROCESSOR_ID, NODE_SINK_ID)

NODE_TITLES = {
    NODE_TIMER_ID: "Backend Timer",
    NODE_PROCESSOR_ID: "Tick Processor",
    NODE_SINK_ID: "Tick Sink",
}

NODE_TYPES = {
    NODE_TIMER_ID: "demo/timer",
    NODE_PROCESSOR_ID: "demo/processor",
    NODE_SINK_ID: "demo/sink",
}

NODE_ALIASES = {
    "timer": NODE_TIMER_ID,
    "backend timer": NODE_TIMER_ID,
    "processor": NODE_PROCESSOR_ID,
    "tick processor": NODE_PROCESSOR_ID,
    "sink": NODE_SINK_ID,
    "tick sink": NODE_SINK_ID,
}

DEFAULT_INTERVAL_MS = 1000
DEFAULT_PAYLOAD = {"message": "backend owned tick"}
DEFAULT_ROUTE = "timer -> processor -> sink"
DEFAULT_ROUTE_NODES = NODE_IDS


class TimerConfigInput(TypedDict, total=False):
    intervalMs: int
    payload: Any
    route: str


class CommandRequest(TypedDict, total=False):
    graphId: str
    runId: str
    config: TimerConfigInput


class RuntimeFeedbackEnvelope(TypedDict):
    seq: int
    runId: str
    feedback: dict[str, Any]


@dataclass(slots=True)
class TimerConfig:
    interval_ms: int = DEFAULT_INTERVAL_MS
    payload: Any = field(default_factory=lambda: deepcopy(DEFAULT_PAYLOAD))
    route: str = DEFAULT_ROUTE


def normalize_interval_ms(value: Any) -> int:
    try:
        next_value = int(value)
    except (TypeError, ValueError):
        return DEFAULT_INTERVAL_MS

    if next_value <= 0:
        return DEFAULT_INTERVAL_MS

    return next_value


def normalize_timer_config(payload: Any) -> TimerConfig:
    if not isinstance(payload, dict):
        return TimerConfig()

    route = payload.get("route")
    if not isinstance(route, str) or not route.strip():
        route = DEFAULT_ROUTE

    return TimerConfig(
        interval_ms=normalize_interval_ms(payload.get("intervalMs")),
        payload=deepcopy(payload.get("payload", DEFAULT_PAYLOAD)),
        route=route.strip(),
    )


def resolve_route_nodes(route: str) -> list[str]:
    tokens = [segment.strip().lower() for segment in route.split("->") if segment.strip()]
    resolved: list[str] = []
    for token in tokens:
        node_id = NODE_ALIASES.get(token, token)
        if node_id not in NODE_TITLES:
            continue
        if resolved and resolved[-1] == node_id:
            continue
        resolved.append(node_id)

    if not resolved:
        return list(DEFAULT_ROUTE_NODES)

    if resolved[0] != NODE_TIMER_ID:
        resolved.insert(0, NODE_TIMER_ID)

    return resolved


def make_acknowledgement(command: str, run_id: str, seq: int) -> dict[str, Any]:
    return {
        "accepted": True,
        "command": command,
        "graphId": DEMO_GRAPH_ID,
        "runId": run_id,
        "seq": seq,
    }


def make_envelope(seq: int, run_id: str, feedback: dict[str, Any]) -> RuntimeFeedbackEnvelope:
    return {
        "seq": seq,
        "runId": run_id,
        "feedback": feedback,
    }
