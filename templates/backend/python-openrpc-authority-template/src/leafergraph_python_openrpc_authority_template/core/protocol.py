from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_cached_openrpc_document: dict[str, Any] | None = None
DEFAULT_AUTHORITY_NAME = "python-openrpc-authority-template"


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
