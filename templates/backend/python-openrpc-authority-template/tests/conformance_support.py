from __future__ import annotations

import asyncio
import json
import os
import socket
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import uvicorn

from leafergraph_python_openrpc_authority_template.core.openrpc_paths import (
    get_conformance_root,
    get_openrpc_root,
)
from leafergraph_python_openrpc_authority_template.transport.server import (
    create_authority_app,
)

CONFORMANCE_HTTP_BASE_URL_ENV = "LEAFERGRAPH_AUTHORITY_CONFORMANCE_HTTP_BASE_URL"
CONFORMANCE_WS_URL_ENV = "LEAFERGRAPH_AUTHORITY_CONFORMANCE_WS_URL"
CONFORMANCE_LEVEL_ENV = "LEAFERGRAPH_AUTHORITY_CONFORMANCE_LEVEL"
VALID_LEVELS = {"core", "advanced", "all"}


def openrpc_root() -> Path:
    return get_openrpc_root()


def conformance_root() -> Path:
    return get_conformance_root()


def manifest_path() -> Path:
    return conformance_root() / "manifest.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def resolve_conformance_path(relative_path: str) -> Path:
    return (conformance_root() / relative_path).resolve()


def load_manifest() -> dict[str, Any]:
    return load_json(manifest_path())


def selected_conformance_levels() -> set[str]:
    raw_value = os.environ.get(CONFORMANCE_LEVEL_ENV, "all").strip().lower()
    if raw_value not in VALID_LEVELS:
        raise RuntimeError(
            f"{CONFORMANCE_LEVEL_ENV} 只能是 core / advanced / all，当前为 {raw_value!r}"
        )
    if raw_value == "all":
        return {"core", "advanced"}
    return {raw_value}


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _matches_token(actual: Any, expected: str) -> bool:
    if expected == "__ANY__":
        return True
    if expected == "__ANY_STRING__":
        return isinstance(actual, str)
    if expected == "__ANY_NUMBER__":
        return is_number(actual)
    if expected == "__ANY_STRING_OR_NUMBER__":
        return isinstance(actual, str) or is_number(actual)
    if expected == "__ANY_BOOLEAN__":
        return isinstance(actual, bool)
    return False


def assert_subset_match(actual: Any, expected: Any, *, path: str = "root") -> None:
    if isinstance(expected, str) and expected.startswith("__") and expected.endswith("__"):
        assert _matches_token(actual, expected), f"{path} 未匹配占位断言 {expected!r}，实际为 {actual!r}"
        return

    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path} 期望 object，实际为 {type(actual).__name__}"
        for key, value in expected.items():
            assert key in actual, f"{path} 缺少键 {key!r}"
            assert_subset_match(actual[key], value, path=f"{path}.{key}")
        return

    if isinstance(expected, list):
        assert isinstance(actual, list), f"{path} 期望 array，实际为 {type(actual).__name__}"
        assert len(actual) >= len(expected), (
            f"{path} 实际数组长度 {len(actual)} 小于期望最小长度 {len(expected)}"
        )
        for index, value in enumerate(expected):
            assert_subset_match(actual[index], value, path=f"{path}[{index}]")
        return

    assert actual == expected, f"{path} 期望 {expected!r}，实际为 {actual!r}"


def expectation_matches(actual: Any, expectation_path: Path) -> bool:
    try:
        assert_expectation(actual, expectation_path)
    except AssertionError:
        return False
    return True


def assert_expectation(actual: Any, expectation_path: Path) -> None:
    expectation = load_json(expectation_path)
    mode = expectation["mode"]
    if mode == "subset":
        assert_subset_match(actual, expectation["payload"])
        return
    if mode == "result-equals-file":
        payload_file = (expectation_path.parent / expectation["payloadFile"]).resolve()
        assert isinstance(actual, dict) and "result" in actual, "响应缺少 result 字段"
        expected_result = load_json(payload_file)
        assert actual["result"] == expected_result, "响应 result 与共享 OpenRPC 文档不一致"
        return
    raise AssertionError(f"未知 expectation mode: {mode}")


def resolve_request_placeholders(value: Any, *, current_document: dict[str, Any] | None) -> Any:
    if value == "__CURRENT_DOCUMENT__":
        if current_document is None:
            raise RuntimeError("请求 fixture 需要 __CURRENT_DOCUMENT__，但当前没有已知文档基线")
        return json.loads(json.dumps(current_document))
    if isinstance(value, dict):
        return {
            key: resolve_request_placeholders(child, current_document=current_document)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [
            resolve_request_placeholders(item, current_document=current_document)
            for item in value
        ]
    return value


def extract_response_document(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    if "documentId" in value and "revision" in value:
        return value
    document = value.get("document")
    if isinstance(document, dict) and "documentId" in document and "revision" in document:
        return document
    return None


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


@dataclass
class ConformanceTarget:
    http_base_url: str
    ws_url: str


@asynccontextmanager
async def run_conformance_target() -> AsyncIterator[ConformanceTarget]:
    http_base_url = os.environ.get(CONFORMANCE_HTTP_BASE_URL_ENV)
    ws_url = os.environ.get(CONFORMANCE_WS_URL_ENV)

    if http_base_url and ws_url:
        yield ConformanceTarget(http_base_url=http_base_url, ws_url=ws_url)
        return

    if http_base_url or ws_url:
        raise RuntimeError(
            f"{CONFORMANCE_HTTP_BASE_URL_ENV} 与 {CONFORMANCE_WS_URL_ENV} 必须同时提供，或都不提供"
        )

    port = find_free_port()
    config = uvicorn.Config(
        create_authority_app(),
        host="127.0.0.1",
        port=port,
        log_level="warning",
        lifespan="off",
    )
    server = uvicorn.Server(config)
    server.install_signal_handlers = lambda: None  # type: ignore[assignment]
    server_task = asyncio.create_task(server.serve())
    try:
        for _ in range(100):
            if server.started:
                break
            if server_task.done():
                await server_task
            await asyncio.sleep(0.05)
        else:
            raise RuntimeError("authority conformance server 未能及时启动")

        yield ConformanceTarget(
            http_base_url=f"http://127.0.0.1:{port}",
            ws_url=f"ws://127.0.0.1:{port}/authority",
        )
    finally:
        server.should_exit = True
        await server_task
