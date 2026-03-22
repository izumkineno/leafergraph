from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..core.bootstrap import ensure_generated
from ..core.jsonrpc import (
    AUTHORITY_JSON_RPC_ERROR_CODES,
    JsonRpcRequestEnvelope,
    create_error_envelope,
    create_success_envelope,
)
from ..core.protocol import DEFAULT_AUTHORITY_NAME
from ..core.service import AuthorityInvalidParamsError, OpenRpcAuthorityService
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

from .._generated.methods import ALL_AUTHORITY_METHODS


def _read_env_number(value: str | None, fallback: int) -> int:
    if not value:
        return fallback


def _read_env_value(*names: str, fallback: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


@dataclass
class AuthorityServerState:
    service: OpenRpcAuthorityService
    logger: Any
    connection_count: int = 0


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
        log_info(
            "[python-openrpc-authority-template]",
            f"ws connected (connections={state.connection_count})",
        )
        outbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        dispose_document = state.service.subscribe_document(outbound_queue.put_nowait)
        dispose_runtime = state.service.subscribe_runtime_feedback(
            outbound_queue.put_nowait
        )
        dispose_frontend_bundles = state.service.subscribe_frontend_bundles(
            outbound_queue.put_nowait
        )
        outbound_queue.put_nowait(
            state.service.create_frontend_bundles_snapshot_notification()
        )

        async def sender() -> None:
            while True:
                envelope = await outbound_queue.get()
                await websocket.send_text(json.dumps(envelope))

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

                await websocket.send_text(
                    json.dumps(
                        create_success_envelope(request_id, response.dump())
                    )
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
