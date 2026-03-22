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
    AUTHORITY_SUBMIT_OPERATION_METHOD,
)
from leafergraph_python_openrpc_authority_template._generated.notifications import (
    AUTHORITY_DOCUMENT_DIFF_NOTIFICATION,
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


def create_node_create_operation(node_id: str, timestamp: int) -> dict[str, Any]:
    return {
        "operationId": f"create-{node_id}",
        "timestamp": timestamp,
        "source": "pytest",
        "type": "node.create",
        "input": {
            "id": node_id,
            "type": "demo/node",
            "x": timestamp * 10,
            "y": timestamp * 20,
        },
    }


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
        def handle_request(self, method: str, params: Any, **_: Any) -> Any:
            raise RuntimeError("boom")

    client = TestClient(create_authority_app(service=BrokenService()))

    with client.websocket_connect("/authority") as websocket:
        receive_initial_snapshot(websocket)
        websocket.send_json(request_payload("9", AUTHORITY_GET_DOCUMENT_METHOD))
        response = websocket.receive_json()

    assert response["error"]["code"] == -32603
    assert response["error"]["message"] == "boom"


def test_websocket_serializes_diff_baselines_and_skips_same_connection_echo() -> None:
    client = TestClient(create_authority_app())

    with (
        client.websocket_connect("/authority") as origin,
        client.websocket_connect("/authority") as observer,
    ):
        receive_initial_snapshot(origin)
        receive_initial_snapshot(observer)

        origin.send_json(request_payload("origin-get", AUTHORITY_GET_DOCUMENT_METHOD))
        origin_document = origin.receive_json()["result"]

        observer.send_json(request_payload("observer-get", AUTHORITY_GET_DOCUMENT_METHOD))
        observer_document = observer.receive_json()["result"]

        assert origin_document["revision"] == 0
        assert observer_document["revision"] == 0

        observed_diffs: list[dict[str, Any]] = []
        for index, node_id in enumerate(["node-a", "node-b", "node-c"], start=1):
            origin.send_json(
                request_payload(
                    f"submit-{index}",
                    AUTHORITY_SUBMIT_OPERATION_METHOD,
                    {
                        "operation": create_node_create_operation(node_id, index),
                        "context": {
                            "currentDocument": origin_document,
                            "pendingOperationIds": [],
                        },
                    },
                )
            )
            submit_response = origin.receive_json()
            assert submit_response["id"] == f"submit-{index}"
            assert submit_response["result"]["accepted"] is True
            assert submit_response["result"]["changed"] is True
            assert submit_response["result"]["document"]["revision"] == index
            origin_document = submit_response["result"]["document"]

            if index == 1:
                origin.send_json(
                    request_payload("origin-check", AUTHORITY_GET_DOCUMENT_METHOD)
                )
                follow_up_response = origin.receive_json()
                assert follow_up_response["id"] == "origin-check"
                assert follow_up_response["result"]["revision"] == 1
                origin_document = follow_up_response["result"]

            observer_event = observer.receive_json()
            assert observer_event["method"] == AUTHORITY_DOCUMENT_DIFF_NOTIFICATION
            observed_diffs.append(observer_event["params"])

        assert [diff["baseRevision"] for diff in observed_diffs] == [0, 1, 2]
        assert [diff["revision"] for diff in observed_diffs] == [1, 2, 3]
        assert all(
            any(operation["type"] == "node.create" for operation in diff["operations"])
            for diff in observed_diffs
        )
