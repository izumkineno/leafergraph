from __future__ import annotations

import subprocess
import sys

from leafergraph_python_openrpc_authority_template.core.bootstrap import (
    ensure_generated,
    get_generator_script_path,
    get_template_root,
)
from leafergraph_python_openrpc_authority_template.core.protocol import (
    create_discover_result,
    read_authority_openrpc_document,
)

ensure_generated()

from leafergraph_python_openrpc_authority_template._generated.methods import (
    ALL_AUTHORITY_METHODS,
)
from leafergraph_python_openrpc_authority_template._generated.notifications import (
    ALL_AUTHORITY_NOTIFICATIONS,
)


def test_openrpc_names_match_generated_constants() -> None:
    document = read_authority_openrpc_document()

    assert {method["name"] for method in document["methods"]} == set(ALL_AUTHORITY_METHODS)
    assert {
        notification["name"] for notification in document["x-notifications"]
    } == set(ALL_AUTHORITY_NOTIFICATIONS)


def test_discover_result_is_shared_openrpc_document() -> None:
    assert create_discover_result() == read_authority_openrpc_document()


def test_generator_check_passes_on_clean_tree() -> None:
    result = subprocess.run(
        [sys.executable, str(get_generator_script_path()), "--check"],
        cwd=get_template_root(),
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
