from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from ..core.protocol import (
    create_event_envelope,
    create_failure_envelope,
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
    authority_name: str = "python-backend-template",
    runtime: PythonAuthorityRuntime | None = None,
    logger: Any = None,
) -> FastAPI:
    app = FastAPI()
    state = AuthorityServerState(
        runtime=runtime
        or create_python_authority_runtime(authority_name=authority_name),
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
            "[python-backend]",
            f"ws connected (connections={state.connection_count})",
        )
        outbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        dispose_document = state.runtime.subscribe_document(
            lambda document: outbound_queue.put_nowait(
                create_event_envelope({"type": "document", "document": document})
            )
        )
        dispose_runtime = state.runtime.subscribe(
            lambda event: outbound_queue.put_nowait(
                create_event_envelope({"type": "runtimeFeedback", "event": event})
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
                            create_failure_envelope("invalid-json", error.msg)
                        )
                    )
                    continue

                envelope = parse_request_envelope(message)
                if envelope is None:
                    await websocket.send_text(
                        json.dumps(
                            create_failure_envelope("unknown-request", "未知 authority 请求")
                        )
                    )
                    continue

                request_id = envelope["requestId"]
                request = envelope["request"]
                action = request["action"]

                try:
                    if action == "getDocument":
                        log_info(
                            "[python-backend]",
                            f"request getDocument (connections={state.connection_count})",
                        )
                        response = {
                            "action": "getDocument",
                            "document": state.runtime.get_document(),
                        }
                    elif action == "submitOperation":
                        log_info(
                            "[python-backend]",
                            "request submitOperation:"
                            f"{request['operation']['type']} "
                            f"(connections={state.connection_count})",
                        )
                        response = {
                            "action": "submitOperation",
                            "result": state.runtime.submit_operation(request["operation"]),
                        }
                    elif action == "replaceDocument":
                        log_info(
                            "[python-backend]",
                            f"request replaceDocument (connections={state.connection_count})",
                        )
                        response = {
                            "action": "replaceDocument",
                            "document": state.runtime.replace_document(request["document"]),
                        }
                    elif action == "controlRuntime":
                        log_info(
                            "[python-backend]",
                            "request controlRuntime:"
                            f"{request['request']['type']} "
                            f"(connections={state.connection_count})",
                        )
                        response = {
                            "action": "controlRuntime",
                            "result": state.runtime.control_runtime(request["request"]),
                        }
                    else:
                        await websocket.send_text(
                            json.dumps(
                                create_failure_envelope(request_id, "未知 authority 请求")
                            )
                        )
                        continue

                    await websocket.send_text(
                        json.dumps(create_success_envelope(request_id, response))
                    )
                except Exception as error:  # pragma: no cover - demo path
                    await websocket.send_text(
                        json.dumps(
                            create_failure_envelope(request_id, str(error))
                        )
                    )
        except WebSocketDisconnect:
            pass
        finally:
            dispose_document()
            dispose_runtime()
            sender_task.cancel()
            state.connection_count = max(0, state.connection_count - 1)
            log_info(
                "[python-backend]",
                f"ws closed (connections={state.connection_count})",
            )

    return app


def main() -> None:
    host = os.environ.get("LEAFERGRAPH_PYTHON_BACKEND_HOST", "127.0.0.1")
    port = _read_env_number(os.environ.get("LEAFERGRAPH_PYTHON_BACKEND_PORT"), 5503)
    authority_name = os.environ.get(
        "LEAFERGRAPH_PYTHON_BACKEND_NAME", "python-backend-template"
    )
    app = create_authority_app(authority_name=authority_name)

    print(
        "[python-backend-template]",
        f"authority server listening on ws://{host}:{port}/authority",
    )
    print(
        "[python-backend-template]",
        f"health endpoint available at http://{host}:{port}/health",
    )
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
