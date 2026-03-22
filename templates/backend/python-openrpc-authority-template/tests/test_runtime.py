from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from leafergraph_python_openrpc_authority_template.core.document_store import (
    InMemoryDocumentStore,
)
from leafergraph_python_openrpc_authority_template.core.service import (
    OpenRpcAuthorityService,
)
from leafergraph_python_openrpc_authority_template._generated.methods import (
    AUTHORITY_CONTROL_RUNTIME_METHOD,
    AUTHORITY_GET_DOCUMENT_METHOD,
    AUTHORITY_REPLACE_DOCUMENT_METHOD,
    AUTHORITY_SUBMIT_OPERATION_METHOD,
)

from .runtime_fixtures import (
    create_demo_worker_root_chain_document,
    create_template_execution_document,
    create_timer_execution_document,
)


def dump_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    return value


def current_document(service: OpenRpcAuthorityService) -> dict[str, Any]:
    return service.handle_request(AUTHORITY_GET_DOCUMENT_METHOD, None).dump()


def replace_context(service: OpenRpcAuthorityService) -> dict[str, Any]:
    return {"currentDocument": current_document(service)}


def operation_context(service: OpenRpcAuthorityService) -> dict[str, Any]:
    return {
        "currentDocument": current_document(service),
        "pendingOperationIds": [],
    }


def submit_operation(
    service: OpenRpcAuthorityService,
    operation: dict[str, Any],
) -> dict[str, Any]:
    return dump_value(
        service.handle_request(
            AUTHORITY_SUBMIT_OPERATION_METHOD,
            {
                "operation": operation,
                "context": operation_context(service),
            },
        ).dump()
    )


def wait_for_predicate(
    predicate: Callable[[], bool],
    *,
    timeout_s: float = 0.5,
    interval_s: float = 0.01,
) -> None:
    async def _wait() -> None:
        elapsed = 0.0
        while elapsed < timeout_s:
            if predicate():
                return
            await asyncio.sleep(interval_s)
            elapsed += interval_s
        raise AssertionError("等待条件达成超时")

    asyncio.get_event_loop().run_until_complete(_wait())


def test_replace_document_only_on_real_change() -> None:
    service = OpenRpcAuthorityService()
    original = current_document(service)

    unchanged = service.handle_request(
        AUTHORITY_REPLACE_DOCUMENT_METHOD,
        {
            "document": {**original, "revision": 999},
            "context": replace_context(service),
        },
    ).dump()

    assert unchanged is None
    assert current_document(service)["revision"] == 0

    changed = dump_value(
        service.handle_request(
            AUTHORITY_REPLACE_DOCUMENT_METHOD,
            {
                "document": {**original, "appKind": "demo-app"},
                "context": replace_context(service),
            },
        ).dump()
    )

    assert changed["appKind"] == "demo-app"
    assert changed["revision"] == 1


def test_document_update_operation_supports_optional_fields() -> None:
    service = OpenRpcAuthorityService()

    result = submit_operation(
        service,
        {
            "operationId": "op-document-update",
            "timestamp": 1,
            "source": "pytest",
            "type": "document.update",
            "input": {
                "appKind": "updated-app",
                "meta": {"mode": "test"},
                "capabilityProfile": {"id": "default", "features": ["runtime"]},
            },
        },
    )

    assert result["accepted"] is True
    assert result["changed"] is True
    assert result["document"]["appKind"] == "updated-app"
    assert result["document"]["meta"] == {"mode": "test"}
    assert result["document"]["capabilityProfile"]["id"] == "default"


def test_node_lifecycle_operations_cover_create_update_move_resize_remove() -> None:
    service = OpenRpcAuthorityService()

    created = submit_operation(
        service,
        {
            "operationId": "op-node-create",
            "timestamp": 1,
            "source": "pytest",
            "type": "node.create",
            "input": {
                "id": "node-a",
                "type": "demo/timer",
                "title": "Timer",
                "x": 10,
                "y": 20,
                "width": 120,
                "height": 60,
                "inputs": ["in"],
                "outputs": [{"name": "out"}],
                "properties": {"intervalMs": 100},
            },
        },
    )

    assert created["document"]["nodes"][0]["inputs"] == [{"name": "in"}]
    assert created["document"]["nodes"][0]["outputs"] == [{"name": "out"}]

    renamed = submit_operation(
        service,
        {
            "operationId": "op-node-rename",
            "timestamp": 2,
            "source": "pytest",
            "type": "node.update",
            "nodeId": "node-a",
            "input": {
                "id": "node-renamed",
                "title": "Renamed",
            },
        },
    )

    assert renamed["document"]["nodes"][0]["id"] == "node-renamed"
    assert renamed["document"]["nodes"][0]["title"] == "Renamed"

    moved = submit_operation(
        service,
        {
            "operationId": "op-node-move",
            "timestamp": 3,
            "source": "pytest",
            "type": "node.move",
            "nodeId": "node-renamed",
            "input": {"x": 40, "y": 80},
        },
    )

    assert moved["document"]["nodes"][0]["layout"]["x"] == 40
    assert moved["document"]["nodes"][0]["layout"]["y"] == 80

    resized = submit_operation(
        service,
        {
            "operationId": "op-node-resize",
            "timestamp": 4,
            "source": "pytest",
            "type": "node.resize",
            "nodeId": "node-renamed",
            "input": {"width": 180, "height": 96},
        },
    )

    assert resized["document"]["nodes"][0]["layout"]["width"] == 180
    assert resized["document"]["nodes"][0]["layout"]["height"] == 96

    removed = submit_operation(
        service,
        {
            "operationId": "op-node-remove",
            "timestamp": 5,
            "source": "pytest",
            "type": "node.remove",
            "nodeId": "node-renamed",
        },
    )

    assert removed["document"]["nodes"] == []


def test_link_lifecycle_operations_cover_create_reconnect_remove_and_node_rename_projection() -> None:
    service = OpenRpcAuthorityService()

    submit_operation(
        service,
        {
            "operationId": "op-create-a",
            "timestamp": 1,
            "source": "pytest",
            "type": "node.create",
            "input": {"id": "node-a", "type": "demo/a", "x": 0, "y": 0},
        },
    )
    submit_operation(
        service,
        {
            "operationId": "op-create-b",
            "timestamp": 2,
            "source": "pytest",
            "type": "node.create",
            "input": {"id": "node-b", "type": "demo/b", "x": 100, "y": 0},
        },
    )
    submit_operation(
        service,
        {
            "operationId": "op-create-c",
            "timestamp": 3,
            "source": "pytest",
            "type": "node.create",
            "input": {"id": "node-c", "type": "demo/c", "x": 200, "y": 0},
        },
    )

    created_link = submit_operation(
        service,
        {
            "operationId": "op-link-create",
            "timestamp": 4,
            "source": "pytest",
            "type": "link.create",
            "input": {
                "id": "link-a-b",
                "source": {"nodeId": "node-a", "slot": 0},
                "target": {"nodeId": "node-b", "slot": 0},
            },
        },
    )

    assert created_link["document"]["links"][0]["id"] == "link-a-b"

    renamed_node = submit_operation(
        service,
        {
            "operationId": "op-node-rename-link",
            "timestamp": 5,
            "source": "pytest",
            "type": "node.update",
            "nodeId": "node-a",
            "input": {"id": "node-a-2"},
        },
    )

    assert renamed_node["document"]["links"][0]["source"]["nodeId"] == "node-a-2"

    reconnected = submit_operation(
        service,
        {
            "operationId": "op-link-reconnect",
            "timestamp": 6,
            "source": "pytest",
            "type": "link.reconnect",
            "linkId": "link-a-b",
            "input": {
                "target": {"nodeId": "node-c", "slot": 1},
            },
        },
    )

    assert reconnected["document"]["links"][0]["target"]["nodeId"] == "node-c"
    assert reconnected["document"]["links"][0]["target"]["slot"] == 1

    removed = submit_operation(
        service,
        {
            "operationId": "op-link-remove",
            "timestamp": 7,
            "source": "pytest",
            "type": "link.remove",
            "linkId": "link-a-b",
        },
    )

    assert removed["document"]["links"] == []


def test_submit_operation_rejects_missing_entities() -> None:
    service = OpenRpcAuthorityService()

    missing_node = submit_operation(
        service,
        {
            "operationId": "op-missing-node",
            "timestamp": 1,
            "source": "pytest",
            "type": "node.move",
            "nodeId": "missing-node",
            "input": {"x": 1, "y": 2},
        },
    )

    assert missing_node["accepted"] is False
    assert missing_node["changed"] is False
    assert "节点不存在" in missing_node["reason"]

    missing_link = submit_operation(
        service,
        {
            "operationId": "op-missing-link",
            "timestamp": 2,
            "source": "pytest",
            "type": "link.create",
            "input": {
                "source": {"nodeId": "missing-a"},
                "target": {"nodeId": "missing-b"},
            },
        },
    )

    assert missing_link["accepted"] is False
    assert missing_link["changed"] is False
    assert "不存在" in missing_link["reason"]


def test_graph_step_runs_root_chain_without_on_play_entry() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(create_demo_worker_root_chain_document())
    )
    runtime_notifications: list[dict[str, Any]] = []
    dispose = service.subscribe_runtime_feedback(runtime_notifications.append)

    result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.step"}},
        ).dump()
    )
    dispose()

    assert result["accepted"] is True
    assert result["changed"] is True
    assert result["state"]["status"] == "idle"
    assert result["state"]["stepCount"] == 1

    node_execution_events = [
        envelope["params"]["event"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "node.execution"
    ]
    assert [event["nodeId"] for event in node_execution_events] == ["node-1", "node-2"]
    assert [event["sequence"] for event in node_execution_events] == [0, 1]
    assert any(
        envelope["params"]["type"] == "link.propagation"
        and envelope["params"]["event"]["linkId"] == "link-1"
        for envelope in runtime_notifications
    )


def test_node_play_can_directly_start_from_selected_node() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(create_template_execution_document())
    )

    result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "node.play", "nodeId": "counter"}},
        ).dump()
    )

    assert result["accepted"] is True
    assert result["changed"] is True
    document = current_document(service)
    counter_node = next(node for node in document["nodes"] if node["id"] == "counter")
    display_node = next(node for node in document["nodes"] if node["id"] == "display")
    assert counter_node["title"] == "Counter 1"
    assert counter_node["properties"]["count"] == 1
    assert display_node["title"] == "Display 1"
    assert display_node["properties"]["lastValue"] == 1


def test_graph_step_advances_full_chain_and_writes_back_document() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(create_template_execution_document())
    )
    runtime_notifications: list[dict[str, Any]] = []
    dispose = service.subscribe_runtime_feedback(runtime_notifications.append)

    step_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.step"}},
        ).dump()
    )
    dispose()

    assert step_result["accepted"] is True
    assert step_result["changed"] is True
    assert step_result["state"]["status"] == "idle"
    assert step_result["state"]["queueSize"] == 0
    assert step_result["state"]["stepCount"] == 1

    document = current_document(service)
    counter_node = next(node for node in document["nodes"] if node["id"] == "counter")
    display_node = next(node for node in document["nodes"] if node["id"] == "display")
    assert counter_node["title"] == "Counter 1"
    assert counter_node["properties"]["count"] == 1
    assert display_node["title"] == "Display 1"
    assert display_node["properties"]["lastValue"] == 1

    graph_event_types = [
        envelope["params"]["event"]["type"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "graph.execution"
    ]
    assert graph_event_types == ["started", "advanced", "drained"]

    graph_advanced_event = next(
        envelope["params"]["event"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "graph.execution"
        and envelope["params"]["event"]["type"] == "advanced"
    )
    assert graph_advanced_event["state"]["queueSize"] == 0

    node_execution_events = [
        envelope["params"]["event"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "node.execution"
    ]
    assert [event["nodeId"] for event in node_execution_events] == [
        "on-play",
        "counter",
        "display",
    ]
    assert [event["sequence"] for event in node_execution_events] == [0, 1, 2]

    node_state_events = [
        envelope["params"]["event"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "node.state"
    ]
    assert {event["nodeId"] for event in node_state_events} == {
        "on-play",
        "counter",
        "display",
    }

    on_play_payload = next(
        envelope["params"]["event"]["payload"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "link.propagation"
        and envelope["params"]["event"]["linkId"] == "link:on-play->counter"
    )
    assert on_play_payload["entryNodeId"] == "on-play"
    assert on_play_payload["source"] == "graph-step"
    assert on_play_payload["stepIndex"] == 0

    assert any(
        envelope["params"]["type"] == "link.propagation"
        and envelope["params"]["event"]["linkId"] == "link:counter->display"
        for envelope in runtime_notifications
    )


def test_graph_play_can_keep_timer_running_until_stop() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=False, interval_ms=10)
        )
    )

    play_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.play"}},
        ).dump()
    )
    assert play_result["accepted"] is True
    assert play_result["changed"] is True
    assert play_result["state"]["status"] == "running"

    asyncio.get_event_loop().run_until_complete(asyncio.sleep(0.06))

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )
    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"

    document = current_document(service)
    timer_node = next(node for node in document["nodes"] if node["id"] == "timer-node")
    assert int(timer_node["properties"].get("runCount", 0)) >= 1


def test_graph_step_with_immediate_timer_promotes_to_running_until_stop() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=True, interval_ms=10)
        )
    )
    runtime_notifications: list[dict[str, Any]] = []
    dispose = service.subscribe_runtime_feedback(runtime_notifications.append)

    first_step = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.step"}},
        ).dump()
    )

    assert first_step["accepted"] is True
    assert first_step["changed"] is True
    assert first_step["state"]["status"] == "running"
    assert first_step["state"]["queueSize"] == 0

    assert [
        envelope["params"]["event"]["type"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "graph.execution"
    ] == ["started", "advanced"]

    asyncio.get_event_loop().run_until_complete(asyncio.sleep(0.04))

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )
    dispose()

    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"


def test_graph_play_with_immediate_timer_emits_timer_advanced_before_stop() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=True, interval_ms=100)
        )
    )
    runtime_notifications: list[dict[str, Any]] = []
    dispose = service.subscribe_runtime_feedback(runtime_notifications.append)

    play_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.play"}},
        ).dump()
    )
    assert play_result["accepted"] is True
    assert play_result["changed"] is True
    assert play_result["state"]["status"] == "running"

    asyncio.get_event_loop().run_until_complete(asyncio.sleep(0.02))

    graph_execution_events = [
        envelope["params"]["event"]
        for envelope in runtime_notifications
        if envelope["params"]["type"] == "graph.execution"
    ]
    assert any(
        event["type"] == "advanced" and event.get("nodeId") == "timer-node"
        for event in graph_execution_events
    )
    assert not any(event["type"] == "stopped" for event in graph_execution_events)

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )
    dispose()

    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"


def test_graph_play_defers_runtime_document_notifications_until_stop() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=False, interval_ms=10)
        )
    )
    document_notifications: list[dict[str, Any]] = []
    runtime_notifications: list[dict[str, Any]] = []
    dispose_document = service.subscribe_document(document_notifications.append)
    dispose_runtime = service.subscribe_runtime_feedback(runtime_notifications.append)

    play_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.play"}},
        ).dump()
    )
    assert play_result["state"]["status"] == "running"

    wait_for_predicate(
        lambda: any(
            envelope["params"]["type"] == "graph.execution"
            and envelope["params"]["event"]["type"] == "advanced"
            and envelope["params"]["event"].get("nodeId") == "timer-node"
            for envelope in runtime_notifications
        )
    )
    assert document_notifications == []

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )
    dispose_runtime()
    dispose_document()

    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"
    assert len(document_notifications) == 1
    timer_node = next(
        node
        for node in document_notifications[0]["params"]["nodes"]
        if node["id"] == "timer-node"
    )
    assert int(timer_node["properties"].get("runCount", 0)) >= 1


def test_widget_like_live_safe_update_does_not_interrupt_running_timer() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=False, interval_ms=25)
        )
    )
    runtime_notifications: list[dict[str, Any]] = []
    document_notifications: list[dict[str, Any]] = []
    dispose_runtime = service.subscribe_runtime_feedback(runtime_notifications.append)
    dispose_document = service.subscribe_document(document_notifications.append)

    play_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.play"}},
        ).dump()
    )
    assert play_result["state"]["status"] == "running"

    wait_for_predicate(
        lambda: any(
            envelope["params"]["type"] == "graph.execution"
            and envelope["params"]["event"]["type"] == "advanced"
            and envelope["params"]["event"].get("nodeId") == "timer-node"
            for envelope in runtime_notifications
        )
    )

    runtime_notifications.clear()
    timer_document = current_document(service)
    timer_node = next(node for node in timer_document["nodes"] if node["id"] == "timer-node")
    updated_widgets = [
        {
            **widget,
            "value": 5 if widget["name"] == "intervalMs" else False,
        }
        for widget in timer_node["widgets"]
    ]
    updated_properties = {
        **timer_node["properties"],
        "intervalMs": 5,
        "immediate": False,
    }

    update_result = submit_operation(
        service,
        {
            "operationId": "op-running-widget-update",
            "timestamp": 2,
            "source": "pytest",
            "type": "node.update",
            "nodeId": "timer-node",
            "input": {
                "widgets": updated_widgets,
                "properties": updated_properties,
            },
        },
    )

    assert update_result["accepted"] is True
    assert update_result["changed"] is True
    assert "document" not in update_result
    assert document_notifications == []

    wait_for_predicate(
        lambda: any(
            envelope["params"]["type"] == "graph.execution"
            and envelope["params"]["event"]["type"] == "advanced"
            and envelope["params"]["event"].get("nodeId") == "timer-node"
            for envelope in runtime_notifications
        )
    )

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )
    dispose_document()
    dispose_runtime()

    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"
    final_document = current_document(service)
    final_timer_node = next(
        node for node in final_document["nodes"] if node["id"] == "timer-node"
    )
    assert final_timer_node["properties"]["intervalMs"] == 5
    assert final_timer_node["properties"]["immediate"] is False
    assert int(final_timer_node["properties"].get("runCount", 0)) >= 1


def test_structural_update_stops_active_graph_run() -> None:
    service = OpenRpcAuthorityService(
        document_store=InMemoryDocumentStore(
            create_timer_execution_document(immediate=False, interval_ms=20)
        )
    )

    play_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.play"}},
        ).dump()
    )
    assert play_result["state"]["status"] == "running"

    create_result = submit_operation(
        service,
        {
            "operationId": "op-structural-node-create",
            "timestamp": 2,
            "source": "pytest",
            "type": "node.create",
            "input": {
                "id": "new-node",
                "type": "demo/new-node",
                "x": 10,
                "y": 10,
            },
        },
    )

    assert create_result["accepted"] is True
    assert create_result["changed"] is True
    assert create_result["document"]["nodes"][-1]["id"] == "new-node"

    stop_result = dump_value(
        service.handle_request(
            AUTHORITY_CONTROL_RUNTIME_METHOD,
            {"request": {"type": "graph.stop"}},
        ).dump()
    )

    assert stop_result["accepted"] is True
    assert stop_result["changed"] is False
    assert stop_result["reason"] == "当前没有活动中的图运行"
