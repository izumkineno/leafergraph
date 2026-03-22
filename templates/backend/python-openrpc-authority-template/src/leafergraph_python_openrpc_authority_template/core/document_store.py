from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from typing import Any, Protocol

DocumentListener = Callable[[dict[str, Any]], None]


def clone_document(document: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(document)


def create_empty_graph_document(
    *,
    document_id: str = "python-openrpc-document",
    app_kind: str = "leafergraph",
) -> dict[str, Any]:
    return {
        "documentId": document_id,
        "revision": 0,
        "appKind": app_kind,
        "nodes": [],
        "links": [],
    }


def _coerce_revision_number(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return 0


def normalize_document_for_compare(document: dict[str, Any]) -> dict[str, Any]:
    normalized = clone_document(document)
    normalized.pop("revision", None)
    return normalized


class DocumentStore(Protocol):
    def get_document(self) -> dict[str, Any]:
        ...

    def replace_document(self, document: dict[str, Any]) -> dict[str, Any] | None:
        ...

    def subscribe(self, listener: DocumentListener) -> Callable[[], None]:
        ...


class InMemoryDocumentStore:
    def __init__(self, initial_document: dict[str, Any] | None = None) -> None:
        document = clone_document(initial_document or create_empty_graph_document())
        self._revision = _coerce_revision_number(document.get("revision"))
        document["revision"] = self._revision
        self._document = document
        self._listeners: set[DocumentListener] = set()

    def get_document(self) -> dict[str, Any]:
        return clone_document(self._document)

    def replace_document(self, document: dict[str, Any]) -> dict[str, Any] | None:
        next_document = clone_document(document)
        if (
            normalize_document_for_compare(self._document)
            == normalize_document_for_compare(next_document)
        ):
            return None
        self._revision += 1
        next_document["revision"] = self._revision
        self._document = next_document
        snapshot = self.get_document()
        for listener in list(self._listeners):
            listener(snapshot)
        return snapshot

    def subscribe(self, listener: DocumentListener) -> Callable[[], None]:
        self._listeners.add(listener)

        def dispose() -> None:
            self._listeners.discard(listener)

        return dispose
