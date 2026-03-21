from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

AUTHORITY_JSON_RPC_VERSION = "2.0"

AUTHORITY_JSON_RPC_ERROR_CODES = {
    "parse_error": -32700,
    "invalid_request": -32600,
    "method_not_found": -32601,
    "invalid_params": -32602,
    "internal_error": -32603,
}

AUTHORITY_RPC_DISCOVER_METHOD = "rpc.discover"
AUTHORITY_GET_DOCUMENT_METHOD = "authority.getDocument"
AUTHORITY_SUBMIT_OPERATION_METHOD = "authority.submitOperation"
AUTHORITY_REPLACE_DOCUMENT_METHOD = "authority.replaceDocument"
AUTHORITY_CONTROL_RUNTIME_METHOD = "authority.controlRuntime"

AUTHORITY_DOCUMENT_NOTIFICATION = "authority.document"
AUTHORITY_RUNTIME_FEEDBACK_NOTIFICATION = "authority.runtimeFeedback"
AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION = "authority.frontendBundlesSync"

_KNOWN_METHODS = {
    AUTHORITY_RPC_DISCOVER_METHOD,
    AUTHORITY_GET_DOCUMENT_METHOD,
    AUTHORITY_SUBMIT_OPERATION_METHOD,
    AUTHORITY_REPLACE_DOCUMENT_METHOD,
    AUTHORITY_CONTROL_RUNTIME_METHOD,
}

_cached_openrpc_document: dict[str, Any] | None = None


def clone_value(value: Any) -> Any:
    return deepcopy(value)


def _resolve_openrpc_document_path() -> Path:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[4] / "shared" / "openrpc" / "authority.openrpc.json",
        current.parents[3] / "shared" / "openrpc" / "authority.openrpc.json",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def read_authority_openrpc_document() -> dict[str, Any]:
    global _cached_openrpc_document

    if _cached_openrpc_document is None:
        _cached_openrpc_document = json.loads(
            _resolve_openrpc_document_path().read_text(encoding="utf-8")
        )

    return clone_value(_cached_openrpc_document)


def create_discover_result() -> dict[str, Any]:
    return read_authority_openrpc_document()


def create_success_envelope(
    request_id: str | int | None, result: Any
) -> dict[str, Any]:
    return {
        "jsonrpc": AUTHORITY_JSON_RPC_VERSION,
        "id": request_id,
        "result": clone_value(result),
    }


def create_error_envelope(
    request_id: str | int | None,
    code: int,
    message: str,
    data: Any | None = None,
) -> dict[str, Any]:
    envelope: dict[str, Any] = {
        "jsonrpc": AUTHORITY_JSON_RPC_VERSION,
        "id": request_id,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if data is not None:
        envelope["error"]["data"] = clone_value(data)
    return envelope


def create_notification_envelope(method: str, params: Any) -> dict[str, Any]:
    envelope: dict[str, Any] = {
        "jsonrpc": AUTHORITY_JSON_RPC_VERSION,
        "method": method,
    }
    if params is not None:
        envelope["params"] = clone_value(params)
    return envelope


def create_document_notification(document: dict[str, Any]) -> dict[str, Any]:
    return create_notification_envelope(
        AUTHORITY_DOCUMENT_NOTIFICATION, document
    )


def create_runtime_feedback_notification(event: dict[str, Any]) -> dict[str, Any]:
    return create_notification_envelope(
        AUTHORITY_RUNTIME_FEEDBACK_NOTIFICATION, event
    )


def create_frontend_bundles_sync_notification(
    event: dict[str, Any],
) -> dict[str, Any]:
    return create_notification_envelope(
        AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION, event
    )


def parse_request_envelope(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    if value.get("jsonrpc") != AUTHORITY_JSON_RPC_VERSION:
        return None
    request_id = value.get("id")
    if not isinstance(request_id, (str, int)):
        return None
    method = value.get("method")
    if method not in _KNOWN_METHODS:
        return None
    return value
