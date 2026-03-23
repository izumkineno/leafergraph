from __future__ import annotations

from pathlib import Path

from .conformance_support import load_json, load_manifest, resolve_conformance_path, shared_openrpc_root


def _request_method_name(path: Path) -> str | None:
    if path.suffix != ".json":
        return None
    payload = load_json(path)
    if isinstance(payload, dict):
        method = payload.get("method")
        if isinstance(method, str):
            return method
    return None


def _notification_method_name(path: Path) -> str | None:
    payload = load_json(path)
    if not isinstance(payload, dict):
        return None
    expectation_payload = payload.get("payload")
    if not isinstance(expectation_payload, dict):
        return None
    method = expectation_payload.get("method")
    if isinstance(method, str):
        return method
    return None


def test_conformance_manifest_has_unique_ids_and_existing_fixtures() -> None:
    manifest = load_manifest()
    scenario_ids: list[str] = []

    for scenario in manifest["scenarios"]:
        scenario_ids.append(scenario["id"])

        request_fixture = scenario["requestFixture"]
        if request_fixture:
            assert resolve_conformance_path(request_fixture).exists()

        expected_response_fixture = scenario["expectedResponseFixture"]
        if expected_response_fixture:
            response_fixture_path = resolve_conformance_path(expected_response_fixture)
            assert response_fixture_path.exists()
            expectation = load_json(response_fixture_path)
            if expectation.get("mode") == "result-equals-file":
                payload_file = (response_fixture_path.parent / expectation["payloadFile"]).resolve()
                assert payload_file.exists()

        for notification_fixture in scenario["expectedNotificationFixtures"]:
            assert resolve_conformance_path(notification_fixture).exists()

    assert len(scenario_ids) == len(set(scenario_ids))


def test_conformance_manifest_methods_and_notifications_align_with_openrpc_document() -> None:
    manifest = load_manifest()
    document = load_json(shared_openrpc_root() / "authority.openrpc.json")
    method_names = {method["name"] for method in document["methods"]}
    notification_names = {
        notification["name"] for notification in document["x-notifications"]
    }

    for scenario in manifest["scenarios"]:
        request_fixture = scenario["requestFixture"]
        if request_fixture:
            request_method = _request_method_name(resolve_conformance_path(request_fixture))
            if request_method is not None:
                if scenario["id"] == "error.method_not_found":
                    assert request_method not in method_names
                else:
                    assert request_method in method_names

        for notification_fixture in scenario["expectedNotificationFixtures"]:
            notification_method = _notification_method_name(
                resolve_conformance_path(notification_fixture)
            )
            if notification_method is not None:
                assert notification_method in notification_names


def test_conformance_manifest_contains_required_core_and_advanced_scenarios() -> None:
    manifest = load_manifest()
    scenario_ids = {scenario["id"] for scenario in manifest["scenarios"]}

    required_ids = {
        "health.ok",
        "discover.exact",
        "get_document.empty",
        "replace_document.changed",
        "submit_operation.node_create",
        "document.full_sync.observer_notification",
        "control_runtime.graph_step",
        "error.parse_error",
        "error.invalid_request",
        "error.method_not_found",
        "error.invalid_params",
        "frontend_bundles.initial_full_snapshot",
        "document_diff.observer_baseline",
        "runtime_feedback.step_chain",
        "document_full_fallback.on_missing_baseline",
    }

    assert required_ids <= scenario_ids
