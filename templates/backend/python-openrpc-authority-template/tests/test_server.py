from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from leafergraph_python_openrpc_authority_template.core.service import (
    OpenRpcAuthorityService,
)
from leafergraph_python_openrpc_authority_template.transport.server import (
    create_authority_app,
)
from leafergraph_python_openrpc_authority_template._generated.methods import (
    AUTHORITY_CONTROL_RUNTIME_METHOD,
    AUTHORITY_GET_DOCUMENT_METHOD,
)
from leafergraph_python_openrpc_authority_template._generated.notifications import (
    AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION,
)


def request_payload(
    request_id: str,
    method: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    return payload


def receive_initial_snapshot(websocket: Any) -> dict[str, Any]:
    payload = websocket.receive_json()
    assert payload["method"] == AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION
    assert payload["params"]["mode"] == "full"
    assert payload["params"]["packages"] == []
    return payload


def test_health_endpoint_reflects_document_store() -> None:
    client = TestClient(create_authority_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["documentId"] == "python-openrpc-document"


def test_websocket_first_packet_is_empty_frontend_bundle_snapshot() -> None:
    client = TestClient(create_authority_app())

    with client.websocket_connect("/authority") as websocket:
        receive_initial_snapshot(websocket)


def test_websocket_successfully_handles_get_document() -> None:
    client = TestClient(create_authority_app())

    with client.websocket_connect("/authority") as websocket:
        receive_initial_snapshot(websocket)
        websocket.send_json(request_payload("1", AUTHORITY_GET_DOCUMENT_METHOD))
        response = websocket.receive_json()

    assert response["result"]["documentId"] == "python-openrpc-document"
    assert response["result"]["revision"] == 0


def test_websocket_returns_standard_error_codes() -> None:
    client = TestClient(create_authority_app())

    with client.websocket_connect("/authority") as websocket:
        receive_initial_snapshot(websocket)

        websocket.send_text("{")
        parse_error = websocket.receive_json()
        assert parse_error["error"]["code"] == -32700

        websocket.send_json({"jsonrpc": "2.0", "method": AUTHORITY_GET_DOCUMENT_METHOD})
        invalid_request = websocket.receive_json()
        assert invalid_request["error"]["code"] == -32600

        websocket.send_json(request_payload("2", "authority.unknown"))
        method_not_found = websocket.receive_json()
        assert method_not_found["error"]["code"] == -32601

        websocket.send_json(
            request_payload(
                "3",
                AUTHORITY_CONTROL_RUNTIME_METHOD,
                {"request": {"type": "graph.play", "unexpected": True}},
            )
        )
        invalid_params = websocket.receive_json()
        assert invalid_params["error"]["code"] == -32602


def test_websocket_returns_internal_error_for_service_failure() -> None:
    class BrokenService(OpenRpcAuthorityService):
        def handle_request(self, method: str, params: Any) -> Any:
            raise RuntimeError("boom")

    client = TestClient(create_authority_app(service=BrokenService()))

    with client.websocket_connect("/authority") as websocket:
        receive_initial_snapshot(websocket)
        websocket.send_json(request_payload("9", AUTHORITY_GET_DOCUMENT_METHOD))
        response = websocket.receive_json()

    assert response["error"]["code"] == -32603
    assert response["error"]["message"] == "boom"
