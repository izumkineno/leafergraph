from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable

SYSTEM_TIMER_DEFAULT_INTERVAL_MS = 1000
SYSTEM_TIMER_INTERVAL_WIDGET_NAME = "intervalMs"
SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME = "immediate"


def clone_value(value: Any) -> Any:
    return deepcopy(value)


def ensure_node_properties(node: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(node.get("properties"), dict):
        node["properties"] = {}
    return node["properties"]


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
        trimmed = value.strip()
        return trimmed if trimmed else "EMPTY"
    if value is None:
        return "EMPTY"
    return "OBJECT"


def resolve_node_title_base(title: Any, fallback: str) -> str:
    safe_title = title.strip() if isinstance(title, str) else ""
    if not safe_title:
        return fallback
    for suffix in ("EMPTY", "NULL", "TRUE", "FALSE", "OBJECT"):
        if safe_title.endswith(f" {suffix}"):
            return safe_title[: -len(suffix) - 1]
    if safe_title.rsplit(" ", 1)[-1].isdigit():
        return safe_title.rsplit(" ", 1)[0]
    return safe_title


def resolve_timer_interval_ms(value: Any) -> int:
    try:
        next_value = float(value)
    except (TypeError, ValueError):
        return SYSTEM_TIMER_DEFAULT_INTERVAL_MS
    if next_value <= 0:
        return SYSTEM_TIMER_DEFAULT_INTERVAL_MS
    return max(1, int(next_value))


def resolve_timer_immediate(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return True


def resolve_timer_widget_value(node: dict[str, Any], widget_name: str) -> Any:
    for widget in node.get("widgets", []):
        if isinstance(widget, dict) and widget.get("name") == widget_name:
            return widget.get("value")
    return None


def sync_timer_widget_value(node: dict[str, Any], widget_name: str, value: Any) -> None:
    for widget in node.get("widgets", []):
        if isinstance(widget, dict) and widget.get("name") == widget_name:
            widget["value"] = value
            return


def execute_timer_node(node: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    properties = ensure_node_properties(node)
    interval_widget_value = resolve_timer_widget_value(
        node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME
    )
    immediate_widget_value = resolve_timer_widget_value(
        node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME
    )
    interval_ms = resolve_timer_interval_ms(
        interval_widget_value
        if interval_widget_value is not None
        else properties.get("intervalMs")
    )
    immediate = resolve_timer_immediate(
        immediate_widget_value
        if immediate_widget_value is not None
        else properties.get("immediate")
    )
    source = context["source"]
    run_id = context.get("runId")
    timer_runtime = context.get("timerRuntime")
    is_graph_source = source in ("graph-play", "graph-step")
    can_register_timer = bool(
        is_graph_source
        and isinstance(run_id, str)
        and timer_runtime
        and callable(timer_runtime.get("registerTimer"))
    )
    is_periodic_tick = bool(
        timer_runtime and timer_runtime.get("timerTickNodeId") == node["id"]
    )

    if can_register_timer:
        timer_runtime["registerTimer"](
            {
                "nodeId": node["id"],
                "source": source,
                "runId": run_id,
                "startedAt": context["startedAt"],
                "intervalMs": interval_ms,
                "immediate": immediate,
            }
        )

    should_emit_tick = (
        source == "node-play" or is_periodic_tick or immediate or not can_register_timer
    )

    properties["intervalMs"] = interval_ms
    properties["immediate"] = immediate
    sync_timer_widget_value(node, SYSTEM_TIMER_INTERVAL_WIDGET_NAME, interval_ms)
    sync_timer_widget_value(node, SYSTEM_TIMER_IMMEDIATE_WIDGET_NAME, immediate)
    node["title"] = "Timer"

    if not should_emit_tick:
        properties["status"] = f"WAIT {interval_ms}ms"
        return {
            "documentChanged": True,
            "timerActivated": can_register_timer,
            "outputPayloads": [],
        }

    previous_tick = properties.get("runCount", 0)
    next_tick = (
        previous_tick + 1
        if isinstance(previous_tick, (int, float)) and not isinstance(previous_tick, bool)
        else 1
    )
    timestamp = context["now"]()
    properties["runCount"] = next_tick
    properties["status"] = f"TICK {next_tick}"
    node["title"] = f"Timer {next_tick}"
    return {
        "documentChanged": True,
        "timerActivated": can_register_timer,
        "outputPayloads": [
            {
                "slot": 0,
                "payload": {
                    "timerNodeId": node["id"],
                    "tick": next_tick,
                    "intervalMs": interval_ms,
                    "timestamp": timestamp,
                    "source": source,
                    "runId": run_id,
                },
            }
        ],
    }


def execute_counter_node(node: dict[str, Any], _: dict[str, Any]) -> dict[str, Any]:
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


def execute_display_node(node: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    properties = ensure_node_properties(node)
    input_value = resolve_first_defined_input_value(context["inputValues"])
    display_value = format_authority_runtime_value(input_value)
    properties["lastValue"] = clone_value(input_value)
    properties["subtitle"] = "显示上游通过正式连线传播过来的值"
    properties["status"] = f"VALUE {display_value}"
    node["title"] = f"Display {display_value}"
    return {"documentChanged": True, "outputPayloads": []}


def execute_pending_node(node: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    properties = ensure_node_properties(node)
    previous_run_count = properties.get("runCount", 0)
    next_run_count = (
        previous_run_count + 1
        if isinstance(previous_run_count, (int, float)) and not isinstance(previous_run_count, bool)
        else 1
    )
    input_value = resolve_first_defined_input_value(context["inputValues"])
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
                        "authority": context["authorityName"],
                        "source": context["source"],
                        "runCount": next_run_count,
                    }
                    if input_value is None
                    else clone_value(input_value)
                ),
            }
        )
    return {"documentChanged": True, "outputPayloads": output_payloads}


def create_executors() -> dict[str, Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]]:
    return {
        "system/timer": execute_timer_node,
        "template/execute-counter": execute_counter_node,
        "template/execute-display": execute_display_node,
        "demo.pending": execute_pending_node,
    }
