from __future__ import annotations


def create_demo_worker_root_chain_document() -> dict:
    return {
        "documentId": "demo-worker-doc",
        "revision": 1,
        "appKind": "demo-worker",
        "nodes": [
            {
                "id": "node-1",
                "type": "demo.worker",
                "title": "Node 1",
                "layout": {"x": 0, "y": 0, "width": 240, "height": 140},
                "properties": {},
                "inputs": [],
                "outputs": [{"name": "Out", "type": "event"}],
            },
            {
                "id": "node-2",
                "type": "demo.worker",
                "title": "Node 2",
                "layout": {"x": 320, "y": 0, "width": 240, "height": 140},
                "properties": {},
                "inputs": [{"name": "In", "type": "event"}],
                "outputs": [],
            },
        ],
        "links": [
            {
                "id": "link-1",
                "source": {"nodeId": "node-1", "slot": 0},
                "target": {"nodeId": "node-2", "slot": 0},
            }
        ],
        "meta": {"source": "pytest"},
    }


def create_template_execution_document() -> dict:
    return {
        "documentId": "openrpc-runtime-doc",
        "revision": 1,
        "appKind": "node-backend-demo",
        "nodes": [
            {
                "id": "on-play",
                "type": "system/on-play",
                "title": "On Play",
                "layout": {"x": 0, "y": 0, "width": 220, "height": 120},
                "outputs": [{"name": "Event", "type": "event"}],
            },
            {
                "id": "counter",
                "type": "template/execute-counter",
                "title": "Counter Source",
                "layout": {"x": 280, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "等待起跑",
                    "status": "READY",
                    "count": 0,
                },
                "inputs": [{"name": "Start", "type": "event"}],
                "outputs": [{"name": "Count", "type": "number"}],
            },
            {
                "id": "display",
                "type": "template/execute-display",
                "title": "Display",
                "layout": {"x": 620, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "等待上游执行传播",
                    "status": "WAITING",
                },
                "inputs": [{"name": "Value", "type": "number"}],
            },
        ],
        "links": [
            {
                "id": "link:on-play->counter",
                "source": {"nodeId": "on-play", "slot": 0},
                "target": {"nodeId": "counter", "slot": 0},
            },
            {
                "id": "link:counter->display",
                "source": {"nodeId": "counter", "slot": 0},
                "target": {"nodeId": "display", "slot": 0},
            },
        ],
        "meta": {"source": "pytest"},
    }


def create_timer_execution_document(
    *,
    immediate: bool = True,
    interval_ms: int = 10,
) -> dict:
    return {
        "documentId": "openrpc-runtime-timer-doc",
        "revision": 1,
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
                "layout": {"x": 280, "y": 0, "width": 260, "height": 180},
                "properties": {
                    "intervalMs": interval_ms,
                    "immediate": immediate,
                    "runCount": 0,
                    "status": "READY",
                },
                "widgets": [
                    {
                        "type": "input",
                        "name": "intervalMs",
                        "value": interval_ms,
                    },
                    {
                        "type": "toggle",
                        "name": "immediate",
                        "value": immediate,
                    },
                ],
                "inputs": [{"name": "Start", "type": "event"}],
                "outputs": [{"name": "Tick", "type": "event"}],
            },
            {
                "id": "timer-display",
                "type": "template/execute-display",
                "title": "Display",
                "layout": {"x": 620, "y": 0, "width": 288, "height": 184},
                "properties": {
                    "subtitle": "等待上游执行传播",
                    "status": "WAITING",
                },
                "inputs": [{"name": "Value", "type": "number"}],
            },
        ],
        "links": [
            {
                "id": "link:on-play->timer",
                "source": {"nodeId": "timer-on-play", "slot": 0},
                "target": {"nodeId": "timer-node", "slot": 0},
            },
            {
                "id": "link:timer->display",
                "source": {"nodeId": "timer-node", "slot": 0},
                "target": {"nodeId": "timer-display", "slot": 0},
            },
        ],
        "meta": {"source": "pytest"},
    }
