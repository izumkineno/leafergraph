from __future__ import annotations

import asyncio

from leafergraph_python_backend_control_template.core.runtime import (
    create_python_authority_runtime,
)


def create_sample_authority_document() -> dict:
    return {
        "documentId": "behavior-doc",
        "revision": "1",
        "appKind": "node-backend-demo",
        "nodes": [
            {
                "id": "node-1",
                "type": "demo.pending",
                "title": "Node 1",
                "layout": {"x": 0, "y": 0, "width": 240, "height": 140},
                "flags": {},
                "properties": {},
                "propertySpecs": [],
                "inputs": [],
                "outputs": [{"name": "Output", "type": "event"}],
                "widgets": [],
                "data": {},
            },
            {
                "id": "node-2",
                "type": "demo.pending",
                "title": "Node 2",
                "layout": {"x": 320, "y": 0, "width": 240, "height": 140},
                "flags": {},
                "properties": {},
                "propertySpecs": [],
                "inputs": [{"name": "Input", "type": "event"}],
                "outputs": [],
                "widgets": [],
                "data": {},
            },
        ],
        "links": [
            {
                "id": "link-1",
                "source": {"nodeId": "node-1", "slot": 0},
                "target": {"nodeId": "node-2", "slot": 0},
            }
        ],
        "meta": {},
    }


def create_noop_update_operation() -> dict:
    return {
        "type": "node.update",
        "nodeId": "node-1",
        "input": {},
        "operationId": "authority-noop-update-node-1",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_noop_move_operation() -> dict:
    return {
        "type": "node.move",
        "nodeId": "node-1",
        "input": {"x": 0, "y": 0},
        "operationId": "authority-noop-move-node-1",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_noop_resize_operation() -> dict:
    return {
        "type": "node.resize",
        "nodeId": "node-1",
        "input": {"width": 240, "height": 140},
        "operationId": "authority-noop-resize-node-1",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_invalid_link_create_operation() -> dict:
    return {
        "type": "link.create",
        "input": {
            "id": "invalid-link",
            "source": {"nodeId": "missing-node", "slot": 0},
            "target": {"nodeId": "node-2", "slot": 0},
        },
        "operationId": "authority-invalid-link-create",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_invalid_link_reconnect_operation() -> dict:
    return {
        "type": "link.reconnect",
        "linkId": "link-1",
        "input": {"target": {"nodeId": "node-2", "slot": -1}},
        "operationId": "authority-invalid-link-reconnect",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_link_remove_operation() -> dict:
    return {
        "type": "link.remove",
        "linkId": "link-1",
        "operationId": "authority-remove-link-1",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_document_update_operation() -> dict:
    return {
        "type": "document.update",
        "input": {
            "appKind": "behavior-updated",
            "meta": {"mode": "patched"},
            "capabilityProfile": {
                "id": "behavior-profile",
                "features": ["document-update"],
            },
            "adapterBinding": {
                "adapterId": "behavior-adapter",
                "appKind": "behavior-updated",
            },
        },
        "operationId": "authority-document-update",
        "timestamp": 1,
        "source": "editor.test",
    }


def create_template_execution_authority_document() -> dict:
    return {
        "documentId": "template-execution-doc",
        "revision": "1",
        "appKind": "node-backend-demo",
        "nodes": [
            {
                "id": "template-on-play",
                "type": "system/on-play",
                "title": "On Play",
                "layout": {"x": 0, "y": 0, "width": 220, "height": 120},
            },
            {
                "id": "template-execute-source",
                "type": "template/execute-counter",
                "title": "Counter Source",
                "layout": {"x": 280, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "可由 On Play 驱动，也可从节点菜单单独起跑",
                    "accent": "#F97316",
                    "status": "READY",
                    "count": 0,
                },
                "inputs": [{"name": "Start", "type": "event"}],
                "outputs": [{"name": "Count", "type": "number"}],
            },
            {
                "id": "template-execute-display",
                "type": "template/execute-display",
                "title": "Display",
                "layout": {"x": 620, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "等待上游执行传播",
                    "accent": "#0EA5E9",
                    "status": "WAITING",
                },
                "inputs": [{"name": "Value", "type": "number"}],
            },
        ],
        "links": [
            {
                "id": "template-link:on-play->execute-source",
                "source": {"nodeId": "template-on-play", "slot": 0},
                "target": {"nodeId": "template-execute-source", "slot": 0},
            },
            {
                "id": "template-link:execute-source->display",
                "source": {"nodeId": "template-execute-source", "slot": 0},
                "target": {"nodeId": "template-execute-display", "slot": 0},
            },
        ],
        "meta": {},
    }


def create_timer_authority_document(
    *,
    immediate: bool = True,
    interval_ms: int = 10,
    widget_immediate: bool | None = None,
    widget_interval_ms: int | None = None,
) -> dict:
    return {
        "documentId": "timer-execution-doc",
        "revision": "1",
        "appKind": "node-backend-demo",
        "nodes": [
            {
                "id": "timer-on-play",
                "type": "system/on-play",
                "title": "On Play",
                "layout": {"x": 0, "y": 0, "width": 220, "height": 120},
                "outputs": [{"name": "Event", "type": "event"}],
            },
            {
                "id": "timer-node",
                "type": "system/timer",
                "title": "Timer",
                "layout": {"x": 280, "y": 0, "width": 260, "height": 160},
                "properties": {
                    "intervalMs": interval_ms,
                    "immediate": immediate,
                    "runCount": 0,
                    "status": "READY",
                },
                "inputs": [{"name": "Start", "type": "event"}],
                "outputs": [{"name": "Tick", "type": "event"}],
                "widgets": [
                    {
                        "type": "input",
                        "name": "intervalMs",
                        "value": widget_interval_ms
                        if widget_interval_ms is not None
                        else interval_ms,
                        "options": {"label": "Interval (ms)"},
                    },
                    {
                        "type": "toggle",
                        "name": "immediate",
                        "value": widget_immediate
                        if widget_immediate is not None
                        else immediate,
                        "options": {"label": "Immediate"},
                    },
                ],
            },
            {
                "id": "timer-display",
                "type": "template/execute-display",
                "title": "Display",
                "layout": {"x": 600, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "等待上游执行传播",
                    "accent": "#0EA5E9",
                    "status": "WAITING",
                },
                "inputs": [{"name": "Value", "type": "number"}],
            },
        ],
        "links": [
            {
                "id": "timer-link:on-play->timer",
                "source": {"nodeId": "timer-on-play", "slot": 0},
                "target": {"nodeId": "timer-node", "slot": 0},
            },
            {
                "id": "timer-link:timer->display",
                "source": {"nodeId": "timer-node", "slot": 0},
                "target": {"nodeId": "timer-display", "slot": 0},
            },
        ],
        "meta": {},
    }


def test_default_authority_document_should_provide_basic_demo_chain() -> None:
    runtime = create_python_authority_runtime(authority_name="behavior-test")

    document = runtime.get_document()

    assert document["documentId"] == "node-authority-doc"
    assert document["revision"] == "1"
    assert document["nodes"] == [
        {
            "id": "node-1",
            "type": "demo.pending",
            "title": "Node 1",
            "layout": {"x": 0, "y": 0, "width": 240, "height": 140},
            "flags": {},
            "properties": {},
            "propertySpecs": [],
            "inputs": [],
            "outputs": [{"name": "Output", "type": "event"}],
            "widgets": [],
            "data": {},
        },
        {
            "id": "node-2",
            "type": "demo.pending",
            "title": "Node 2",
            "layout": {"x": 320, "y": 0, "width": 240, "height": 140},
            "flags": {},
            "properties": {},
            "propertySpecs": [],
            "inputs": [{"name": "Input", "type": "event"}],
            "outputs": [],
            "widgets": [],
            "data": {},
        },
    ]
    assert document["links"] == [
        {
            "id": "link-1",
            "source": {"nodeId": "node-1", "slot": 0},
            "target": {"nodeId": "node-2", "slot": 0},
        }
    ]


def test_graph_step_should_require_on_play_entry() -> None:
    runtime = create_python_authority_runtime(authority_name="behavior-test")
    events: list[dict] = []
    dispose = runtime.subscribe(events.append)

    result = runtime.control_runtime({"type": "graph.step"})

    dispose()

    assert result["accepted"] is True
    assert result["changed"] is False
    assert result["reason"] == "图中没有 On Play 入口节点"
    assert result["state"]["status"] == "idle"
    assert result["state"]["queueSize"] == 0
    assert result["state"]["stepCount"] == 0
    assert events == []


def test_graph_play_should_require_on_play_entry() -> None:
    runtime = create_python_authority_runtime(authority_name="behavior-test")

    result = runtime.control_runtime({"type": "graph.play"})

    assert result["accepted"] is True
    assert result["changed"] is False
    assert result["reason"] == "图中没有 On Play 入口节点"
    assert result["state"]["status"] == "idle"
    assert result["state"]["queueSize"] == 0
    assert result["state"]["stepCount"] == 0


def test_node_play_should_still_allow_direct_debug_start_without_on_play() -> None:
    runtime = create_python_authority_runtime(authority_name="behavior-test")

    result = runtime.control_runtime({"type": "node.play", "nodeId": "node-1"})

    assert result["accepted"] is True
    assert result["changed"] is True
    current_document = runtime.get_document()
    assert current_document["revision"] == "2"
    source_node = next(node for node in current_document["nodes"] if node["id"] == "node-1")
    target_node = next(node for node in current_document["nodes"] if node["id"] == "node-2")
    assert source_node["properties"]["runCount"] == 1
    assert source_node["properties"]["status"] == "RUN 1"
    assert target_node["properties"]["status"] == "VALUE OBJECT"


def test_noop_update_move_resize_should_not_advance_revision() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_sample_authority_document(),
    )

    update_result = runtime.submit_operation(create_noop_update_operation())
    move_result = runtime.submit_operation(create_noop_move_operation())
    resize_result = runtime.submit_operation(create_noop_resize_operation())

    assert update_result["changed"] is False
    assert move_result["changed"] is False
    assert resize_result["changed"] is False
    assert runtime.get_document()["revision"] == "1"


def test_invalid_link_operations_should_be_rejected() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_sample_authority_document(),
    )

    create_result = runtime.submit_operation(create_invalid_link_create_operation())
    reconnect_result = runtime.submit_operation(create_invalid_link_reconnect_operation())

    assert create_result["accepted"] is False
    assert create_result["reason"] == "source 节点不存在"
    assert reconnect_result["accepted"] is False
    assert reconnect_result["reason"] == "target slot 必须是非负整数"


def test_link_remove_should_emit_connections_feedback() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_sample_authority_document(),
    )
    events: list[dict] = []
    dispose = runtime.subscribe(events.append)

    result = runtime.submit_operation(create_link_remove_operation())

    dispose()

    assert result["accepted"] is True
    connection_events = [
        event
        for event in events
        if event["type"] == "node.state"
        and event["event"]["reason"] == "connections"
        and event["event"]["nodeId"] in {"node-1", "node-2"}
    ]
    assert len(connection_events) == 2


def test_document_update_should_patch_root_fields_and_support_noop() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document={
            "documentId": "behavior-doc",
            "revision": "5",
            "appKind": "behavior-app",
            "nodes": [],
            "links": [],
            "meta": {"before": True},
            "capabilityProfile": {"id": "before-profile", "features": ["before"]},
            "adapterBinding": {
                "adapterId": "before-adapter",
                "appKind": "behavior-app",
            },
        },
    )

    update_result = runtime.submit_operation(create_document_update_operation())
    noop_result = runtime.submit_operation(create_document_update_operation())

    assert update_result["revision"] == "6"
    assert update_result["document"]["appKind"] == "behavior-updated"
    assert update_result["document"]["meta"] == {"mode": "patched"}
    assert noop_result["changed"] is False
    assert noop_result["reason"] == "文档无变化"


def test_graph_step_should_emit_execution_feedback() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_template_execution_authority_document(),
    )
    events: list[dict] = []
    dispose = runtime.subscribe(events.append)

    result = runtime.control_runtime({"type": "graph.step"})

    dispose()

    assert result["accepted"] is True
    assert result["changed"] is True
    assert result["state"]["status"] == "stepping"
    assert result["state"]["queueSize"] == 1
    assert [event["event"]["type"] for event in events if event["type"] == "graph.execution"] == [
        "started",
        "advanced",
    ]
    assert any(
        event["type"] == "node.execution"
        and event["event"]["nodeId"] == "template-on-play"
        and event["event"]["source"] == "graph-step"
        for event in events
    )
    assert any(
        event["type"] == "link.propagation"
        and event["event"]["linkId"] == "template-link:on-play->execute-source"
        for event in events
    )


def test_graph_step_should_progress_one_node_at_a_time_and_write_back_later_steps() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_template_execution_authority_document(),
    )
    pushed_documents: list[dict] = []
    dispose = runtime.subscribe_document(pushed_documents.append)

    first_step_result = runtime.control_runtime({"type": "graph.step"})
    second_step_result = runtime.control_runtime({"type": "graph.step"})
    third_step_result = runtime.control_runtime({"type": "graph.step"})

    dispose()

    assert first_step_result["accepted"] is True
    assert first_step_result["changed"] is True
    assert first_step_result["state"]["status"] == "stepping"
    assert second_step_result["accepted"] is True
    assert second_step_result["changed"] is True
    assert second_step_result["state"]["status"] == "stepping"
    assert third_step_result["accepted"] is True
    assert third_step_result["changed"] is True
    assert third_step_result["state"]["status"] == "idle"
    assert len(pushed_documents) == 2
    current_document = runtime.get_document()
    assert current_document["revision"] == "3"
    source_node = next(
        node
        for node in current_document["nodes"]
        if node["id"] == "template-execute-source"
    )
    display_node = next(
        node
        for node in current_document["nodes"]
        if node["id"] == "template-execute-display"
    )
    assert source_node["title"] == "Counter 1"
    assert source_node["properties"]["count"] == 1
    assert source_node["properties"]["status"] == "RUN 1"
    assert display_node["title"] == "Display 1"
    assert display_node["properties"]["lastValue"] == 1
    assert display_node["properties"]["status"] == "VALUE 1"
    first_pushed_display = next(
        node
        for node in pushed_documents[0]["nodes"]
        if node["id"] == "template-execute-display"
    )
    assert first_pushed_display["title"] == "Display"
    assert any(
        node["id"] == "template-execute-display" and node["title"] == "Display 1"
        for node in pushed_documents[1]["nodes"]
    )


def test_graph_step_should_restart_from_root_after_finishing_a_chain() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_template_execution_authority_document(),
    )

    for _ in range(6):
        result = runtime.control_runtime({"type": "graph.step"})
        assert result["accepted"] is True
        assert result["changed"] is True

    current_document = runtime.get_document()
    assert current_document["revision"] == "5"
    source_node = next(
        node
        for node in current_document["nodes"]
        if node["id"] == "template-execute-source"
    )
    display_node = next(
        node
        for node in current_document["nodes"]
        if node["id"] == "template-execute-display"
    )
    assert source_node["title"] == "Counter 2"
    assert source_node["properties"]["count"] == 2
    assert source_node["properties"]["status"] == "RUN 2"
    assert display_node["title"] == "Display 2"
    assert display_node["properties"]["lastValue"] == 2
    assert display_node["properties"]["status"] == "VALUE 2"


def test_graph_play_should_allow_stop_and_emit_stopped() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_template_execution_authority_document(),
    )
    events: list[dict] = []
    dispose = runtime.subscribe(events.append)

    play_result = runtime.control_runtime({"type": "graph.play"})
    stop_result = runtime.control_runtime({"type": "graph.stop"})

    dispose()

    assert play_result["accepted"] is True
    assert play_result["changed"] is True
    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert [event["event"]["type"] for event in events if event["type"] == "graph.execution"] == [
        "started",
        "stopped",
    ]


def test_graph_play_with_timer_should_keep_running_until_stop() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_timer_authority_document(
            immediate=False,
            interval_ms=10,
        ),
    )

    play_result = runtime.control_runtime({"type": "graph.play"})
    assert play_result["accepted"] is True
    assert play_result["changed"] is True
    assert play_result["state"]["status"] == "running"

    loop = asyncio.get_event_loop()
    loop.run_until_complete(asyncio.sleep(0.06))

    stop_result = runtime.control_runtime({"type": "graph.stop"})
    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True
    assert stop_result["state"]["status"] == "idle"

    timer_node = next(
        node
        for node in runtime.get_document()["nodes"]
        if node["id"] == "timer-node"
    )
    assert int(timer_node["properties"].get("runCount", 0)) >= 1


def test_timer_widgets_should_override_property_config() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_timer_authority_document(
            immediate=True,
            interval_ms=1000,
            widget_immediate=False,
            widget_interval_ms=80,
        ),
    )

    runtime.control_runtime({"type": "graph.play"})
    loop = asyncio.get_event_loop()
    loop.run_until_complete(asyncio.sleep(0.02))

    waiting_node = next(
        node
        for node in runtime.get_document()["nodes"]
        if node["id"] == "timer-node"
    )
    assert waiting_node["properties"]["intervalMs"] == 80
    assert waiting_node["properties"]["immediate"] is False
    assert waiting_node["properties"]["runCount"] == 0
    assert waiting_node["properties"]["status"] == "WAIT 80ms"

    loop.run_until_complete(asyncio.sleep(0.09))
    runtime.control_runtime({"type": "graph.stop"})
    timer_node = next(
        node
        for node in runtime.get_document()["nodes"]
        if node["id"] == "timer-node"
    )
    assert int(timer_node["properties"].get("runCount", 0)) >= 1
    assert next(
        widget["value"]
        for widget in timer_node["widgets"]
        if widget["name"] == "intervalMs"
    ) == 80
    assert next(
        widget["value"]
        for widget in timer_node["widgets"]
        if widget["name"] == "immediate"
    ) is False


def test_graph_step_with_timer_should_promote_to_running() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_timer_authority_document(
            immediate=True,
            interval_ms=10,
        ),
    )

    first_step = runtime.control_runtime({"type": "graph.step"})
    assert first_step["accepted"] is True
    assert first_step["changed"] is True
    assert first_step["state"]["status"] == "stepping"

    second_step = runtime.control_runtime({"type": "graph.step"})
    assert second_step["accepted"] is True
    assert second_step["changed"] is True
    assert second_step["state"]["status"] == "running"

    loop = asyncio.get_event_loop()
    loop.run_until_complete(asyncio.sleep(0.04))
    stop_result = runtime.control_runtime({"type": "graph.stop"})
    assert stop_result["accepted"] is True
    assert stop_result["changed"] is True


def test_node_play_timer_should_only_run_once() -> None:
    runtime = create_python_authority_runtime(
        authority_name="behavior-test",
        initial_document=create_timer_authority_document(
            immediate=True,
            interval_ms=10,
        ),
    )

    result = runtime.control_runtime({"type": "node.play", "nodeId": "timer-node"})
    assert result["accepted"] is True
    assert result["changed"] is True

    loop = asyncio.get_event_loop()
    loop.run_until_complete(asyncio.sleep(0.04))
    timer_node = next(
        node
        for node in runtime.get_document()["nodes"]
        if node["id"] == "timer-node"
    )
    assert int(timer_node["properties"].get("runCount", 0)) == 1
