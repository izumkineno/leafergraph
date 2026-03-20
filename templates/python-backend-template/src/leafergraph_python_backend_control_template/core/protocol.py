from __future__ import annotations

from copy import deepcopy
from typing import Any


def clone_value(value: Any) -> Any:
    return deepcopy(value)


def create_success_envelope(request_id: str, response: dict[str, Any]) -> dict[str, Any]:
    return {
        "channel": "authority.response",
        "requestId": request_id,
        "ok": True,
        "response": response,
    }


def create_failure_envelope(request_id: str, error: str) -> dict[str, Any]:
    return {
        "channel": "authority.response",
        "requestId": request_id,
        "ok": False,
        "error": error,
    }


def create_event_envelope(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "channel": "authority.event",
        "event": event,
    }


def parse_request_envelope(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    if value.get("channel") != "authority.request":
        return None
    if not isinstance(value.get("requestId"), str):
        return None
    request = value.get("request")
    if not isinstance(request, dict):
        return None
    if not isinstance(request.get("action"), str):
        return None
    return value
