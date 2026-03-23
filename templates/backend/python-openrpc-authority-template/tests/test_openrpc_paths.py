from __future__ import annotations

import json
from pathlib import Path

import pytest

from leafergraph_python_openrpc_authority_template.core.openrpc_paths import (
    LEAFERGRAPH_OPENRPC_ROOT_ENV,
    get_conformance_root,
    get_openrpc_path,
    get_openrpc_root,
    get_schema_root,
    get_workspace_root,
)


def create_openrpc_root(
    tmp_path: Path,
    *,
    include_document: bool = True,
    include_schemas: bool = True,
    include_conformance: bool = True,
) -> Path:
    root = tmp_path / "custom-openrpc"
    root.mkdir()

    if include_document:
        (root / "authority.openrpc.json").write_text(
            json.dumps({"openrpc": "1.3.2", "info": {"title": "custom-openrpc"}}),
            encoding="utf-8",
        )
    if include_schemas:
        (root / "schemas").mkdir()
    if include_conformance:
        (root / "conformance").mkdir()

    return root


def test_openrpc_root_falls_back_to_workspace_openrpc(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(LEAFERGRAPH_OPENRPC_ROOT_ENV, raising=False)

    expected_root = (get_workspace_root() / "openrpc").resolve()

    assert get_openrpc_root() == expected_root
    assert get_openrpc_path() == expected_root / "authority.openrpc.json"
    assert get_schema_root() == expected_root / "schemas"
    assert get_conformance_root() == expected_root / "conformance"


def test_openrpc_root_can_be_overridden_by_environment(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    custom_root = create_openrpc_root(tmp_path)
    monkeypatch.setenv(LEAFERGRAPH_OPENRPC_ROOT_ENV, str(custom_root))

    assert get_openrpc_root() == custom_root.resolve()
    assert get_openrpc_path() == custom_root.resolve() / "authority.openrpc.json"


@pytest.mark.parametrize(
    ("create_options", "expected_message"),
    [
        ({"include_document": False}, "authority.openrpc.json"),
        ({"include_schemas": False}, "schemas/"),
        ({"include_conformance": False}, "conformance/"),
    ],
)
def test_openrpc_root_requires_complete_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    create_options: dict[str, bool],
    expected_message: str,
) -> None:
    custom_root = create_openrpc_root(tmp_path, **create_options)
    monkeypatch.setenv(LEAFERGRAPH_OPENRPC_ROOT_ENV, str(custom_root))

    with pytest.raises(FileNotFoundError, match=expected_message):
        get_openrpc_root()
