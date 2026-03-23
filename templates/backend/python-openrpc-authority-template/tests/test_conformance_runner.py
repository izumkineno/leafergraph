from __future__ import annotations

import asyncio
import json
from contextlib import AsyncExitStack
from typing import Any

import httpx
import pytest
from websockets.asyncio.client import connect

from .conformance_support import (
    assert_expectation,
    expectation_matches,
    extract_response_document,
    load_json,
    load_manifest,
    load_text,
    resolve_conformance_path,
    resolve_request_placeholders,
    run_conformance_target,
    selected_conformance_levels,
)


class ConformanceWsSession:
    def __init__(self, ws_url: str) -> None:
        self.ws_url = ws_url
        self._stack = AsyncExitStack()
        self.connections: dict[str, Any] = {}
        self.notifications: dict[str, list[dict[str, Any]]] = {}
        self.current_documents: dict[str, dict[str, Any]] = {}

    async def __aenter__(self) -> "ConformanceWsSession":
        await self.open_connection("primary")
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self._stack.aclose()

    async def open_connection(self, name: str) -> None:
        websocket = await self._stack.enter_async_context(connect(self.ws_url))
        self.connections[name] = websocket
        self.notifications.setdefault(name, [])
        self.notifications[name].extend(await self._drain_pending_messages(name))

    async def _recv_json(self, name: str, *, timeout_s: float = 2.0) -> dict[str, Any]:
        message = await asyncio.wait_for(self.connections[name].recv(), timeout=timeout_s)
        if isinstance(message, bytes):
            message = message.decode("utf-8")
        return json.loads(message)

    async def _drain_pending_messages(
        self, name: str, *, first_timeout_s: float = 0.2, next_timeout_s: float = 0.05
    ) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        timeout_s = first_timeout_s
        while True:
            try:
                messages.append(await self._recv_json(name, timeout_s=timeout_s))
            except TimeoutError:
                break
            timeout_s = next_timeout_s
        return messages

    async def send_request(self, name: str, payload: Any) -> dict[str, Any]:
        if isinstance(payload, str):
            await self.connections[name].send(payload)
            return await self._recv_json(name)

        request_id = payload.get("id")
        await self.connections[name].send(json.dumps(payload))
        while True:
            message = await self._recv_json(name)
            if message.get("id") == request_id:
                document = extract_response_document(message.get("result"))
                if document is not None:
                    self.current_documents[name] = document
                return message
            self.notifications[name].append(message)

    async def fetch_current_document(self, name: str) -> dict[str, Any]:
        response = await self.send_request(
            name,
            {
                "jsonrpc": "2.0",
                "id": f"bootstrap-get-document-{name}",
                "method": "authority.getDocument",
            },
        )
        document = response["result"]
        self.current_documents[name] = document
        return document

    async def apply_preconditions(self, preconditions: list[dict[str, Any]]) -> None:
        for precondition in preconditions:
            kind = precondition["kind"]
            connection_name = precondition.get("connection", "primary")
            if kind == "openConnection":
                await self.open_connection(connection_name)
                continue
            if kind == "bootstrapBaseline":
                await self.fetch_current_document(connection_name)
                continue
            if kind == "replaceDocument":
                target_document = load_json(resolve_conformance_path(precondition["fixture"]))
                current_document = await self.fetch_current_document(connection_name)
                response = await self.send_request(
                    connection_name,
                    {
                        "jsonrpc": "2.0",
                        "id": f"precondition-replace-document-{connection_name}",
                        "method": "authority.replaceDocument",
                        "params": {
                            "document": target_document,
                            "context": {"currentDocument": current_document},
                        },
                    },
                )
                result_document = response.get("result")
                if isinstance(result_document, dict):
                    self.current_documents[connection_name] = result_document
                else:
                    self.current_documents[connection_name] = await self.fetch_current_document(
                        connection_name
                    )
                continue
            raise AssertionError(f"未知 conformance precondition: {kind}")

    async def collect_notifications(
        self,
        name: str,
        expected_fixture_paths: list[str],
        *,
        timeout_s: float = 2.5,
    ) -> list[dict[str, Any]]:
        notifications = self.notifications[name]
        expectation_paths = [
            resolve_conformance_path(relative_path) for relative_path in expected_fixture_paths
        ]
        if self._all_expectations_satisfied(notifications, expectation_paths):
            return notifications

        deadline = asyncio.get_event_loop().time() + timeout_s
        while asyncio.get_event_loop().time() < deadline:
            remaining = max(0.01, deadline - asyncio.get_event_loop().time())
            message = await self._recv_json(name, timeout_s=min(remaining, 0.5))
            notifications.append(message)
            if self._all_expectations_satisfied(notifications, expectation_paths):
                return notifications

        missing = [
            str(path.name)
            for path in expectation_paths
            if not any(expectation_matches(item, path) for item in notifications)
        ]
        raise AssertionError(f"{name} 连接未在时限内收到期望 notification: {missing}")

    @staticmethod
    def _all_expectations_satisfied(
        notifications: list[dict[str, Any]], expectation_paths: list[Any]
    ) -> bool:
        return all(
            any(expectation_matches(notification, path) for notification in notifications)
            for path in expectation_paths
        )


def load_scenarios(level: str) -> list[dict[str, Any]]:
    manifest = load_manifest()
    return [
        scenario for scenario in manifest["scenarios"] if scenario["level"] == level
    ]


def notification_connection_for_scenario(scenario_id: str) -> str:
    if scenario_id in {
        "document.full_sync.observer_notification",
        "document_diff.observer_baseline",
        "document_full_fallback.on_missing_baseline",
    }:
        return "observer"
    return "primary"


async def execute_http_scenario(target: Any, scenario: dict[str, Any]) -> None:
    expected_response_path = resolve_conformance_path(scenario["expectedResponseFixture"])
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{target.http_base_url}/health")
    assert response.status_code == 200
    assert_expectation(response.json(), expected_response_path)


async def execute_ws_scenario(target: Any, scenario: dict[str, Any]) -> None:
    async with ConformanceWsSession(target.ws_url) as session:
        await session.apply_preconditions(scenario["preconditions"])

        response = None
        request_fixture = scenario["requestFixture"]
        if request_fixture is not None:
            fixture_path = resolve_conformance_path(request_fixture)
            if fixture_path.suffix == ".txt":
                response = await session.send_request("primary", load_text(fixture_path))
            else:
                request_payload = load_json(fixture_path)
                request_payload = resolve_request_placeholders(
                    request_payload,
                    current_document=session.current_documents.get("primary"),
                )
                response = await session.send_request("primary", request_payload)

        expected_response_fixture = scenario["expectedResponseFixture"]
        if expected_response_fixture is not None:
            assert response is not None
            assert_expectation(response, resolve_conformance_path(expected_response_fixture))

        if scenario["expectedNotificationFixtures"]:
            await session.collect_notifications(
                notification_connection_for_scenario(scenario["id"]),
                scenario["expectedNotificationFixtures"],
            )


@pytest.mark.asyncio
async def test_core_conformance_against_authority_target() -> None:
    if "core" not in selected_conformance_levels():
        pytest.skip("当前 conformance level 未启用 core")

    async with run_conformance_target() as target:
        for scenario in load_scenarios("core"):
            if scenario["channel"] == "http":
                await execute_http_scenario(target, scenario)
            else:
                await execute_ws_scenario(target, scenario)


@pytest.mark.asyncio
async def test_advanced_conformance_against_authority_target() -> None:
    if "advanced" not in selected_conformance_levels():
        pytest.skip("当前 conformance level 未启用 advanced")

    async with run_conformance_target() as target:
        for scenario in load_scenarios("advanced"):
            await execute_ws_scenario(target, scenario)
