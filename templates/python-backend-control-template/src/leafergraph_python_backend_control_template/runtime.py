from __future__ import annotations

import asyncio
import re
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Callable


DocumentListener = Callable[[dict[str, Any]], None]
RuntimeFeedbackListener = Callable[[dict[str, Any]], None]
SYSTEM_ON_PLAY_NODE_TYPE = "system/on-play"
TEMPLATE_EXECUTE_COUNTER_NODE_TYPE = "template/execute-counter"
TEMPLATE_EXECUTE_DISPLAY_NODE_TYPE = "template/execute-display"
DEMO_PENDING_NODE_TYPE = "demo.pending"


@dataclass
class GraphPlayRun:
    run_id: str
    started_at: int
    queue: list[str]
    step_count: int
    loop: asyncio.AbstractEventLoop
    handle: asyncio.Handle | None = None


@dataclass
class GraphStepTask:
    node_id: str
    depth: int
    trigger: str
    input_values: list[Any]


@dataclass
class GraphStepRun:
    run_id: str
    started_at: int
    root_node_id: str
    queue: list[GraphStepTask]
    visited_node_ids: set[str]
    sequence: int
    step_count: int


def clone_value(value: Any) -> Any:
    return deepcopy(value)


def now_ms() -> int:
    return int(time.time() * 1000)


def create_default_authority_document() -> dict[str, Any]:
    return {
        "documentId": "node-authority-doc",
        "revision": "1",
        "appKind": "node-authority-demo",
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


def next_revision(revision: Any) -> Any:
    if isinstance(revision, bool):
        return revision
    if isinstance(revision, int):
        return revision + 1

    try:
        numeric_revision = float(revision)
    except (TypeError, ValueError):
        return f"{revision}#1"

    if numeric_revision.is_integer():
        return str(int(numeric_revision) + 1)
    return f"{revision}#1"


def to_node_slot_specs(slots: Any) -> list[dict[str, Any]] | None:
    if slots is None:
        return None

    next_slots: list[dict[str, Any]] = []
    for slot in slots:
        if isinstance(slot, str):
            next_slots.append({"name": slot})
        else:
            next_slots.append(clone_value(slot))
    return next_slots


def normalize_link_endpoint(endpoint: dict[str, Any]) -> dict[str, Any]:
    return {
        "nodeId": endpoint["nodeId"],
        "slot": endpoint.get("slot", 0),
    }


def patch_document_root(
    document: dict[str, Any], input_value: dict[str, Any]
) -> dict[str, Any]:
    next_document = clone_value(document)
    if "appKind" in input_value:
        next_document["appKind"] = input_value["appKind"]
    if "meta" in input_value:
        next_document["meta"] = clone_value(input_value["meta"])
    else:
        next_document["meta"] = clone_value(document.get("meta", {}))

    if "capabilityProfile" in input_value:
        if input_value["capabilityProfile"] is None:
            next_document.pop("capabilityProfile", None)
        else:
            next_document["capabilityProfile"] = clone_value(
                input_value["capabilityProfile"]
            )
    elif "capabilityProfile" in document:
        next_document["capabilityProfile"] = clone_value(
            document["capabilityProfile"]
        )
    else:
        next_document.pop("capabilityProfile", None)

    if "adapterBinding" in input_value:
        if input_value["adapterBinding"] is None:
            next_document.pop("adapterBinding", None)
        else:
            next_document["adapterBinding"] = clone_value(input_value["adapterBinding"])
    elif "adapterBinding" in document:
        next_document["adapterBinding"] = clone_value(document["adapterBinding"])
    else:
        next_document.pop("adapterBinding", None)

    return next_document


def create_idle_graph_execution_state() -> dict[str, Any]:
    return {"status": "idle", "queueSize": 0, "stepCount": 0}


def ensure_node_properties(node: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(node.get("properties"), dict):
        node["properties"] = {}
    return node["properties"]


def create_authority_execution_context_payload(
    *,
    authority_name: str,
    root_node_id: str,
    source: str,
    run_id: str | None,
    started_at: int,
    sequence: int,
) -> dict[str, Any]:
    return {
        "source": source,
        "runId": run_id,
        "entryNodeId": root_node_id,
        "stepIndex": sequence,
        "startedAt": started_at,
        "payload": {
            "authority": authority_name,
        },
    }


def resolve_first_defined_input_value(input_values: list[Any]) -> Any:
    for value in input_values:
        if value is not None:
            return value
    return None


def format_authority_runtime_value(value: Any) -> str:
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, str):
        trimmed_value = value.strip()
        return trimmed_value if trimmed_value else "EMPTY"
    if value is None:
        return "EMPTY"
    return "OBJECT"


def resolve_node_title_base(title: Any, fallback: str) -> str:
    safe_title = title.strip() if isinstance(title, str) else ""
    if not safe_title:
        return fallback
    return re.sub(r"\s+(?:#?\d+|EMPTY|NULL|TRUE|FALSE|OBJECT)$", "", safe_title)


def apply_authority_execution_mutation(
    node: dict[str, Any],
    *,
    authority_name: str,
    root_node_id: str,
    source: str,
    run_id: str | None,
    started_at: int,
    sequence: int,
    input_values: list[Any],
) -> dict[str, Any]:
    if node["type"] == SYSTEM_ON_PLAY_NODE_TYPE:
        return {
            "documentChanged": False,
            "outputPayloads": [
                {
                    "slot": 0,
                    "payload": create_authority_execution_context_payload(
                        authority_name=authority_name,
                        root_node_id=root_node_id,
                        source=source,
                        run_id=run_id,
                        started_at=started_at,
                        sequence=sequence,
                    ),
                }
            ],
        }

    if node["type"] == TEMPLATE_EXECUTE_COUNTER_NODE_TYPE:
        properties = ensure_node_properties(node)
        previous_count = properties.get("count", 0)
        next_count = previous_count + 1 if isinstance(previous_count, (int, float)) else 1
        properties["count"] = next_count
        properties["subtitle"] = "可从节点菜单起跑，也可接到 On Play 作为图级入口"
        properties["status"] = f"RUN {next_count}"
        node["title"] = f"Counter {next_count}"
        return {
            "documentChanged": True,
            "outputPayloads": [{"slot": 0, "payload": next_count}],
        }

    if node["type"] == TEMPLATE_EXECUTE_DISPLAY_NODE_TYPE:
        properties = ensure_node_properties(node)
        input_value = resolve_first_defined_input_value(input_values)
        display_value = format_authority_runtime_value(input_value)
        properties["lastValue"] = clone_value(input_value)
        properties["subtitle"] = "显示上游通过正式连线传播过来的值"
        properties["status"] = f"VALUE {display_value}"
        node["title"] = f"Display {display_value}"
        return {
            "documentChanged": True,
            "outputPayloads": [],
        }

    if node["type"] == DEMO_PENDING_NODE_TYPE:
        properties = ensure_node_properties(node)
        previous_run_count = properties.get("runCount", 0)
        next_run_count = (
            previous_run_count + 1
            if isinstance(previous_run_count, (int, float)) and not isinstance(previous_run_count, bool)
            else 1
        )
        input_value = resolve_first_defined_input_value(input_values)
        display_value = format_authority_runtime_value(input_value)
        properties["runCount"] = next_run_count
        properties["status"] = (
            f"RUN {next_run_count}" if input_value is None else f"VALUE {display_value}"
        )
        if input_value is not None:
            properties["lastValue"] = clone_value(input_value)
        node["title"] = (
            f"{resolve_node_title_base(node.get('title'), node['id'])} {next_run_count}"
            if input_value is None
            else f"{resolve_node_title_base(node.get('title'), node['id'])} {display_value}"
        )
        output_payloads: list[dict[str, Any]] = []
        if len(node.get("outputs", [])) > 0:
            output_payloads.append(
                {
                    "slot": 0,
                    "payload": (
                        {
                            "authority": authority_name,
                            "source": source,
                            "runCount": next_run_count,
                        }
                        if input_value is None
                        else clone_value(input_value)
                    ),
                }
            )
        return {
            "documentChanged": True,
            "outputPayloads": output_payloads,
        }

    if len(node.get("outputs", [])) <= 0:
        return {
            "documentChanged": False,
            "outputPayloads": [],
        }

    input_value = resolve_first_defined_input_value(input_values)
    return {
        "documentChanged": False,
        "outputPayloads": [
            {
                "slot": 0,
                "payload": (
                    create_authority_execution_context_payload(
                        authority_name=authority_name,
                        root_node_id=root_node_id,
                        source=source,
                        run_id=run_id,
                        started_at=started_at,
                        sequence=sequence,
                    )
                    if input_value is None
                    else clone_value(input_value)
                ),
            }
        ],
    }


class PythonAuthorityRuntime:
    def __init__(
        self,
        *,
        initial_document: dict[str, Any] | None = None,
        authority_name: str = "python-authority",
    ) -> None:
        self.authority_name = authority_name
        self._document_listeners: set[DocumentListener] = set()
        self._runtime_feedback_listeners: set[RuntimeFeedbackListener] = set()
        self._node_execution_state_map: dict[str, dict[str, Any]] = {}
        self._generated_node_sequence = 0
        self._generated_link_sequence = 0
        self._current_document = clone_value(
            initial_document or create_default_authority_document()
        )
        self._graph_execution_state = create_idle_graph_execution_state()
        self._active_graph_play_run: GraphPlayRun | None = None
        self._active_graph_step_run: GraphStepRun | None = None
        self._graph_run_seed = 1
        self._step_cursor = 0

    def get_document(self) -> dict[str, Any]:
        return clone_value(self._current_document)

    def subscribe_document(self, listener: DocumentListener) -> Callable[[], None]:
        self._document_listeners.add(listener)

        def dispose() -> None:
            self._document_listeners.discard(listener)

        return dispose

    def subscribe(self, listener: RuntimeFeedbackListener) -> Callable[[], None]:
        self._runtime_feedback_listeners.add(listener)

        def dispose() -> None:
            self._runtime_feedback_listeners.discard(listener)

        return dispose

    def submit_operation(self, operation: dict[str, Any]) -> dict[str, Any]:
        self._stop_active_graph_step_without_event()
        operation_type = operation["type"]
        if operation_type == "document.update":
            next_document = patch_document_root(self._current_document, operation["input"])
            if next_document == self._current_document:
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **next_document,
                    "revision": next_revision(self._current_document["revision"]),
                }
            )
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "node.create":
            next_node = self._create_node_from_input(operation["input"])
            previous_node = self._get_node(next_node["id"])
            if previous_node and previous_node == next_node:
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "nodes": [
                        *[
                            node
                            for node in self._current_document["nodes"]
                            if node["id"] != next_node["id"]
                        ],
                        next_node,
                    ],
                }
            )
            self._emit_node_state(next_node["id"], "created", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "node.update":
            node = self._get_node(operation["nodeId"])
            if not node:
                return self._create_rejected_operation_result("节点不存在")

            input_value = operation["input"]
            next_node = {
                **node,
                "title": input_value.get("title", node.get("title")),
                "layout": {
                    **node["layout"],
                    "x": input_value.get("x", node["layout"]["x"]),
                    "y": input_value.get("y", node["layout"]["y"]),
                    "width": input_value.get("width", node["layout"]["width"]),
                    "height": input_value.get("height", node["layout"]["height"]),
                },
                "properties": clone_value(input_value["properties"])
                if "properties" in input_value
                else node["properties"],
                "propertySpecs": clone_value(input_value["propertySpecs"])
                if "propertySpecs" in input_value
                else node["propertySpecs"],
                "inputs": to_node_slot_specs(input_value["inputs"])
                if "inputs" in input_value
                else node["inputs"],
                "outputs": to_node_slot_specs(input_value["outputs"])
                if "outputs" in input_value
                else node["outputs"],
                "widgets": clone_value(input_value["widgets"])
                if "widgets" in input_value
                else node["widgets"],
                "data": clone_value(input_value["data"])
                if "data" in input_value
                else node["data"],
                "flags": (
                    {
                        **node["flags"],
                        **clone_value(input_value["flags"]),
                    }
                    if "flags" in input_value
                    else node["flags"]
                ),
            }
            if next_node == node:
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "nodes": [
                        next_node if item["id"] == operation["nodeId"] else item
                        for item in self._current_document["nodes"]
                    ],
                }
            )
            self._emit_node_state(operation["nodeId"], "updated", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "node.move":
            node = self._get_node(operation["nodeId"])
            if not node:
                return self._create_rejected_operation_result("节点不存在")
            if (
                node["layout"]["x"] == operation["input"]["x"]
                and node["layout"]["y"] == operation["input"]["y"]
            ):
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "nodes": [
                        (
                            {
                                **item,
                                "layout": {
                                    **item["layout"],
                                    "x": operation["input"]["x"],
                                    "y": operation["input"]["y"],
                                },
                            }
                            if item["id"] == operation["nodeId"]
                            else item
                        )
                        for item in self._current_document["nodes"]
                    ],
                }
            )
            self._emit_node_state(operation["nodeId"], "moved", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "node.resize":
            node = self._get_node(operation["nodeId"])
            if not node:
                return self._create_rejected_operation_result("节点不存在")
            if (
                node["layout"]["width"] == operation["input"]["width"]
                and node["layout"]["height"] == operation["input"]["height"]
            ):
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "nodes": [
                        (
                            {
                                **item,
                                "layout": {
                                    **item["layout"],
                                    "width": operation["input"]["width"],
                                    "height": operation["input"]["height"],
                                },
                            }
                            if item["id"] == operation["nodeId"]
                            else item
                        )
                        for item in self._current_document["nodes"]
                    ],
                }
            )
            self._emit_node_state(operation["nodeId"], "resized", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "node.remove":
            node = self._get_node(operation["nodeId"])
            if not node:
                return self._create_current_snapshot_result(reason="节点不存在")

            related_links = [
                link
                for link in self._current_document["links"]
                if link["source"]["nodeId"] == operation["nodeId"]
                or link["target"]["nodeId"] == operation["nodeId"]
            ]
            affected_node_ids: set[str] = set()
            for link in related_links:
                if link["source"]["nodeId"] != operation["nodeId"]:
                    affected_node_ids.add(link["source"]["nodeId"])
                if link["target"]["nodeId"] != operation["nodeId"]:
                    affected_node_ids.add(link["target"]["nodeId"])

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "nodes": [
                        item
                        for item in self._current_document["nodes"]
                        if item["id"] != operation["nodeId"]
                    ],
                    "links": [
                        link
                        for link in self._current_document["links"]
                        if link["source"]["nodeId"] != operation["nodeId"]
                        and link["target"]["nodeId"] != operation["nodeId"]
                    ],
                }
            )
            self._node_execution_state_map.pop(operation["nodeId"], None)
            self._emit_node_state(operation["nodeId"], "removed", False)
            for node_id in affected_node_ids:
                if self._get_node(node_id):
                    self._emit_node_state(node_id, "connections", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "link.create":
            source_resolution = self._resolve_validated_link_endpoint(
                operation["input"]["source"], "source"
            )
            if not source_resolution["accepted"]:
                return self._create_rejected_operation_result(
                    source_resolution["reason"]
                )
            target_resolution = self._resolve_validated_link_endpoint(
                operation["input"]["target"], "target"
            )
            if not target_resolution["accepted"]:
                return self._create_rejected_operation_result(
                    target_resolution["reason"]
                )

            next_link = self._create_link_from_input(
                {
                    **operation["input"],
                    "source": source_resolution["endpoint"],
                    "target": target_resolution["endpoint"],
                }
            )
            previous_link = self._get_link(next_link["id"])
            if previous_link and previous_link == next_link:
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "links": [
                        *[
                            link
                            for link in self._current_document["links"]
                            if link["id"] != next_link["id"]
                        ],
                        next_link,
                    ],
                }
            )
            self._emit_node_state(next_link["source"]["nodeId"], "connections", True)
            self._emit_node_state(next_link["target"]["nodeId"], "connections", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "link.remove":
            removed_link = self._get_link(operation["linkId"])
            if not removed_link:
                return self._create_current_snapshot_result(reason="连线不存在")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "links": [
                        link
                        for link in self._current_document["links"]
                        if link["id"] != operation["linkId"]
                    ],
                }
            )
            self._emit_node_state(removed_link["source"]["nodeId"], "connections", True)
            self._emit_node_state(removed_link["target"]["nodeId"], "connections", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        if operation_type == "link.reconnect":
            link = self._get_link(operation["linkId"])
            if not link:
                return self._create_rejected_operation_result("连线不存在")

            source_resolution = (
                self._resolve_validated_link_endpoint(operation["input"]["source"], "source")
                if "source" in operation["input"]
                else {"accepted": True, "endpoint": normalize_link_endpoint(link["source"])}
            )
            if not source_resolution["accepted"]:
                return self._create_rejected_operation_result(source_resolution["reason"])

            target_resolution = (
                self._resolve_validated_link_endpoint(operation["input"]["target"], "target")
                if "target" in operation["input"]
                else {"accepted": True, "endpoint": normalize_link_endpoint(link["target"])}
            )
            if not target_resolution["accepted"]:
                return self._create_rejected_operation_result(target_resolution["reason"])

            next_link = {
                **link,
                "source": source_resolution["endpoint"],
                "target": target_resolution["endpoint"],
            }
            if next_link == link:
                return self._create_current_snapshot_result(reason="文档无变化")

            self._commit_document(
                {
                    **self._current_document,
                    "revision": next_revision(self._current_document["revision"]),
                    "links": [
                        next_link if item["id"] == operation["linkId"] else item
                        for item in self._current_document["links"]
                    ],
                }
            )
            affected_node_ids = {
                link["source"]["nodeId"],
                link["target"]["nodeId"],
                next_link["source"]["nodeId"],
                next_link["target"]["nodeId"],
            }
            for node_id in affected_node_ids:
                if self._get_node(node_id):
                    self._emit_node_state(node_id, "connections", True)
            return {
                "accepted": True,
                "changed": True,
                "revision": self._current_document["revision"],
                "document": clone_value(self._current_document),
            }

        raise ValueError(f"不支持的 authority 操作：{operation_type}")

    def control_runtime(self, request: dict[str, Any]) -> dict[str, Any]:
        request_type = request["type"]
        if request_type == "node.play":
            if self._active_graph_play_run:
                return self._create_runtime_control_result(
                    accepted=False,
                    reason="图级运行中，无法从单节点开始运行",
                )

            self._stop_active_graph_step_without_event()
            changed = self._execute_node_chain(
                {
                    "rootNodeId": request["nodeId"],
                    "source": "node-play",
                    "startedAt": now_ms(),
                }
            )
            return self._create_runtime_control_result(
                accepted=changed,
                changed=changed,
                reason=None if changed else "节点不存在",
            )

        if request_type == "graph.play":
            if self._active_graph_play_run:
                return self._create_runtime_control_result(reason="图已在运行中")

            self._stop_active_graph_step_without_event()
            queue = self._collect_graph_entry_node_ids()
            if not queue:
                return self._create_runtime_control_result(reason="图中没有 On Play 入口节点")

            started_at = now_ms()
            run_id = self._create_graph_run_id("graph-play")
            loop = self._resolve_event_loop()
            self._active_graph_play_run = GraphPlayRun(
                run_id=run_id,
                started_at=started_at,
                queue=queue,
                step_count=0,
                loop=loop,
            )
            self._graph_execution_state = {
                "status": "running",
                "runId": run_id,
                "queueSize": len(queue),
                "stepCount": 0,
                "startedAt": started_at,
                "lastSource": "graph-play",
            }
            self._step_cursor = 0
            self._emit_graph_execution(
                "started",
                run_id=run_id,
                source="graph-play",
                timestamp=started_at,
            )
            self._schedule_next_graph_play_run_tick()
            return self._create_runtime_control_result(changed=True)

        if request_type == "graph.step":
            if self._active_graph_play_run:
                return self._create_runtime_control_result(
                    accepted=False,
                    reason="图级运行中，无法单步推进",
                )

            run = self._active_graph_step_run
            if run is None:
                root_node_ids = self._collect_graph_entry_node_ids()
                if not root_node_ids:
                    return self._create_runtime_control_result(reason="图中没有 On Play 入口节点")

                if self._step_cursor >= len(root_node_ids):
                    self._step_cursor = 0
                root_node_id = root_node_ids[self._step_cursor]
                self._step_cursor = (self._step_cursor + 1) % len(root_node_ids)
                started_at = now_ms()
                run_id = self._create_graph_run_id("graph-step")
                run = GraphStepRun(
                    run_id=run_id,
                    started_at=started_at,
                    root_node_id=root_node_id,
                    queue=[
                        GraphStepTask(
                            node_id=root_node_id,
                            depth=0,
                            trigger="direct",
                            input_values=[],
                        )
                    ],
                    visited_node_ids=set(),
                    sequence=0,
                    step_count=0,
                )
                self._active_graph_step_run = run
                self._graph_execution_state = {
                    "status": "stepping",
                    "runId": run_id,
                    "queueSize": 1,
                    "stepCount": 0,
                    "startedAt": started_at,
                    "lastSource": "graph-step",
                }
                self._emit_graph_execution(
                    "started",
                    run_id=run_id,
                    source="graph-step",
                    timestamp=started_at,
                )

            execution_result = self._execute_graph_step_run_tick(run)
            timestamp = now_ms()
            has_more = len(run.queue) > 0
            self._graph_execution_state = {
                "status": "stepping" if has_more else "idle",
                "runId": run.run_id if has_more else None,
                "queueSize": len(run.queue),
                "stepCount": run.step_count,
                "startedAt": run.started_at,
                "stoppedAt": None if has_more else timestamp,
                "lastSource": "graph-step",
            }
            self._emit_graph_execution(
                "advanced",
                run_id=run.run_id,
                source="graph-step",
                node_id=execution_result.get("executedNodeId"),
                timestamp=timestamp,
            )
            if not has_more:
                self._finalize_graph_step_run(run, "drained")
            return self._create_runtime_control_result(
                changed=bool(execution_result["changed"]),
                reason=None if execution_result["changed"] else "节点不存在",
            )

        if request_type == "graph.stop":
            if self._active_graph_play_run:
                self._finalize_graph_play_run(self._active_graph_play_run, "stopped")
                return self._create_runtime_control_result(changed=True)

            if self._active_graph_step_run:
                self._finalize_graph_step_run(self._active_graph_step_run, "stopped")
                return self._create_runtime_control_result(changed=True)

            return self._create_runtime_control_result(reason="当前没有活动中的图运行")

        raise ValueError(f"不支持的 runtime control：{request_type}")

    def replace_document(self, document: dict[str, Any]) -> dict[str, Any]:
        self._current_document = clone_value(document)
        self._reset_document_caches()
        self._emit_document()
        return clone_value(self._current_document)

    def _create_node_from_input(self, input_value: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": input_value.get("id") or self._resolve_generated_node_id(),
            "type": input_value["type"],
            "title": input_value.get("title") or input_value["type"],
            "layout": {
                "x": input_value["x"],
                "y": input_value["y"],
                "width": input_value.get("width", 240),
                "height": input_value.get("height", 140),
            },
            "flags": clone_value(input_value.get("flags", {})),
            "properties": clone_value(input_value.get("properties", {})),
            "propertySpecs": clone_value(input_value.get("propertySpecs", [])),
            "inputs": to_node_slot_specs(input_value.get("inputs")) or [],
            "outputs": to_node_slot_specs(input_value.get("outputs")) or [],
            "widgets": clone_value(input_value.get("widgets", [])),
            "data": clone_value(input_value.get("data", {})),
        }

    def _create_link_from_input(self, input_value: dict[str, Any]) -> dict[str, Any]:
        next_link = {
            "id": input_value.get("id") or self._resolve_generated_link_id(),
            "source": clone_value(input_value["source"]),
            "target": clone_value(input_value["target"]),
        }
        if "label" in input_value:
            next_link["label"] = input_value["label"]
        if "data" in input_value:
            next_link["data"] = clone_value(input_value["data"])
        return next_link

    def _resolve_validated_link_endpoint(
        self, endpoint: dict[str, Any], label: str
    ) -> dict[str, Any]:
        node_id = endpoint.get("nodeId")
        if not isinstance(node_id, str) or not node_id.strip():
            return {"accepted": False, "reason": f"{label} 节点不能为空"}

        slot = endpoint.get("slot", 0)
        if isinstance(slot, bool) or not isinstance(slot, int) or slot < 0:
            return {"accepted": False, "reason": f"{label} slot 必须是非负整数"}

        node = self._get_node(node_id.strip())
        if not node:
            return {"accepted": False, "reason": f"{label} 节点不存在"}

        slots = node.get("outputs" if label == "source" else "inputs", [])
        if slot >= len(slots):
            return {"accepted": False, "reason": f"{label} 端点不存在"}

        return {"accepted": True, "endpoint": {"nodeId": node_id.strip(), "slot": slot}}

    def _resolve_event_loop(self) -> asyncio.AbstractEventLoop:
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            return loop

    def _create_graph_run_id(self, source: str) -> str:
        run_id = f"graph:{source}:{now_ms()}:{self._graph_run_seed}"
        self._graph_run_seed += 1
        return run_id

    def _resolve_generated_node_id(self) -> str:
        while True:
            self._generated_node_sequence += 1
            node_id = f"{self.authority_name}-node-{self._generated_node_sequence}"
            if not self._has_node_id(node_id):
                return node_id

    def _resolve_generated_link_id(self) -> str:
        while True:
            self._generated_link_sequence += 1
            link_id = f"{self.authority_name}-link-{self._generated_link_sequence}"
            if not self._has_link_id(link_id):
                return link_id

    def _has_node_id(self, node_id: str) -> bool:
        return any(node["id"] == node_id for node in self._current_document["nodes"])

    def _has_link_id(self, link_id: str) -> bool:
        return any(link["id"] == link_id for link in self._current_document["links"])

    def _get_node(self, node_id: str) -> dict[str, Any] | None:
        for node in self._current_document["nodes"]:
            if node["id"] == node_id:
                return node
        return None

    def _get_link(self, link_id: str) -> dict[str, Any] | None:
        for link in self._current_document["links"]:
            if link["id"] == link_id:
                return link
        return None

    def _create_current_snapshot_result(self, *, reason: str | None = None) -> dict[str, Any]:
        result = {
            "accepted": True,
            "changed": False,
            "revision": self._current_document["revision"],
            "document": clone_value(self._current_document),
        }
        if reason is not None:
            result["reason"] = reason
        return result

    def _create_rejected_operation_result(self, reason: str) -> dict[str, Any]:
        return {
            "accepted": False,
            "changed": False,
            "reason": reason,
            "revision": self._current_document["revision"],
            "document": clone_value(self._current_document),
        }

    def _create_runtime_control_result(self, **overrides: Any) -> dict[str, Any]:
        result = {
            "accepted": True,
            "changed": False,
            "state": clone_value(self._graph_execution_state),
        }
        result.update(overrides)
        return result

    def _commit_document(self, next_document: dict[str, Any]) -> None:
        self._current_document = next_document
        self._emit_document()

    def _emit_document(self) -> None:
        snapshot = clone_value(self._current_document)
        for listener in list(self._document_listeners):
            listener(snapshot)

    def _emit_runtime_feedback(self, event: dict[str, Any]) -> None:
        snapshot = clone_value(event)
        for listener in list(self._runtime_feedback_listeners):
            listener(snapshot)

    def _emit_node_state(self, node_id: str, reason: str, exists: bool) -> None:
        self._emit_runtime_feedback(
            {
                "type": "node.state",
                "event": {
                    "nodeId": node_id,
                    "exists": exists,
                    "reason": reason,
                    "timestamp": now_ms(),
                },
            }
        )

    def _emit_link_propagation(
        self, link: dict[str, Any], source: str, chain_id: str, payload: Any
    ) -> None:
        self._emit_runtime_feedback(
            {
                "type": "link.propagation",
                "event": {
                    "linkId": link["id"],
                    "chainId": chain_id,
                    "sourceNodeId": link["source"]["nodeId"],
                    "sourceSlot": link["source"].get("slot", 0),
                    "targetNodeId": link["target"]["nodeId"],
                    "targetSlot": link["target"].get("slot", 0),
                    "payload": clone_value(payload),
                    "timestamp": now_ms(),
                },
            }
        )

    def _emit_graph_execution(
        self,
        event_type: str,
        *,
        run_id: str | None = None,
        source: str | None = None,
        node_id: str | None = None,
        timestamp: int,
    ) -> None:
        self._emit_runtime_feedback(
            {
                "type": "graph.execution",
                "event": {
                    "type": event_type,
                    "state": clone_value(self._graph_execution_state),
                    "runId": run_id,
                    "source": source,
                    "nodeId": node_id,
                    "timestamp": timestamp,
                },
            }
        )

    def _advance_node_execution_state(
        self, node_id: str, timestamp: int
    ) -> dict[str, Any]:
        previous_state = self._node_execution_state_map.get(
            node_id, {"status": "idle", "runCount": 0}
        )
        next_state = {
            "status": "success",
            "runCount": previous_state["runCount"] + 1,
            "lastExecutedAt": timestamp,
            "lastSucceededAt": timestamp,
            "lastFailedAt": previous_state.get("lastFailedAt"),
            "lastErrorMessage": previous_state.get("lastErrorMessage"),
        }
        self._node_execution_state_map[node_id] = next_state
        return clone_value(next_state)

    def _emit_node_execution(
        self,
        root_node: dict[str, Any],
        node: dict[str, Any],
        *,
        source: str,
        run_id: str | None,
        chain_id: str,
        depth: int,
        sequence: int,
        trigger: str,
        started_at: int,
        timestamp: int,
    ) -> None:
        state = self._advance_node_execution_state(node["id"], timestamp)
        self._emit_runtime_feedback(
            {
                "type": "node.execution",
                "event": {
                    "chainId": chain_id,
                    "rootNodeId": root_node["id"],
                    "rootNodeType": root_node["type"],
                    "rootNodeTitle": root_node.get("title") or root_node["id"],
                    "nodeId": node["id"],
                    "nodeType": node["type"],
                    "nodeTitle": node.get("title") or node["id"],
                    "depth": depth,
                    "sequence": sequence,
                    "source": source,
                    "trigger": trigger,
                    "timestamp": timestamp,
                    "executionContext": {
                        "source": source,
                        "runId": run_id,
                        "entryNodeId": root_node["id"],
                        "stepIndex": sequence,
                        "startedAt": started_at,
                        "payload": {
                            "authority": self.authority_name,
                        },
                    },
                    "state": state,
                },
            }
        )
        self._emit_node_state(node["id"], "execution", True)

    def _execute_node_chain(self, input_value: dict[str, Any]) -> bool:
        next_document = clone_value(self._current_document)

        def get_node(node_id: str) -> dict[str, Any] | None:
            for node in next_document["nodes"]:
                if node["id"] == node_id:
                    return node
            return None

        root_node = get_node(input_value["rootNodeId"])
        if not root_node:
            return False

        chain_id = (
            f"{self.authority_name}:{input_value['source']}:{root_node['id']}:"
            f"{input_value['startedAt']}"
        )
        visited: set[str] = set()
        input_values_by_node_id: dict[str, list[Any]] = {}
        pending_emitters: list[Callable[[], None]] = []
        document_changed = False
        sequence = 0

        def walk(node_id: str, depth: int, trigger: str) -> None:
            nonlocal sequence, document_changed
            if node_id in visited:
                return

            node = get_node(node_id)
            if not node:
                return

            visited.add(node_id)
            current_sequence = sequence
            sequence += 1
            mutation_result = apply_authority_execution_mutation(
                node,
                authority_name=self.authority_name,
                root_node_id=root_node["id"],
                source=input_value["source"],
                run_id=input_value.get("runId"),
                started_at=input_value["startedAt"],
                sequence=current_sequence,
                input_values=input_values_by_node_id.get(node_id, []),
            )
            document_changed = document_changed or mutation_result["documentChanged"]
            pending_emitters.append(
                lambda root_node=root_node, node=node, depth=depth, sequence=current_sequence, trigger=trigger: self._emit_node_execution(
                    root_node,
                    node,
                    source=input_value["source"],
                    run_id=input_value.get("runId"),
                    chain_id=chain_id,
                    depth=depth,
                    sequence=sequence,
                    trigger=trigger,
                    started_at=input_value["startedAt"],
                    timestamp=now_ms(),
                )
            )

            for output in mutation_result["outputPayloads"]:
                for link in next_document["links"]:
                    if link["source"]["nodeId"] != node_id:
                        continue
                    if link["source"].get("slot", 0) != output["slot"]:
                        continue
                    target_node = get_node(link["target"]["nodeId"])
                    if not target_node:
                        continue
                    target_slot = link["target"].get("slot", 0)
                    target_input_values = input_values_by_node_id.get(
                        target_node["id"],
                        [None] * max(len(target_node.get("inputs", [])), 1),
                    )
                    while len(target_input_values) <= target_slot:
                        target_input_values.append(None)
                    target_input_values[target_slot] = clone_value(output["payload"])
                    input_values_by_node_id[target_node["id"]] = target_input_values
                    pending_emitters.append(
                        lambda link=link, payload=clone_value(output["payload"]): self._emit_link_propagation(
                            link,
                            input_value["source"],
                            chain_id,
                            payload,
                        )
                    )
                    walk(target_node["id"], depth + 1, "propagated")

        walk(root_node["id"], 0, "direct")
        if document_changed:
            next_document["revision"] = next_revision(self._current_document["revision"])
            self._current_document = next_document
            self._emit_document()

        for emit in pending_emitters:
            emit()
        return True

    def _merge_step_input_values(
        self, current_input_values: list[Any], next_input_values: list[Any]
    ) -> list[Any]:
        merged_input_values = [None] * max(
            len(current_input_values), len(next_input_values)
        )
        for index in range(len(merged_input_values)):
            if index < len(current_input_values):
                merged_input_values[index] = clone_value(current_input_values[index])
            if index < len(next_input_values) and next_input_values[index] is not None:
                merged_input_values[index] = clone_value(next_input_values[index])
        return merged_input_values

    def _queue_graph_step_task_front(
        self, run: GraphStepRun, task: GraphStepTask
    ) -> None:
        if task.node_id in run.visited_node_ids:
            return

        existing_task_index = next(
            (
                index
                for index, entry in enumerate(run.queue)
                if entry.node_id == task.node_id
            ),
            -1,
        )
        if existing_task_index >= 0:
            existing_task = run.queue.pop(existing_task_index)
            merged_task = GraphStepTask(
                node_id=existing_task.node_id,
                depth=min(existing_task.depth, task.depth),
                trigger=existing_task.trigger,
                input_values=self._merge_step_input_values(
                    existing_task.input_values, task.input_values
                ),
            )
            run.queue.insert(0, merged_task)
            return

        run.queue.insert(0, task)

    def _execute_graph_step_run_tick(self, run: GraphStepRun) -> dict[str, Any]:
        while len(run.queue) > 0:
            task = run.queue.pop(0)
            if task.node_id in run.visited_node_ids:
                continue

            next_document = clone_value(self._current_document)

            def get_node(node_id: str) -> dict[str, Any] | None:
                for node in next_document["nodes"]:
                    if node["id"] == node_id:
                        return node
                return None

            root_node = get_node(run.root_node_id)
            if not root_node:
                return {"changed": False}

            node = get_node(task.node_id)
            if not node:
                continue

            run.visited_node_ids.add(task.node_id)
            current_sequence = run.sequence
            run.sequence += 1
            chain_id = (
                f"{self.authority_name}:graph-step:{run.root_node_id}:{run.started_at}"
            )
            mutation_result = apply_authority_execution_mutation(
                node,
                authority_name=self.authority_name,
                root_node_id=run.root_node_id,
                source="graph-step",
                run_id=run.run_id,
                started_at=run.started_at,
                sequence=current_sequence,
                input_values=task.input_values,
            )
            pending_emitters: list[Callable[[], None]] = [
                lambda root_node=root_node, node=node, depth=task.depth, sequence=current_sequence, trigger=task.trigger: self._emit_node_execution(
                    root_node,
                    node,
                    source="graph-step",
                    run_id=run.run_id,
                    chain_id=chain_id,
                    depth=depth,
                    sequence=sequence,
                    trigger=trigger,
                    started_at=run.started_at,
                    timestamp=now_ms(),
                )
            ]
            next_tasks: list[GraphStepTask] = []

            for output in mutation_result["outputPayloads"]:
                for link in next_document["links"]:
                    if link["source"]["nodeId"] != task.node_id:
                        continue
                    if link["source"].get("slot", 0) != output["slot"]:
                        continue
                    target_node = get_node(link["target"]["nodeId"])
                    if not target_node or target_node["id"] in run.visited_node_ids:
                        continue

                    target_slot = link["target"].get("slot", 0)
                    target_input_values = [None] * max(
                        len(target_node.get("inputs", [])), 1
                    )
                    while len(target_input_values) <= target_slot:
                        target_input_values.append(None)
                    target_input_values[target_slot] = clone_value(output["payload"])
                    next_tasks.append(
                        GraphStepTask(
                            node_id=target_node["id"],
                            depth=task.depth + 1,
                            trigger="propagated",
                            input_values=target_input_values,
                        )
                    )
                    pending_emitters.append(
                        lambda link=link, payload=clone_value(output["payload"]): self._emit_link_propagation(
                            link,
                            "graph-step",
                            chain_id,
                            payload,
                        )
                    )

            for next_task in reversed(next_tasks):
                self._queue_graph_step_task_front(run, next_task)

            if mutation_result["documentChanged"]:
                next_document["revision"] = next_revision(self._current_document["revision"])
                self._current_document = next_document
                self._emit_document()

            for emit in pending_emitters:
                emit()

            run.step_count += 1
            return {
                "changed": True,
                "executedNodeId": node["id"],
            }

        return {"changed": False}

    def _collect_graph_entry_node_ids(self) -> list[str]:
        return [
            node["id"]
            for node in self._current_document["nodes"]
            if node.get("type") == SYSTEM_ON_PLAY_NODE_TYPE
            and self._get_node(node["id"])
        ]

    def _schedule_next_graph_play_run_tick(self) -> None:
        run = self._active_graph_play_run
        if not run:
            return

        run.handle = run.loop.call_soon(self._advance_graph_play_run, run.run_id)

    def _advance_graph_play_run(self, run_id: str) -> None:
        run = self._active_graph_play_run
        if not run or run.run_id != run_id:
            return

        root_node_id = run.queue.pop(0) if run.queue else None
        if not root_node_id:
            self._finalize_graph_play_run(run, "drained")
            return

        self._execute_node_chain(
            {
                "rootNodeId": root_node_id,
                "source": "graph-play",
                "runId": run.run_id,
                "startedAt": run.started_at,
            }
        )
        run.step_count += 1

        timestamp = now_ms()
        has_more = len(run.queue) > 0
        self._graph_execution_state = {
            "status": "running" if has_more else "idle",
            "runId": run.run_id if has_more else None,
            "queueSize": len(run.queue),
            "stepCount": run.step_count,
            "startedAt": run.started_at,
            "stoppedAt": None if has_more else timestamp,
            "lastSource": "graph-play",
        }
        self._emit_graph_execution(
            "advanced",
            run_id=run.run_id,
            source="graph-play",
            node_id=root_node_id,
            timestamp=timestamp,
        )

        if has_more:
            self._schedule_next_graph_play_run_tick()
            return

        self._finalize_graph_play_run(run, "drained")

    def _finalize_graph_play_run(self, run: GraphPlayRun, event_type: str) -> None:
        if not self._active_graph_play_run or self._active_graph_play_run.run_id != run.run_id:
            return

        if run.handle is not None and not run.handle.cancelled():
            run.handle.cancel()
        self._active_graph_play_run = None
        timestamp = now_ms()
        self._graph_execution_state = {
            "status": "idle",
            "queueSize": 0,
            "stepCount": run.step_count,
            "startedAt": run.started_at,
            "stoppedAt": timestamp,
            "lastSource": "graph-play",
        }
        self._emit_graph_execution(
            event_type,
            run_id=run.run_id,
            source="graph-play",
            timestamp=timestamp,
        )

    def _finalize_graph_step_run(self, run: GraphStepRun, event_type: str) -> None:
        if not self._active_graph_step_run or self._active_graph_step_run.run_id != run.run_id:
            return

        self._active_graph_step_run = None
        timestamp = now_ms()
        self._graph_execution_state = {
            "status": "idle",
            "queueSize": 0,
            "stepCount": run.step_count,
            "startedAt": run.started_at,
            "stoppedAt": timestamp,
            "lastSource": "graph-step",
        }
        self._emit_graph_execution(
            event_type,
            run_id=run.run_id,
            source="graph-step",
            timestamp=timestamp,
        )

    def _stop_active_graph_play_without_event(self) -> None:
        run = self._active_graph_play_run
        if not run:
            return

        if run.handle is not None and not run.handle.cancelled():
            run.handle.cancel()
        self._active_graph_play_run = None

    def _stop_active_graph_step_without_event(self) -> None:
        self._active_graph_step_run = None

    def _reset_document_caches(self) -> None:
        self._generated_node_sequence = 0
        self._generated_link_sequence = 0
        self._stop_active_graph_play_without_event()
        self._stop_active_graph_step_without_event()
        self._node_execution_state_map.clear()
        self._graph_execution_state = create_idle_graph_execution_state()
        self._step_cursor = 0


def create_python_authority_runtime(
    *,
    initial_document: dict[str, Any] | None = None,
    authority_name: str = "python-authority",
) -> PythonAuthorityRuntime:
    return PythonAuthorityRuntime(
        initial_document=initial_document,
        authority_name=authority_name,
    )
