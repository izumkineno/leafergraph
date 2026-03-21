from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from ..core.protocol import (
    AUTHORITY_CONTROL_RUNTIME_METHOD,
    AUTHORITY_GET_DOCUMENT_METHOD,
    AUTHORITY_JSON_RPC_ERROR_CODES,
    AUTHORITY_JSON_RPC_VERSION,
    AUTHORITY_REPLACE_DOCUMENT_METHOD,
    AUTHORITY_RPC_DISCOVER_METHOD,
    AUTHORITY_SUBMIT_OPERATION_METHOD,
    create_discover_result,
    create_document_notification,
    create_error_envelope,
    create_frontend_bundles_sync_notification,
    create_runtime_feedback_notification,
    create_success_envelope,
    parse_request_envelope,
)
from ..core.runtime import PythonAuthorityRuntime, create_python_authority_runtime


def _read_env_number(value: str | None, fallback: int) -> int:
    if not value:
        return fallback
    try:
        return int(value)
    except ValueError:
        return fallback


@dataclass
class AuthorityServerState:
    runtime: PythonAuthorityRuntime
    logger: Any
    connection_count: int = 0


def create_authority_app(
    *,
    authority_name: str = "python-authority-template",
    runtime: PythonAuthorityRuntime | None = None,
    logger: Any = None,
) -> FastAPI:
    app = FastAPI()
    state = AuthorityServerState(
        runtime=runtime
        or create_python_authority_runtime(
            authority_name=authority_name,
            logger=logger,
        ),
        logger=logger or print,
    )
    app.state.authority_server_state = state

    def log_info(*args: Any) -> None:
        if hasattr(state.logger, "info"):
            state.logger.info(*args)
            return
        state.logger(*args)

    @app.get("/health")
    async def health() -> dict[str, Any]:
        document = state.runtime.get_document()
        return {
            "ok": True,
            "documentId": document["documentId"],
            "revision": document["revision"],
            "connectionCount": state.connection_count,
        }

    @app.websocket("/authority")
    async def authority(websocket: WebSocket) -> None:
        await websocket.accept()
        state.connection_count += 1
        log_info(
            "[python-authority-template]",
            f"ws connected (connections={state.connection_count})",
        )
        outbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        dispose_document = state.runtime.subscribe_document(
            lambda document: outbound_queue.put_nowait(
                create_document_notification(document)
            )
        )
        dispose_runtime = state.runtime.subscribe(
            lambda event: outbound_queue.put_nowait(
                create_runtime_feedback_notification(event)
            )
        )
        dispose_frontend_bundles = state.runtime.subscribe_frontend_bundles(
            lambda event: outbound_queue.put_nowait(
                create_frontend_bundles_sync_notification(event)
            )
        )
        outbound_queue.put_nowait(
            create_frontend_bundles_sync_notification(
                state.runtime.get_frontend_bundles_snapshot()
            )
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

                envelope = parse_request_envelope(message)
                if envelope is None:
                    await websocket.send_text(
                        json.dumps(
                            create_error_envelope(
                                None,
                                AUTHORITY_JSON_RPC_ERROR_CODES["invalid_request"],
                                "非法 JSON-RPC request",
                            )
                        )
                    )
                    continue

                request_id = envelope["id"]
                method = envelope["method"]
                params = envelope.get("params")

                try:
                    if method == AUTHORITY_RPC_DISCOVER_METHOD:
                        response = create_discover_result()
                    elif method == AUTHORITY_GET_DOCUMENT_METHOD:
                        log_info(
                            "[python-authority-template]",
                            f"request getDocument (connections={state.connection_count})",
                        )
                        response = state.runtime.get_document()
                    elif method == AUTHORITY_SUBMIT_OPERATION_METHOD:
                        if not isinstance(params, dict) or "operation" not in params:
                            await websocket.send_text(
                                json.dumps(
                                    create_error_envelope(
                                        request_id,
                                        AUTHORITY_JSON_RPC_ERROR_CODES["invalid_params"],
                                        "submitOperation params 非法",
                                    )
                                )
                            )
                            continue
                        log_info(
                            "[python-authority-template]",
                            "request submitOperation:"
                            f"{params['operation'].get('type', 'unknown')} "
                            f"(connections={state.connection_count})",
                        )
                        response = state.runtime.submit_operation(params["operation"])
                    elif method == AUTHORITY_REPLACE_DOCUMENT_METHOD:
                        if not isinstance(params, dict) or "document" not in params:
                            await websocket.send_text(
                                json.dumps(
                                    create_error_envelope(
                                        request_id,
                                        AUTHORITY_JSON_RPC_ERROR_CODES["invalid_params"],
                                        "replaceDocument params 非法",
                                    )
                                )
                            )
                            continue
                        log_info(
                            "[python-authority-template]",
                            f"request replaceDocument (connections={state.connection_count})",
                        )
                        response = state.runtime.replace_document(params["document"])
                    elif method == AUTHORITY_CONTROL_RUNTIME_METHOD:
                        if not isinstance(params, dict) or "request" not in params:
                            await websocket.send_text(
                                json.dumps(
                                    create_error_envelope(
                                        request_id,
                                        AUTHORITY_JSON_RPC_ERROR_CODES["invalid_params"],
                                        "controlRuntime params 非法",
                                    )
                                )
                            )
                            continue
                        log_info(
                            "[python-authority-template]",
                            "request controlRuntime:"
                            f"{params['request'].get('type', 'unknown')} "
                            f"(connections={state.connection_count})",
                        )
                        response = state.runtime.control_runtime(params["request"])
                    else:
                        await websocket.send_text(
                            json.dumps(
                                create_error_envelope(
                                    request_id,
                                    AUTHORITY_JSON_RPC_ERROR_CODES["method_not_found"],
                                    f"未知 method: {method}",
                                )
                            )
                        )
                        continue

                    await websocket.send_text(
                        json.dumps(create_success_envelope(request_id, response))
                    )
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
        except WebSocketDisconnect:
            pass
        finally:
            dispose_document()
            dispose_runtime()
            dispose_frontend_bundles()
            sender_task.cancel()
            state.connection_count = max(0, state.connection_count - 1)
            log_info(
                "[python-authority-template]",
                f"ws closed (connections={state.connection_count})",
            )

    return app


def main() -> None:
    host = os.environ.get("LEAFERGRAPH_PYTHON_BACKEND_HOST", "127.0.0.1")
    port = _read_env_number(os.environ.get("LEAFERGRAPH_PYTHON_BACKEND_PORT"), 5503)
    authority_name = os.environ.get(
        "LEAFERGRAPH_PYTHON_BACKEND_NAME", "python-authority-template"
    )
    app = create_authority_app(authority_name=authority_name)

    print(
        "[python-authority-template]",
        f"authority server listening on ws://{host}:{port}/authority",
    )
    print(
        "[python-authority-template]",
        f"health endpoint available at http://{host}:{port}/health",
    )
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
