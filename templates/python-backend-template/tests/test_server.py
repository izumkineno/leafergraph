from __future__ import annotations

import json

from fastapi.testclient import TestClient

from leafergraph_python_backend_control_template.transport.server import (
    create_authority_app,
)


def test_server_should_expose_health_and_websocket_contract() -> None:
    app = create_authority_app(authority_name="python-server-test")

    with TestClient(app) as client:
        assert client.get("/health").json() == {
            "ok": True,
            "documentId": "node-authority-doc",
            "revision": "1",
            "connectionCount": 0,
        }

        with client.websocket_connect("/authority") as websocket:
            assert client.get("/health").json()["connectionCount"] == 1
            initial_event = json.loads(websocket.receive_text())
            assert initial_event["channel"] == "authority.event"
            assert initial_event["event"]["type"] == "frontendBundles.sync"
            assert initial_event["event"]["event"]["type"] == "frontendBundles.sync"
            assert initial_event["event"]["event"]["mode"] == "full"

            websocket.send_text(
                json.dumps(
                    {
                        "channel": "authority.request",
                        "requestId": "get-doc-1",
                        "request": {"action": "getDocument"},
                    }
                )
            )
            response = json.loads(websocket.receive_text())
            assert response["channel"] == "authority.response"
            assert response["ok"] is True
            assert response["response"]["action"] == "getDocument"
            assert response["response"]["document"]["documentId"] == "node-authority-doc"

        assert client.get("/health").json()["connectionCount"] == 0
