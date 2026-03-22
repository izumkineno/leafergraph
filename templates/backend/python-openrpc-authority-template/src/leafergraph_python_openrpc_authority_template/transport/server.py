from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..core.bootstrap import ensure_generated
from ..core.document_diff import build_graph_document_diff
from ..core.document_store import clone_document
from ..core.jsonrpc import (
    AUTHORITY_JSON_RPC_ERROR_CODES,
    JsonRpcRequestEnvelope,
    create_error_envelope,
    create_success_envelope,
)
from ..core.protocol import DEFAULT_AUTHORITY_NAME
from ..core.service import (
    AuthorityInvalidParamsError,
    DocumentPayloadEvent,
    OpenRpcAuthorityService,
)
from ..core.protocol import (
    AUTHORITY_HEALTH_PATH,
    AUTHORITY_WS_PATH,
    DEFAULT_AUTHORITY_HOST,
    DEFAULT_AUTHORITY_PORT,
    LEGACY_BACKEND_HOST_ENV,
    LEGACY_BACKEND_NAME_ENV,
    LEGACY_BACKEND_PORT_ENV,
    OPENRPC_BACKEND_HOST_ENV,
    OPENRPC_BACKEND_NAME_ENV,
    OPENRPC_BACKEND_PORT_ENV,
)

ensure_generated()

from .._generated.methods import (
    ALL_AUTHORITY_METHODS,
)


def _read_env_number(value: str | None, fallback: int) -> int:
    if not value:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


def _read_env_value(*names: str, fallback: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return fallback


@dataclass
class OutboundMessage:
    envelope: dict[str, Any]
    baseline_document: dict[str, Any] | None = None


@dataclass
class AuthorityServerState:
    service: OpenRpcAuthorityService
    logger: Any
    connection_count: int = 0
    connection_sequence: int = 0


def _extract_response_document(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    if "documentId" in value and "revision" in value:
        return value
    document = value.get("document")
    if isinstance(document, dict) and "documentId" in document and "revision" in document:
        return document
    return None


def create_authority_app(
    *,
    authority_name: str = DEFAULT_AUTHORITY_NAME,
    service: OpenRpcAuthorityService | None = None,
    logger: Any = None,
) -> FastAPI:
    app = FastAPI()
    state = AuthorityServerState(
        service=service or OpenRpcAuthorityService(authority_name=authority_name),
        logger=logger or print,
    )
    app.state.authority_server_state = state

    def log_info(*args: Any) -> None:
        if hasattr(state.logger, "info"):
            state.logger.info(*args)
            return
        state.logger(*args)

    @app.get(AUTHORITY_HEALTH_PATH)
    async def health() -> dict[str, Any]:
        document = state.service.document_store.get_document()
        return {
            "ok": True,
            "authorityName": state.service.authority_name,
            "documentId": document["documentId"],
            "revision": document["revision"],
            "connectionCount": state.connection_count,
        }

    @app.websocket(AUTHORITY_WS_PATH)
    async def authority(websocket: WebSocket) -> None:
        await websocket.accept()
        state.connection_count += 1
        state.connection_sequence += 1
        connection_id = f"ws-{state.connection_sequence}"
        log_info(
            "[python-openrpc-authority-template]",
            f"ws connected (connections={state.connection_count})",
        )
        outbound_queue: asyncio.Queue[OutboundMessage] = asyncio.Queue()
        sent_baseline_document: dict[str, Any] | None = None
        queued_baseline_document: dict[str, Any] | None = None

        def mark_sent_baseline(document: dict[str, Any]) -> None:
            nonlocal sent_baseline_document
            sent_baseline_document = clone_document(document)

        def mark_queued_baseline(document: dict[str, Any]) -> None:
            nonlocal queued_baseline_document
            queued_baseline_document = clone_document(document)

        def queue_outbound_message(
            envelope: dict[str, Any],
            *,
            baseline_document: dict[str, Any] | None = None,
        ) -> None:
            if baseline_document is not None:
                mark_queued_baseline(baseline_document)
            outbound_queue.put_nowait(
                OutboundMessage(
                    envelope=envelope,
                    baseline_document=baseline_document,
                )
            )

        def queue_full_document(document: dict[str, Any]) -> None:
            queue_outbound_message(
                state.service.create_document_notification(document),
                baseline_document=document,
            )

        def queue_document_update(event: DocumentPayloadEvent) -> None:
            if (
                event.origin_connection_id == connection_id
                and event.response_document_delivered
            ):
                return

            baseline_document = queued_baseline_document or sent_baseline_document
            if baseline_document is None:
                queue_full_document(event.document)
                return

            diff_result = build_graph_document_diff(
                baseline_document,
                event.document,
                emitted_at=int(time.time() * 1000),
            )
            if not diff_result.can_diff or diff_result.diff is None:
                queue_full_document(event.document)
                return

            queue_outbound_message(
                state.service.create_document_diff_notification(diff_result.diff),
                baseline_document=event.document,
            )

        dispose_document = state.service.subscribe_document_payload(queue_document_update)
        dispose_runtime = state.service.subscribe_runtime_feedback(
            lambda envelope: queue_outbound_message(envelope)
        )
        dispose_frontend_bundles = state.service.subscribe_frontend_bundles(
            lambda envelope: queue_outbound_message(envelope)
        )
        queue_outbound_message(
            state.service.create_frontend_bundles_snapshot_notification()
        )

        async def sender() -> None:
            while True:
                message = await outbound_queue.get()
                await websocket.send_text(json.dumps(message.envelope))
                if message.baseline_document is not None:
                    mark_sent_baseline(message.baseline_document)

        sender_task = asyncio.create_task(sender())

        try:
            while True:
                payload = await websocket.receive_text()
                try:
                    message = json.loads(payload)
                except json.JSONDecodeError as error:
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                None,
                                AUTHORITY_JSON_RPC_ERROR_CODES["parse_error"],
                                error.msg,
                            )
                        )
                    )
                    continue

                try:
                    envelope = JsonRpcRequestEnvelope.model_validate(message)
                except ValidationError as error:
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                None,
                                AUTHORITY_JSON_RPC_ERROR_CODES["invalid_request"],
                                "非法 JSON-RPC request",
                                error.errors(include_url=False),
                            )
                        )
                    )
                    continue

                request_id = envelope.id
                if envelope.method not in ALL_AUTHORITY_METHODS:
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                request_id,
                                AUTHORITY_JSON_RPC_ERROR_CODES["method_not_found"],
                                f"未知 method: {envelope.method}",
                            )
                        )
                    )
                    continue

                try:
                    response = state.service.handle_request(
                        envelope.method,
                        envelope.params,
                        origin_connection_id=connection_id,
                    )
                except AuthorityInvalidParamsError as error:
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                request_id,
                                AUTHORITY_JSON_RPC_ERROR_CODES["invalid_params"],
                                str(error),
                                error.details,
                            )
                        )
                    )
                    continue
                except Exception as error:  # pragma: no cover - demo path
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                request_id,
                                AUTHORITY_JSON_RPC_ERROR_CODES["internal_error"],
                                str(error),
                            )
                        )
                    )
                    continue

                dumped_result = response.dump()
                queue_outbound_message(
                    create_success_envelope(request_id, dumped_result),
                    baseline_document=_extract_response_document(dumped_result),
                )
        except WebSocketDisconnect:
            pass
        finally:
            dispose_document()
            dispose_runtime()
            dispose_frontend_bundles()
            sender_task.cancel()
            state.connection_count = max(0, state.connection_count - 1)
            log_info(
                "[python-openrpc-authority-template]",
                f"ws closed (connections={state.connection_count})",
            )

    return app


def main() -> None:
    host = _read_env_value(
        OPENRPC_BACKEND_HOST_ENV,
        LEGACY_BACKEND_HOST_ENV,
        fallback=DEFAULT_AUTHORITY_HOST,
    )
    port = _read_env_number(
        os.environ.get(OPENRPC_BACKEND_PORT_ENV)
        or os.environ.get(LEGACY_BACKEND_PORT_ENV),
        DEFAULT_AUTHORITY_PORT,
    )
    authority_name = _read_env_value(
        OPENRPC_BACKEND_NAME_ENV,
        LEGACY_BACKEND_NAME_ENV,
        fallback=DEFAULT_AUTHORITY_NAME,
    )
    app = create_authority_app(authority_name=authority_name)

    print(
        "[python-openrpc-authority-template]",
        f"authority server listening on ws://{host}:{port}{AUTHORITY_WS_PATH}",
    )
    print(
        "[python-openrpc-authority-template]",
        f"health endpoint available at http://{host}:{port}{AUTHORITY_HEALTH_PATH}",
    )
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
