from __future__ import annotations

import asyncio
import socket
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
import uvicorn

from leafergraph_python_openrpc_authority_template import AuthorityRpcClient
from leafergraph_python_openrpc_authority_template.transport.server import (
    create_authority_app,
)
from leafergraph_python_openrpc_authority_template._generated.models import (
    AuthorityControlRuntimeParams,
    AuthorityReplaceDocumentParams,
    AuthoritySubmitOperationParams,
)

from .runtime_fixtures import create_template_execution_document


def dump_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    return value


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


@asynccontextmanager
async def run_live_server() -> AsyncIterator[str]:
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
            raise RuntimeError("authority server 未能及时启动")
        yield f"ws://127.0.0.1:{port}/authority"
    finally:
        server.should_exit = True
        await server_task


@pytest.mark.asyncio
async def test_generated_client_round_trips_against_live_authority() -> None:
    async with run_live_server() as uri:
        bundle_events: list[dict[str, Any]] = []
        document_events: list[dict[str, Any]] = []
        runtime_feedback_events: list[dict[str, Any]] = []
        bundle_ready = asyncio.Event()
        document_ready = asyncio.Event()
        runtime_feedback_ready = asyncio.Event()

        client = AuthorityRpcClient(uri)
        client.on_frontend_bundles_sync(
            lambda payload: (
                bundle_events.append(dump_value(payload)),
                bundle_ready.set(),
            )
        )
        client.on_document(
            lambda payload: (
                document_events.append(dump_value(payload)),
                document_ready.set(),
            )
        )
        client.on_runtime_feedback(
            lambda payload: (
                runtime_feedback_events.append(dump_value(payload)),
                runtime_feedback_ready.set(),
            )
        )

        await client.connect()
        try:
            await asyncio.wait_for(bundle_ready.wait(), timeout=2)
            assert bundle_events[0]["mode"] == "full"
            assert bundle_events[0]["packages"] == []

            discover = await client.discover()
            assert discover["openrpc"] == "1.3.2"

            original_document = dump_value(await client.get_document())
            replaced_document = dump_value(
                await client.replace_document(
                    AuthorityReplaceDocumentParams(
                        document={**original_document, "appKind": "remote-demo"},
                        context={"currentDocument": original_document},
                    )
                )
            )
            assert replaced_document["appKind"] == "remote-demo"

            await asyncio.wait_for(document_ready.wait(), timeout=2)
            assert document_events[-1]["appKind"] == "remote-demo"

            latest_document = dump_value(await client.get_document())
            operation_result = dump_value(
                await client.submit_operation(
                    AuthoritySubmitOperationParams(
                        operation={
                            "operationId": "client-node-create",
                            "timestamp": 1,
                            "source": "pytest",
                            "type": "node.create",
                            "input": {
                                "id": "client-node",
                                "type": "demo/client",
                                "x": 12,
                                "y": 34,
                            },
                        },
                        context={
                            "currentDocument": latest_document,
                            "pendingOperationIds": [],
                        },
                    )
                )
            )
            assert operation_result["accepted"] is True
            assert operation_result["document"]["nodes"][0]["id"] == "client-node"

            latest_document = dump_value(await client.get_document())
            document_ready.clear()
            await client.replace_document(
                AuthorityReplaceDocumentParams(
                    document=create_template_execution_document(),
                    context={"currentDocument": latest_document},
                )
            )
            document_ready.clear()

            step_result = dump_value(
                await client.control_runtime(
                    AuthorityControlRuntimeParams(request={"type": "graph.step"})
                )
            )
            await asyncio.wait_for(runtime_feedback_ready.wait(), timeout=2)
            await asyncio.wait_for(document_ready.wait(), timeout=2)

            assert step_result["accepted"] is True
            assert step_result["changed"] is True
            assert step_result["state"]["status"] == "idle"
            assert step_result["state"]["stepCount"] == 1
            assert any(
                node["id"] == "counter" and node["title"] == "Counter 1"
                for node in document_events[-1]["nodes"]
            )
            node_execution_events = [
                event["event"]
                for event in runtime_feedback_events
                if event["type"] == "node.execution"
            ]
            assert [event["sequence"] for event in node_execution_events] == [0, 1, 2]
            assert any(
                event["type"] == "node.state" and event["event"]["nodeId"] == "counter"
                for event in runtime_feedback_events
            )
        finally:
            await client.close()
