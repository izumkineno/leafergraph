from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from pydantic import ValidationError

from .bootstrap import ensure_generated
from .document_store import DocumentStore, InMemoryDocumentStore, clone_document
from .frontend_bundles import (
    FrontendBundleCatalogProvider,
    StaticFrontendBundleCatalogProvider,
)
from .jsonrpc import create_notification_envelope
from .operation_applier import OpenRpcOperationApplier, OperationApplier
from .protocol import DEFAULT_AUTHORITY_NAME, create_discover_result
from .runtime_controller import (
    InMemoryGraphRuntimeController,
    LIVE_SAFE_DOCUMENT_UPDATE_IMPACT,
    RuntimeController,
    STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
)

ensure_generated()

from .._generated.methods import (
    AUTHORITY_CONTROL_RUNTIME_METHOD,
    AUTHORITY_GET_DOCUMENT_METHOD,
    AUTHORITY_REPLACE_DOCUMENT_METHOD,
    AUTHORITY_RPC_DISCOVER_METHOD,
    AUTHORITY_SUBMIT_OPERATION_METHOD,
)
from .._generated.models import (
    METHOD_PARAM_MODELS,
    dump_method_result,
    dump_notification_params,
    validate_method_params,
    validate_method_result,
    validate_notification_params,
)
from .._generated.notifications import (
    AUTHORITY_DOCUMENT_NOTIFICATION,
    AUTHORITY_DOCUMENT_DIFF_NOTIFICATION,
    AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION,
    AUTHORITY_RUNTIME_FEEDBACK_NOTIFICATION,
)

STRUCTURAL_OPERATION_TYPES = {
    "node.create",
    "node.remove",
    "link.create",
    "link.remove",
    "link.reconnect",
}
LIVE_SAFE_OPERATION_TYPES = {
    "document.update",
    "node.move",
    "node.resize",
}
LIVE_SAFE_NODE_UPDATE_FIELDS = {"title", "properties", "widgets", "data", "flags"}


class AuthorityInvalidParamsError(ValueError):
    def __init__(self, method: str, error: ValidationError | str):
        details = (
            error.errors(include_url=False)
            if isinstance(error, ValidationError)
            else error
        )
        self.method = method
        self.details = details
        super().__init__(f"{method} params 非法")


@dataclass
class AuthorityMethodResponse:
    method: str
    value: Any

    def dump(self) -> Any:
        return dump_method_result(self.method, self.value)


@dataclass
class DocumentPayloadEvent:
    document: dict[str, Any]
    origin_connection_id: str | None = None
    response_document_delivered: bool = False


class OpenRpcAuthorityService:
    def __init__(
        self,
        *,
        authority_name: str = DEFAULT_AUTHORITY_NAME,
        document_store: DocumentStore | None = None,
        operation_applier: OperationApplier | None = None,
        runtime_controller: RuntimeController | None = None,
        frontend_bundles_provider: FrontendBundleCatalogProvider | None = None,
    ) -> None:
        self.authority_name = authority_name
        self.document_store = document_store or InMemoryDocumentStore()
        self.operation_applier = operation_applier or OpenRpcOperationApplier()
        self.runtime_controller = runtime_controller or InMemoryGraphRuntimeController(
            authority_name=authority_name
        )
        self.frontend_bundles_provider = (
            frontend_bundles_provider or StaticFrontendBundleCatalogProvider()
        )
        self._document_listeners: set[Callable[[dict[str, Any]], None]] = set()
        self._document_payload_listeners: set[
            Callable[[DocumentPayloadEvent], None]
        ] = set()
        self._pending_runtime_document: dict[str, Any] | None = None
        self.runtime_controller.replace_document(
            self.document_store.get_document(),
            impact=STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
        )
        self._dispose_runtime_document_sync = self.runtime_controller.subscribe_document(
            self._handle_runtime_document_change
        )
        self._dispose_runtime_feedback_sync = self.runtime_controller.subscribe(
            self._handle_runtime_feedback
        )

    def _is_runtime_active_state(self, state: dict[str, Any] | None = None) -> bool:
        current_state = state or self.runtime_controller.get_state()
        return current_state.get("status") in {"running", "stepping"}

    def _emit_document_notification(
        self,
        document: dict[str, Any],
        *,
        origin_connection_id: str | None = None,
        response_document_delivered: bool = False,
    ) -> None:
        for listener in list(self._document_payload_listeners):
            listener(
                DocumentPayloadEvent(
                    document=clone_document(document),
                    origin_connection_id=origin_connection_id,
                    response_document_delivered=response_document_delivered,
                )
            )
        if not self._document_listeners:
            return
        notification = self.create_document_notification(document)
        for listener in list(self._document_listeners):
            listener(notification)

    def _flush_document_to_store(
        self,
        document: dict[str, Any],
        *,
        origin_connection_id: str | None = None,
        response_document_delivered: bool = False,
    ) -> dict[str, Any] | None:
        committed_document = self.document_store.replace_document(document)
        if committed_document is not None:
            self._emit_document_notification(
                committed_document,
                origin_connection_id=origin_connection_id,
                response_document_delivered=response_document_delivered,
            )
        return committed_document

    def _cache_runtime_document(self, document: dict[str, Any]) -> None:
        self._pending_runtime_document = clone_document(document)

    def _flush_pending_runtime_document(self) -> dict[str, Any] | None:
        if self._pending_runtime_document is None or self._is_runtime_active_state():
            return None
        pending_document = clone_document(self._pending_runtime_document)
        self._pending_runtime_document = None
        return self._flush_document_to_store(pending_document)

    def _should_defer_live_safe_document_notification(self, impact: str) -> bool:
        return (
            impact == LIVE_SAFE_DOCUMENT_UPDATE_IMPACT and self._is_runtime_active_state()
        )

    def _handle_runtime_document_change(self, document: dict[str, Any]) -> None:
        if self._is_runtime_active_state():
            self._cache_runtime_document(document)
            return
        self._pending_runtime_document = None
        self._flush_document_to_store(document)

    def _handle_runtime_feedback(self, event: dict[str, Any]) -> None:
        if event.get("type") != "graph.execution":
            return
        graph_event = event.get("event")
        if not isinstance(graph_event, dict):
            return
        state = graph_event.get("state")
        if not isinstance(state, dict):
            return
        if self._is_runtime_active_state(state):
            return
        self._flush_pending_runtime_document()

    def _classify_operation_impact(self, operation: dict[str, Any]) -> str:
        operation_type = operation["type"]
        if operation_type in STRUCTURAL_OPERATION_TYPES:
            return STRUCTURAL_DOCUMENT_UPDATE_IMPACT
        if operation_type in LIVE_SAFE_OPERATION_TYPES:
            return LIVE_SAFE_DOCUMENT_UPDATE_IMPACT
        if operation_type != "node.update":
            return STRUCTURAL_DOCUMENT_UPDATE_IMPACT

        payload = operation.get("input", {})
        if not isinstance(payload, dict):
            return STRUCTURAL_DOCUMENT_UPDATE_IMPACT
        if {"id", "inputs", "outputs", "propertySpecs"} & set(payload.keys()):
            return STRUCTURAL_DOCUMENT_UPDATE_IMPACT
        if set(payload.keys()) <= LIVE_SAFE_NODE_UPDATE_FIELDS:
            return LIVE_SAFE_DOCUMENT_UPDATE_IMPACT
        return STRUCTURAL_DOCUMENT_UPDATE_IMPACT

    def _sync_runtime_with_external_operation(
        self,
        *,
        operation: dict[str, Any],
        committed_document: dict[str, Any],
        impact: str,
    ) -> None:
        if impact == STRUCTURAL_DOCUMENT_UPDATE_IMPACT:
            self._pending_runtime_document = None
            self.runtime_controller.replace_document(
                committed_document,
                impact=STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
            )
            return

        runtime_document = self.runtime_controller.get_document()
        runtime_outcome = self.operation_applier.apply(runtime_document, operation)
        if runtime_outcome.changed and runtime_outcome.next_document is not None:
            self.runtime_controller.replace_document(
                runtime_outcome.next_document,
                impact=LIVE_SAFE_DOCUMENT_UPDATE_IMPACT,
            )
        else:
            self.runtime_controller.replace_document(
                committed_document,
                impact=LIVE_SAFE_DOCUMENT_UPDATE_IMPACT,
            )

        if self._is_runtime_active_state():
            self._cache_runtime_document(self.runtime_controller.get_document())

    def _commit_external_document(
        self,
        document: dict[str, Any],
        *,
        impact: str,
        notify_now: bool,
        origin_connection_id: str | None = None,
        response_document_delivered: bool = False,
    ) -> dict[str, Any] | None:
        committed_document = self.document_store.replace_document(document)
        if committed_document is None:
            return None
        if impact == STRUCTURAL_DOCUMENT_UPDATE_IMPACT:
            self._pending_runtime_document = None
        if notify_now:
            self._emit_document_notification(
                committed_document,
                origin_connection_id=origin_connection_id,
                response_document_delivered=response_document_delivered,
            )
        return committed_document

    def _ensure_params(self, method: str, params: Any) -> Any:
        model_type = METHOD_PARAM_MODELS.get(method)
        if model_type is None:
            if params is not None:
                raise AuthorityInvalidParamsError(method, "该 method 不接受 params")
            return None
        try:
            return validate_method_params(method, params)
        except ValidationError as error:
            raise AuthorityInvalidParamsError(method, error) from error

    def _create_notification(self, notification: str, params: Any) -> dict[str, Any]:
        validated = validate_notification_params(notification, params)
        return create_notification_envelope(
            notification,
            dump_notification_params(notification, validated),
        )

    def handle_request(
        self,
        method: str,
        params: Any,
        *,
        origin_connection_id: str | None = None,
    ) -> AuthorityMethodResponse:
        if method == AUTHORITY_RPC_DISCOVER_METHOD:
            result = create_discover_result()
            return AuthorityMethodResponse(
                method=method,
                value=validate_method_result(method, result),
            )

        validated_params = self._ensure_params(method, params)
        if method == AUTHORITY_GET_DOCUMENT_METHOD:
            result = self.document_store.get_document()
        elif method == AUTHORITY_SUBMIT_OPERATION_METHOD:
            payload = validated_params.model_dump(mode="json", exclude_unset=True)
            operation = payload["operation"]
            current_document = self.document_store.get_document()
            outcome = self.operation_applier.apply(
                current_document,
                operation,
            )
            result: dict[str, Any] = {
                "accepted": outcome.accepted,
                "changed": outcome.changed,
                "revision": current_document["revision"],
            }
            if outcome.reason is not None:
                result["reason"] = outcome.reason
            if outcome.changed and outcome.next_document is not None:
                impact = self._classify_operation_impact(operation)
                defer_notification = self._should_defer_live_safe_document_notification(
                    impact
                )
                response_document_delivered = not defer_notification
                committed_document = self._commit_external_document(
                    outcome.next_document,
                    impact=impact,
                    notify_now=not defer_notification,
                    origin_connection_id=origin_connection_id,
                    response_document_delivered=response_document_delivered,
                )
                if committed_document is not None:
                    result["revision"] = committed_document["revision"]
                    self._sync_runtime_with_external_operation(
                        operation=operation,
                        committed_document=committed_document,
                        impact=impact,
                    )
                    if response_document_delivered:
                        result["document"] = committed_document
        elif method == AUTHORITY_REPLACE_DOCUMENT_METHOD:
            payload = validated_params.model_dump(mode="json", exclude_unset=True)
            committed_document = self._commit_external_document(
                payload["document"],
                impact=STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
                notify_now=True,
                origin_connection_id=origin_connection_id,
                response_document_delivered=True,
            )
            if committed_document is not None:
                self.runtime_controller.replace_document(
                    committed_document,
                    impact=STRUCTURAL_DOCUMENT_UPDATE_IMPACT,
                )
            result = committed_document
        elif method == AUTHORITY_CONTROL_RUNTIME_METHOD:
            payload = validated_params.model_dump(mode="json", exclude_unset=True)
            result = self.runtime_controller.control(payload["request"])
            self._flush_pending_runtime_document()
        else:
            raise KeyError(method)

        return AuthorityMethodResponse(
            method=method,
            value=validate_method_result(method, result),
        )

    def create_document_notification(self, document: Any) -> dict[str, Any]:
        return self._create_notification(
            AUTHORITY_DOCUMENT_NOTIFICATION,
            document,
        )

    def create_document_diff_notification(self, diff: Any) -> dict[str, Any]:
        return self._create_notification(
            AUTHORITY_DOCUMENT_DIFF_NOTIFICATION,
            diff,
        )

    def create_runtime_feedback_notification(self, event: Any) -> dict[str, Any]:
        return self._create_notification(
            AUTHORITY_RUNTIME_FEEDBACK_NOTIFICATION,
            event,
        )

    def create_frontend_bundles_sync_notification(self, event: Any) -> dict[str, Any]:
        return self._create_notification(
            AUTHORITY_FRONTEND_BUNDLES_SYNC_NOTIFICATION,
            event,
        )

    def subscribe_document(
        self,
        listener: Callable[[dict[str, Any]], None],
    ) -> Callable[[], None]:
        self._document_listeners.add(listener)

        def dispose() -> None:
            self._document_listeners.discard(listener)

        return dispose

    def subscribe_document_payload(
        self,
        listener: Callable[[DocumentPayloadEvent], None],
    ) -> Callable[[], None]:
        self._document_payload_listeners.add(listener)

        def dispose() -> None:
            self._document_payload_listeners.discard(listener)

        return dispose

    def subscribe_runtime_feedback(
        self,
        listener: Callable[[dict[str, Any]], None],
    ) -> Callable[[], None]:
        return self.runtime_controller.subscribe(
            lambda event: listener(self.create_runtime_feedback_notification(event))
        )

    def subscribe_frontend_bundles(
        self,
        listener: Callable[[dict[str, Any]], None],
    ) -> Callable[[], None]:
        return self.frontend_bundles_provider.subscribe(
            lambda event: listener(self.create_frontend_bundles_sync_notification(event))
        )

    def create_frontend_bundles_snapshot_notification(self) -> dict[str, Any]:
        return self.create_frontend_bundles_sync_notification(
            self.frontend_bundles_provider.get_snapshot()
        )
