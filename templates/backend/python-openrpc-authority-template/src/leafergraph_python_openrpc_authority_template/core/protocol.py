from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from .openrpc_paths import get_openrpc_path

_cached_openrpc_document: dict[str, Any] | None = None
DEFAULT_AUTHORITY_NAME = "python-openrpc-authority-template"
DEFAULT_AUTHORITY_HOST = "127.0.0.1"
DEFAULT_AUTHORITY_PORT = 5503
AUTHORITY_HEALTH_PATH = "/health"
AUTHORITY_WS_PATH = "/authority"
OPENRPC_BACKEND_HOST_ENV = "LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_HOST"
OPENRPC_BACKEND_PORT_ENV = "LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_PORT"
OPENRPC_BACKEND_NAME_ENV = "LEAFERGRAPH_PYTHON_OPENRPC_BACKEND_NAME"
LEGACY_BACKEND_HOST_ENV = "LEAFERGRAPH_PYTHON_BACKEND_HOST"
LEGACY_BACKEND_PORT_ENV = "LEAFERGRAPH_PYTHON_BACKEND_PORT"
LEGACY_BACKEND_NAME_ENV = "LEAFERGRAPH_PYTHON_BACKEND_NAME"


def clone_value(value: Any) -> Any:
    return deepcopy(value)


def read_authority_openrpc_document() -> dict[str, Any]:
    global _cached_openrpc_document

    if _cached_openrpc_document is None:
        _cached_openrpc_document = json.loads(
            get_openrpc_path().read_text(encoding="utf-8")
        )
    return clone_value(_cached_openrpc_document)


def create_discover_result() -> dict[str, Any]:
    return read_authority_openrpc_document()
