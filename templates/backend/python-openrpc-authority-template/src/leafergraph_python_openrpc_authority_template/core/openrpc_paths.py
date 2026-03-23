from __future__ import annotations

import os
from pathlib import Path

LEAFERGRAPH_OPENRPC_ROOT_ENV = "LEAFERGRAPH_OPENRPC_ROOT"


def get_template_root() -> Path:
    return Path(__file__).resolve().parents[3]


def get_workspace_root() -> Path:
    return Path(__file__).resolve().parents[6]


def get_openrpc_root() -> Path:
    configured_root = os.environ.get(LEAFERGRAPH_OPENRPC_ROOT_ENV, "").strip()
    root = (
        Path(configured_root).resolve()
        if configured_root
        else (get_workspace_root() / "openrpc").resolve()
    )
    _assert_openrpc_root(root)
    return root


def get_openrpc_path() -> Path:
    return get_openrpc_root() / "authority.openrpc.json"


def get_schema_root() -> Path:
    return get_openrpc_root() / "schemas"


def get_conformance_root() -> Path:
    return get_openrpc_root() / "conformance"


def _assert_openrpc_root(root: Path) -> None:
    required_paths = {
        "authority.openrpc.json": root / "authority.openrpc.json",
        "schemas/": root / "schemas",
        "conformance/": root / "conformance",
    }
    missing = [
        label for label, path in required_paths.items() if not path.exists()
    ]
    if missing:
        raise FileNotFoundError(
            f"{LEAFERGRAPH_OPENRPC_ROOT_ENV} 指向的目录不完整: {root}，缺少 {', '.join(missing)}"
        )
