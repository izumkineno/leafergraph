from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from .document_store import clone_document

STANDARD_FLAG_KEYS = ("collapsed", "pinned", "disabled", "selected")


@dataclass(frozen=True)
class GraphDocumentDiffComparison:
    can_diff: bool
    diff: dict[str, Any] | None = None
    reason: str | None = None


def build_graph_document_diff(
    base_document: dict[str, Any],
    next_document: dict[str, Any],
    *,
    emitted_at: int,
) -> GraphDocumentDiffComparison:
    if base_document.get("documentId") != next_document.get("documentId"):
        return GraphDocumentDiffComparison(
            can_diff=False,
            reason="documentId 已变化，必须回退到整图同步",
        )

    operations: list[dict[str, Any]] = []
    field_changes: list[dict[str, Any]] = []
    operation_sequence = 0

    def append_operation(operation_type: str, **payload: Any) -> None:
        nonlocal operation_sequence
        operation_sequence += 1
        operations.append(
            {
                "operationId": f"diff:{operation_type}:{next_document['revision']}:{operation_sequence}",
                "timestamp": emitted_at,
                "source": "authority.documentDiff",
                "type": operation_type,
                **payload,
            }
        )

    root_patch: dict[str, Any] = {}
    for key in ("appKind", "meta", "capabilityProfile", "adapterBinding"):
        if base_document.get(key) == next_document.get(key):
            continue
        if key in ("capabilityProfile", "adapterBinding"):
            root_patch[key] = (
                None
                if next_document.get(key) is None
                else deepcopy(next_document.get(key))
            )
        else:
            root_patch[key] = deepcopy(next_document.get(key))
    if root_patch:
        append_operation("document.update", input=root_patch)

    base_nodes = {
        node["id"]: clone_document(node)
        for node in base_document.get("nodes", [])
        if isinstance(node, dict) and isinstance(node.get("id"), str)
    }
    next_nodes = {
        node["id"]: clone_document(node)
        for node in next_document.get("nodes", [])
        if isinstance(node, dict) and isinstance(node.get("id"), str)
    }

    for node_id in sorted(base_nodes.keys() - next_nodes.keys()):
        append_operation("node.remove", nodeId=node_id)

    for node_id in sorted(next_nodes.keys() - base_nodes.keys()):
        append_operation("node.create", input=create_node_input_from_snapshot(next_nodes[node_id]))

    for node_id in sorted(base_nodes.keys() & next_nodes.keys()):
        base_node = base_nodes[node_id]
        target_node = next_nodes[node_id]
        node_result = compare_existing_node(
            node_id=node_id,
            base_node=base_node,
            next_node=target_node,
            append_operation=append_operation,
        )
        if not node_result.can_diff:
            return node_result
        field_changes.extend(node_result.diff or [])

    base_links = {
        link["id"]: clone_document(link)
        for link in base_document.get("links", [])
        if isinstance(link, dict) and isinstance(link.get("id"), str)
    }
    next_links = {
        link["id"]: clone_document(link)
        for link in next_document.get("links", [])
        if isinstance(link, dict) and isinstance(link.get("id"), str)
    }

    for link_id in sorted(base_links.keys() - next_links.keys()):
        append_operation("link.remove", linkId=link_id)

    for link_id in sorted(next_links.keys() - base_links.keys()):
        append_operation("link.create", input=create_link_input_from_snapshot(next_links[link_id]))

    for link_id in sorted(base_links.keys() & next_links.keys()):
        base_link = base_links[link_id]
        target_link = next_links[link_id]
        if same_link_endpoints(base_link, target_link):
            if base_link != target_link:
                append_operation("link.remove", linkId=link_id)
                append_operation(
                    "link.create",
                    input=create_link_input_from_snapshot(target_link),
                )
            continue

        append_operation(
            "link.reconnect",
            linkId=link_id,
            input={
                "source": deepcopy(target_link["source"]),
                "target": deepcopy(target_link["target"]),
            },
        )

    return GraphDocumentDiffComparison(
        can_diff=True,
        diff={
            "documentId": next_document["documentId"],
            "baseRevision": base_document["revision"],
            "revision": next_document["revision"],
            "emittedAt": emitted_at,
            "operations": operations,
            "fieldChanges": field_changes,
        },
    )


def compare_existing_node(
    *,
    node_id: str,
    base_node: dict[str, Any],
    next_node: dict[str, Any],
    append_operation: Any,
) -> GraphDocumentDiffComparison:
    if base_node.get("type") != next_node.get("type"):
        return GraphDocumentDiffComparison(
            can_diff=False,
            reason=f"节点类型已变化，必须整图同步: {node_id}",
        )

    structural_patch: dict[str, Any] = {}

    if _optional_title_changed(base_node, next_node):
        if not isinstance(next_node.get("title"), str):
            return GraphDocumentDiffComparison(
                can_diff=False,
                reason=f"节点标题被移除，当前必须整图同步: {node_id}",
            )
        return GraphDocumentDiffComparison(
            can_diff=True,
            diff=[
                {
                    "type": "node.title.set",
                    "nodeId": node_id,
                    "value": next_node["title"],
                }
            ],
        )

    field_changes: list[dict[str, Any]] = []

    base_layout = base_node.get("layout", {})
    next_layout = next_node.get("layout", {})
    if base_layout.get("x") != next_layout.get("x") or base_layout.get("y") != next_layout.get("y"):
        append_operation(
            "node.move",
            nodeId=node_id,
            input={
                "x": next_layout.get("x", 0),
                "y": next_layout.get("y", 0),
            },
        )
    if (
        base_layout.get("width") != next_layout.get("width")
        or base_layout.get("height") != next_layout.get("height")
    ):
        append_operation(
            "node.resize",
            nodeId=node_id,
            input={
                "width": next_layout.get("width"),
                "height": next_layout.get("height"),
            },
        )

    for key in ("propertySpecs", "inputs", "outputs"):
        if base_node.get(key) != next_node.get(key):
            structural_patch[key] = deepcopy(next_node.get(key) or [])

    widget_result = compare_widgets(node_id=node_id, base_node=base_node, next_node=next_node)
    if not widget_result.can_diff:
        return widget_result
    if widget_result.reason == "structural-update":
        structural_patch["widgets"] = deepcopy(next_node.get("widgets") or [])
    else:
        field_changes.extend(widget_result.diff or [])

    field_changes.extend(
        compare_flat_object_values(
            node_id=node_id,
            field_name="properties",
            base_value=base_node.get("properties"),
            next_value=next_node.get("properties"),
        )
    )
    field_changes.extend(
        compare_flat_object_values(
            node_id=node_id,
            field_name="data",
            base_value=base_node.get("data"),
            next_value=next_node.get("data"),
        )
    )
    field_changes.extend(
        compare_flags(
            node_id=node_id,
            base_flags=base_node.get("flags"),
            next_flags=next_node.get("flags"),
        )
    )

    if structural_patch:
        append_operation(
            "node.update",
            nodeId=node_id,
            input={
                **create_update_input_from_snapshot(next_node),
                **structural_patch,
            },
        )

    return GraphDocumentDiffComparison(can_diff=True, diff=field_changes)


def compare_widgets(
    *,
    node_id: str,
    base_node: dict[str, Any],
    next_node: dict[str, Any],
) -> GraphDocumentDiffComparison:
    base_widgets = list(base_node.get("widgets") or [])
    next_widgets = list(next_node.get("widgets") or [])
    if len(base_widgets) != len(next_widgets):
        return GraphDocumentDiffComparison(can_diff=True, reason="structural-update")

    field_changes: list[dict[str, Any]] = []
    for index, (base_widget, next_widget) in enumerate(zip(base_widgets, next_widgets)):
        if not isinstance(base_widget, dict) or not isinstance(next_widget, dict):
            return GraphDocumentDiffComparison(
                can_diff=False,
                reason=f"widget 结构非法，必须整图同步: {node_id}#{index}",
            )
        if (
            base_widget.get("type") != next_widget.get("type")
            or base_widget.get("name") != next_widget.get("name")
            or base_widget.get("options") != next_widget.get("options")
        ):
            return GraphDocumentDiffComparison(can_diff=True, reason="structural-update")
        if base_widget.get("value") != next_widget.get("value"):
            field_changes.append(
                {
                    "type": "node.widget.value.set",
                    "nodeId": node_id,
                    "widgetIndex": index,
                    "value": deepcopy(next_widget.get("value")),
                }
            )

    return GraphDocumentDiffComparison(can_diff=True, diff=field_changes)


def compare_flat_object_values(
    *,
    node_id: str,
    field_name: str,
    base_value: Any,
    next_value: Any,
) -> list[dict[str, Any]]:
    base_map = dict(base_value or {})
    next_map = dict(next_value or {})
    changes: list[dict[str, Any]] = []

    for key in sorted(base_map.keys() - next_map.keys()):
        changes.append(
            {
                "type": f"node.{field_name[:-1] if field_name.endswith('s') else field_name}.unset",
                "nodeId": node_id,
                "key": key,
            }
        )

    for key in sorted(next_map.keys()):
        if key not in base_map or base_map[key] != next_map[key]:
            changes.append(
                {
                    "type": f"node.{field_name[:-1] if field_name.endswith('s') else field_name}.set",
                    "nodeId": node_id,
                    "key": key,
                    "value": deepcopy(next_map[key]),
                }
            )

    normalized_changes: list[dict[str, Any]] = []
    for change in changes:
        if change["type"].startswith("node.propertie"):
            change["type"] = change["type"].replace("node.propertie", "node.property")
        normalized_changes.append(change)
    return normalized_changes


def compare_flags(
    *,
    node_id: str,
    base_flags: Any,
    next_flags: Any,
) -> list[dict[str, Any]]:
    base_map = dict(base_flags or {})
    next_map = dict(next_flags or {})
    changes: list[dict[str, Any]] = []
    for key in STANDARD_FLAG_KEYS:
        base_value = bool(base_map.get(key, False))
        next_value = bool(next_map.get(key, False))
        if base_value == next_value:
            continue
        changes.append(
            {
                "type": "node.flag.set",
                "nodeId": node_id,
                "key": key,
                "value": next_value,
            }
        )
    return changes


def create_node_input_from_snapshot(node: dict[str, Any]) -> dict[str, Any]:
    layout = dict(node.get("layout") or {})
    payload: dict[str, Any] = {
        "id": node["id"],
        "type": node["type"],
        "x": layout.get("x", 0),
        "y": layout.get("y", 0),
    }
    if "title" in node:
        payload["title"] = deepcopy(node.get("title"))
    if "width" in layout:
        payload["width"] = layout.get("width")
    if "height" in layout:
        payload["height"] = layout.get("height")
    for key in ("properties", "propertySpecs", "inputs", "outputs", "widgets", "flags", "data"):
        if key in node:
            payload[key] = deepcopy(node.get(key))
    return payload


def create_update_input_from_snapshot(node: dict[str, Any]) -> dict[str, Any]:
    payload = create_node_input_from_snapshot(node)
    payload.pop("id", None)
    payload.pop("type", None)
    return payload


def create_link_input_from_snapshot(link: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "id": link["id"],
        "source": deepcopy(link["source"]),
        "target": deepcopy(link["target"]),
    }
    if "label" in link:
        payload["label"] = deepcopy(link.get("label"))
    if "data" in link:
        payload["data"] = deepcopy(link.get("data"))
    return payload


def same_link_endpoints(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return (
        left.get("source", {}).get("nodeId") == right.get("source", {}).get("nodeId")
        and int(left.get("source", {}).get("slot", 0)) == int(right.get("source", {}).get("slot", 0))
        and left.get("target", {}).get("nodeId") == right.get("target", {}).get("nodeId")
        and int(left.get("target", {}).get("slot", 0)) == int(right.get("target", {}).get("slot", 0))
    )


def _optional_title_changed(base_node: dict[str, Any], next_node: dict[str, Any]) -> bool:
    return ("title" in base_node or "title" in next_node) and base_node.get("title") != next_node.get("title")
