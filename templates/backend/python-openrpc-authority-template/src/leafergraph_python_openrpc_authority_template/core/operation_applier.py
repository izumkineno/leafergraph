from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(slots=True)
class OperationOutcome:
    accepted: bool
    changed: bool
    reason: str | None = None
    next_document: dict[str, Any] | None = None


class OperationApplier(Protocol):
    def apply(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        ...


def _clone(value: Any) -> Any:
    return deepcopy(value)


def _find_node(document: dict[str, Any], node_id: str) -> dict[str, Any] | None:
    return next((node for node in document["nodes"] if node["id"] == node_id), None)


def _find_link(document: dict[str, Any], link_id: str) -> dict[str, Any] | None:
    return next((link for link in document["links"] if link["id"] == link_id), None)


def _normalize_slot_specs(items: list[Any] | None) -> list[dict[str, Any]] | None:
    if items is None:
        return None
    normalized: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, str):
            normalized.append({"name": item})
            continue
        normalized.append(_clone(item))
    return normalized


def _generate_id(existing_ids: set[str], prefix: str) -> str:
    index = 1
    while f"{prefix}-{index}" in existing_ids:
        index += 1
    return f"{prefix}-{index}"


def _ensure_endpoint_nodes_exist(
    document: dict[str, Any],
    endpoint: dict[str, Any],
) -> bool:
    return _find_node(document, endpoint["nodeId"]) is not None


class OpenRpcOperationApplier:
    def apply(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        operation_type = operation["type"]
        handlers = {
            "document.update": self._apply_document_update,
            "node.create": self._apply_node_create,
            "node.update": self._apply_node_update,
            "node.move": self._apply_node_move,
            "node.resize": self._apply_node_resize,
            "node.remove": self._apply_node_remove,
            "link.create": self._apply_link_create,
            "link.remove": self._apply_link_remove,
            "link.reconnect": self._apply_link_reconnect,
        }
        handler = handlers.get(operation_type)
        if handler is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"暂不支持的图操作: {operation_type}",
            )
        return handler(document, operation)

    def _apply_document_update(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        changed = False
        payload = operation["input"]
        for key in ("appKind", "meta"):
            if key not in payload:
                continue
            if next_document.get(key) == payload[key]:
                continue
            next_document[key] = _clone(payload[key])
            changed = True
        for key in ("capabilityProfile", "adapterBinding"):
            if key not in payload:
                continue
            value = payload[key]
            if value is None:
                if key in next_document:
                    next_document.pop(key, None)
                    changed = True
                continue
            if next_document.get(key) == value:
                continue
            next_document[key] = _clone(value)
            changed = True
        if not changed:
            return OperationOutcome(
                accepted=True,
                changed=False,
                reason="文档未发生变化",
            )
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_node_create(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        payload = operation["input"]
        existing_ids = {node["id"] for node in next_document["nodes"]}
        node_id = payload.get("id") or _generate_id(existing_ids, "node")
        if node_id in existing_ids:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"节点已存在: {node_id}",
            )
        node: dict[str, Any] = {
            "id": node_id,
            "type": payload["type"],
            "layout": {
                "x": payload["x"],
                "y": payload["y"],
            },
        }
        if "title" in payload:
            node["title"] = payload["title"]
        if "width" in payload:
            node["layout"]["width"] = payload["width"]
        if "height" in payload:
            node["layout"]["height"] = payload["height"]
        for key in ("properties", "propertySpecs", "widgets", "data", "flags"):
            if key in payload:
                node[key] = _clone(payload[key])
        for key in ("inputs", "outputs"):
            if key in payload:
                node[key] = _normalize_slot_specs(payload[key])
        next_document["nodes"].append(node)
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_node_update(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        target = _find_node(next_document, operation["nodeId"])
        if target is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"节点不存在: {operation['nodeId']}",
            )
        changed = False
        payload = operation["input"]
        if "id" in payload and payload["id"] != target["id"]:
            existing_ids = {node["id"] for node in next_document["nodes"] if node is not target}
            if payload["id"] in existing_ids:
                return OperationOutcome(
                    accepted=False,
                    changed=False,
                    reason=f"节点已存在: {payload['id']}",
                )
            old_id = target["id"]
            target["id"] = payload["id"]
            for link in next_document["links"]:
                if link["source"]["nodeId"] == old_id:
                    link["source"]["nodeId"] = payload["id"]
                if link["target"]["nodeId"] == old_id:
                    link["target"]["nodeId"] = payload["id"]
            changed = True
        if "title" in payload and target.get("title") != payload["title"]:
            target["title"] = payload["title"]
            changed = True
        for key in ("x", "y", "width", "height"):
            if key not in payload:
                continue
            if target["layout"].get(key) == payload[key]:
                continue
            target["layout"][key] = payload[key]
            changed = True
        for key in ("properties", "propertySpecs", "widgets", "data", "flags"):
            if key not in payload:
                continue
            if target.get(key) == payload[key]:
                continue
            target[key] = _clone(payload[key])
            changed = True
        for key in ("inputs", "outputs"):
            if key not in payload:
                continue
            normalized = _normalize_slot_specs(payload[key])
            if target.get(key) == normalized:
                continue
            target[key] = normalized
            changed = True
        if not changed:
            return OperationOutcome(
                accepted=True,
                changed=False,
                reason="节点未发生变化",
            )
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_node_move(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        target = _find_node(next_document, operation["nodeId"])
        if target is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"节点不存在: {operation['nodeId']}",
            )
        payload = operation["input"]
        if (
            target["layout"].get("x") == payload["x"]
            and target["layout"].get("y") == payload["y"]
        ):
            return OperationOutcome(
                accepted=True,
                changed=False,
                reason="节点位置未发生变化",
            )
        target["layout"]["x"] = payload["x"]
        target["layout"]["y"] = payload["y"]
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_node_resize(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        target = _find_node(next_document, operation["nodeId"])
        if target is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"节点不存在: {operation['nodeId']}",
            )
        payload = operation["input"]
        if (
            target["layout"].get("width") == payload["width"]
            and target["layout"].get("height") == payload["height"]
        ):
            return OperationOutcome(
                accepted=True,
                changed=False,
                reason="节点尺寸未发生变化",
            )
        target["layout"]["width"] = payload["width"]
        target["layout"]["height"] = payload["height"]
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_node_remove(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        if _find_node(document, operation["nodeId"]) is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"节点不存在: {operation['nodeId']}",
            )
        next_document = _clone(document)
        next_document["nodes"] = [
            node for node in next_document["nodes"] if node["id"] != operation["nodeId"]
        ]
        next_document["links"] = [
            link
            for link in next_document["links"]
            if link["source"]["nodeId"] != operation["nodeId"]
            and link["target"]["nodeId"] != operation["nodeId"]
        ]
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_link_create(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        payload = operation["input"]
        if not _ensure_endpoint_nodes_exist(next_document, payload["source"]):
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"源节点不存在: {payload['source']['nodeId']}",
            )
        if not _ensure_endpoint_nodes_exist(next_document, payload["target"]):
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"目标节点不存在: {payload['target']['nodeId']}",
            )
        existing_ids = {link["id"] for link in next_document["links"]}
        link_id = payload.get("id") or _generate_id(existing_ids, "link")
        if link_id in existing_ids:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"连线已存在: {link_id}",
            )
        link: dict[str, Any] = {
            "id": link_id,
            "source": _clone(payload["source"]),
            "target": _clone(payload["target"]),
        }
        for key in ("label", "data"):
            if key in payload:
                link[key] = _clone(payload[key])
        next_document["links"].append(link)
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_link_remove(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        if _find_link(document, operation["linkId"]) is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"连线不存在: {operation['linkId']}",
            )
        next_document = _clone(document)
        next_document["links"] = [
            link for link in next_document["links"] if link["id"] != operation["linkId"]
        ]
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)

    def _apply_link_reconnect(
        self,
        document: dict[str, Any],
        operation: dict[str, Any],
    ) -> OperationOutcome:
        next_document = _clone(document)
        target = _find_link(next_document, operation["linkId"])
        if target is None:
            return OperationOutcome(
                accepted=False,
                changed=False,
                reason=f"连线不存在: {operation['linkId']}",
            )
        payload = operation["input"]
        changed = False
        for key in ("source", "target"):
            if key not in payload:
                continue
            endpoint = payload[key]
            if not _ensure_endpoint_nodes_exist(next_document, endpoint):
                return OperationOutcome(
                    accepted=False,
                    changed=False,
                    reason=f"{'源' if key == 'source' else '目标'}节点不存在: {endpoint['nodeId']}",
                )
            if target[key] == endpoint:
                continue
            target[key] = _clone(endpoint)
            changed = True
        if not changed:
            return OperationOutcome(
                accepted=True,
                changed=False,
                reason="连线端点未发生变化",
            )
        return OperationOutcome(accepted=True, changed=True, next_document=next_document)
