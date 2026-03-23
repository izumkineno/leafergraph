from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import pprint
import shutil
import sys
from pathlib import Path
from typing import Any

TEMPLATE_ROOT = Path(__file__).resolve().parents[1]
OPENRPC_PATHS_MODULE_PATH = (
    TEMPLATE_ROOT
    / "src"
    / "leafergraph_python_openrpc_authority_template"
    / "core"
    / "openrpc_paths.py"
)


def load_openrpc_paths_module() -> Any:
    spec = importlib.util.spec_from_file_location(
        "leafergraph_python_openrpc_openrpc_paths",
        OPENRPC_PATHS_MODULE_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 OpenRPC 路径模块: {OPENRPC_PATHS_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


OPENRPC_PATHS_MODULE = load_openrpc_paths_module()
get_openrpc_path = OPENRPC_PATHS_MODULE.get_openrpc_path
get_schema_root = OPENRPC_PATHS_MODULE.get_schema_root

OPENRPC_PATH = get_openrpc_path()
SCHEMA_ROOT = get_schema_root()
PACKAGE_ROOT = TEMPLATE_ROOT / "src" / "leafergraph_python_openrpc_authority_template"
GENERATED_DIR = PACKAGE_ROOT / "_generated"
LEGACY_GENERATED_DIR = PACKAGE_ROOT / "generated"

ALLOWED_SCHEMA_KEYS = {
    "$id",
    "$ref",
    "$schema",
    "additionalProperties",
    "allOf",
    "anyOf",
    "const",
    "enum",
    "items",
    "maxItems",
    "maxLength",
    "maximum",
    "minItems",
    "minLength",
    "minimum",
    "oneOf",
    "properties",
    "required",
    "type",
}


def pascal_case(value: str) -> str:
    parts = [part for part in value.replace("-", "_").replace(".", "_").split("_") if part]
    return "".join(part[:1].upper() + part[1:] for part in parts)


def snake_case(value: str) -> str:
    normalized = value.replace(".", "_").replace("-", "_")
    normalized = "".join(
        f"_{char.lower()}" if char.isupper() else char for char in normalized
    )
    return normalized.strip("_")


def build_method_constant_name(method_name: str) -> str:
    if method_name == "rpc.discover":
        return "AUTHORITY_RPC_DISCOVER_METHOD"
    return snake_case(method_name).upper() + "_METHOD"


def build_notification_constant_name(notification_name: str) -> str:
    return snake_case(notification_name).upper() + "_NOTIFICATION"


def method_type_name(method_name: str, suffix: str) -> str:
    return "".join(pascal_case(segment) for segment in method_name.split(".")) + suffix


def notification_type_name(notification_name: str) -> str:
    return method_type_name(notification_name, "NotificationParams")


def notification_handler_name(notification_name: str) -> str:
    return snake_case(notification_name.split(".")[-1])


def notification_listener_attr(notification_name: str) -> str:
    return f"_{notification_handler_name(notification_name)}_listeners"


def schema_key_from_path(path: Path) -> str:
    name = path.name
    if name.endswith(".schema.json"):
        name = name[: -len(".schema.json")]
    elif name.endswith(".json"):
        name = name[: -len(".json")]
    return name


def read_openrpc_document() -> dict[str, Any]:
    return json.loads(OPENRPC_PATH.read_text(encoding="utf-8"))


def read_schema_bundle() -> dict[str, dict[str, Any]]:
    bundle: dict[str, dict[str, Any]] = {}
    for path in sorted(SCHEMA_ROOT.glob("*.json")):
        schema = json.loads(path.read_text(encoding="utf-8"))
        validate_supported_schema(schema, location=path.name)
        bundle[schema_key_from_path(path)] = rewrite_refs(schema, source_path=path)
    return bundle


def rewrite_refs(value: Any, *, source_path: Path) -> Any:
    if isinstance(value, dict):
        if "$ref" in value:
            ref_path = (source_path.parent / value["$ref"]).resolve()
            return {"$ref": schema_key_from_path(ref_path)}
        return {
            key: rewrite_refs(child, source_path=source_path)
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [rewrite_refs(item, source_path=source_path) for item in value]
    return value


def validate_supported_schema(
    schema: Any,
    *,
    location: str,
    property_map: bool = False,
) -> None:
    if isinstance(schema, list):
        for index, item in enumerate(schema):
            validate_supported_schema(item, location=f"{location}[{index}]")
        return
    if not isinstance(schema, dict):
        return
    if property_map:
        for key, value in schema.items():
            validate_supported_schema(value, location=f"{location}.{key}")
        return
    unsupported_keys = set(schema.keys()) - ALLOWED_SCHEMA_KEYS
    if unsupported_keys:
        unsupported = ", ".join(sorted(unsupported_keys))
        raise ValueError(f"{location} 含有当前生成器未支持的 schema 关键字: {unsupported}")
    for key, value in schema.items():
        validate_supported_schema(
            value,
            location=f"{location}.{key}",
            property_map=(key == "properties"),
        )


def build_method_specs(openrpc_document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    method_specs: dict[str, dict[str, Any]] = {}
    for method in openrpc_document["methods"]:
        params = method.get("params", [])
        params_schema = None
        if params:
            params_schema = {
                "type": "object",
                "required": [
                    param["name"] for param in params if param.get("required")
                ],
                "properties": {
                    param["name"]: rewrite_refs(param["schema"], source_path=OPENRPC_PATH)
                    for param in params
                },
                "additionalProperties": False,
            }
        method_specs[method["name"]] = {
            "params": params_schema,
            "result": rewrite_refs(method["result"]["schema"], source_path=OPENRPC_PATH),
        }
    return method_specs


def build_notification_specs(openrpc_document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    notification_specs: dict[str, dict[str, Any]] = {}
    for notification in openrpc_document["x-notifications"]:
        notification_specs[notification["name"]] = rewrite_refs(
            notification["params"][0]["schema"],
            source_path=OPENRPC_PATH,
        )
    return notification_specs


def compute_fingerprint() -> str:
    digest = hashlib.sha256()
    for path in [OPENRPC_PATH, *sorted(SCHEMA_ROOT.glob("*.json")), Path(__file__).resolve()]:
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _render_python_literal(value: Any) -> str:
    return pprint.pformat(value, width=100, sort_dicts=True)


def generate_methods_py(openrpc_document: dict[str, Any]) -> str:
    lines = [
        "from __future__ import annotations",
        "",
        "# 此文件由 tools/generate_from_openrpc.py 生成。",
        "",
    ]
    for method in openrpc_document["methods"]:
        lines.append(
            f"{build_method_constant_name(method['name'])} = {method['name']!r}"
        )
    lines.extend(["", "ALL_AUTHORITY_METHODS = frozenset({"])
    for method in openrpc_document["methods"]:
        lines.append(f"    {build_method_constant_name(method['name'])},")
    lines.extend(["})", ""])
    return "\n".join(lines)


def generate_notifications_py(openrpc_document: dict[str, Any]) -> str:
    lines = [
        "from __future__ import annotations",
        "",
        "# 此文件由 tools/generate_from_openrpc.py 生成。",
        "",
    ]
    for notification in openrpc_document["x-notifications"]:
        lines.append(
            f"{build_notification_constant_name(notification['name'])} = {notification['name']!r}"
        )
    lines.extend(["", "ALL_AUTHORITY_NOTIFICATIONS = frozenset({"])
    for notification in openrpc_document["x-notifications"]:
        lines.append(f"    {build_notification_constant_name(notification['name'])},")
    lines.extend(["})", ""])
    return "\n".join(lines)


def generate_schema_bundle_py(
    *,
    fingerprint: str,
    schema_bundle: dict[str, dict[str, Any]],
    method_specs: dict[str, dict[str, Any]],
    notification_specs: dict[str, dict[str, Any]],
) -> str:
    lines = [
        "from __future__ import annotations",
        "",
        "# 此文件由 tools/generate_from_openrpc.py 生成。",
        "",
        f"OPENRPC_FINGERPRINT = {fingerprint!r}",
        f"SCHEMAS = {_render_python_literal(schema_bundle)}",
        "",
        f"METHOD_SPECS = {_render_python_literal(method_specs)}",
        "",
        f"NOTIFICATION_SPECS = {_render_python_literal(notification_specs)}",
        "",
    ]
    return "\n".join(lines)


def generate_models_py(openrpc_document: dict[str, Any]) -> str:
    lines = [
        "from __future__ import annotations",
        "",
        "from typing import Any",
        "",
        "from ..core.schema_runtime import build_openrpc_contract",
        "from .schema_bundle import METHOD_SPECS, NOTIFICATION_SPECS, SCHEMAS",
        "from .methods import (",
    ]
    for method in openrpc_document["methods"]:
        lines.append(f"    {build_method_constant_name(method['name'])},")
    lines.extend([" )", "from .notifications import ("])
    for notification in openrpc_document["x-notifications"]:
        lines.append(f"    {build_notification_constant_name(notification['name'])},")
    lines.extend(
        [
            ")",
            "",
            "# 此文件由 tools/generate_from_openrpc.py 生成。",
            "",
            "_CONTRACT = build_openrpc_contract(",
            "    schemas=SCHEMAS,",
            "    method_specs=METHOD_SPECS,",
            "    notification_specs=NOTIFICATION_SPECS,",
            "    module_name=__name__,",
            ")",
            "",
            "METHOD_PARAM_MODELS = _CONTRACT.method_param_models",
            "METHOD_RESULT_TYPES = _CONTRACT.method_result_types",
            "METHOD_RESULT_ADAPTERS = _CONTRACT.method_result_adapters",
            "NOTIFICATION_PARAM_TYPES = _CONTRACT.notification_param_types",
            "NOTIFICATION_PARAM_ADAPTERS = _CONTRACT.notification_param_adapters",
            "",
        ]
    )
    for method in openrpc_document["methods"]:
        if method.get("params"):
            lines.append(
                f"{method_type_name(method['name'], 'Params')} = "
                f"METHOD_PARAM_MODELS[{build_method_constant_name(method['name'])}]"
            )
        lines.append(
            f"{method_type_name(method['name'], 'Result')} = "
            f"METHOD_RESULT_TYPES[{build_method_constant_name(method['name'])}]"
        )
    lines.append("")
    for notification in openrpc_document["x-notifications"]:
        lines.append(
            f"{notification_type_name(notification['name'])} = "
            f"NOTIFICATION_PARAM_TYPES[{build_notification_constant_name(notification['name'])}]"
        )
    lines.extend(
        [
            "",
            "def validate_method_params(method: str, value: Any) -> Any:",
            "    model = METHOD_PARAM_MODELS[method]",
            "    return model.model_validate(value)",
            "",
            "def validate_method_result(method: str, value: Any) -> Any:",
            "    return METHOD_RESULT_ADAPTERS[method].validate_python(value)",
            "",
            "def dump_method_result(method: str, value: Any) -> Any:",
            '    return METHOD_RESULT_ADAPTERS[method].dump_python(value, mode="json", exclude_none=True)',
            "",
            "def validate_notification_params(method: str, value: Any) -> Any:",
            "    return NOTIFICATION_PARAM_ADAPTERS[method].validate_python(value)",
            "",
            "def dump_notification_params(method: str, value: Any) -> Any:",
            '    return NOTIFICATION_PARAM_ADAPTERS[method].dump_python(value, mode="json", exclude_none=True)',
            "",
            "__all__ = [",
        ]
    )
    for method in openrpc_document["methods"]:
        if method.get("params"):
            lines.append(f'    "{method_type_name(method["name"], "Params")}",')
        lines.append(f'    "{method_type_name(method["name"], "Result")}",')
    for notification in openrpc_document["x-notifications"]:
        lines.append(f'    "{notification_type_name(notification["name"])}",')
    lines.extend(
        [
            '    "METHOD_PARAM_MODELS",',
            '    "METHOD_RESULT_ADAPTERS",',
            '    "METHOD_RESULT_TYPES",',
            '    "NOTIFICATION_PARAM_ADAPTERS",',
            '    "NOTIFICATION_PARAM_TYPES",',
            '    "dump_method_result",',
            '    "dump_notification_params",',
            '    "validate_method_params",',
            '    "validate_method_result",',
            '    "validate_notification_params",',
            "]",
            "",
        ]
    )
    return "\n".join(lines)


def generate_client_py(openrpc_document: dict[str, Any]) -> str:
    lines = [
        "from __future__ import annotations",
        "",
        "import asyncio",
        "import json",
        "from itertools import count",
        "from typing import Any, Awaitable, Callable",
        "",
        "import websockets",
        "",
        "from ..core.jsonrpc import (",
        "    JsonRpcErrorResponseEnvelope,",
        "    JsonRpcNotificationEnvelope,",
        "    JsonRpcSuccessResponseEnvelope,",
        "    create_request_envelope,",
        ")",
        "from .methods import (",
    ]
    for method in openrpc_document["methods"]:
        lines.append(f"    {build_method_constant_name(method['name'])},")
    lines.extend([" )", "from .models import ("])
    for method in openrpc_document["methods"]:
        if method.get("params"):
            lines.append(f"    {method_type_name(method['name'], 'Params')},")
        lines.append(f"    {method_type_name(method['name'], 'Result')},")
    for notification in openrpc_document["x-notifications"]:
        lines.append(f"    {notification_type_name(notification['name'])},")
    lines.extend(
        [
            "    validate_method_result,",
            "    validate_notification_params,",
            ")",
            "from .notifications import (",
        ]
    )
    for notification in openrpc_document["x-notifications"]:
        lines.append(f"    {build_notification_constant_name(notification['name'])},")
    lines.extend(
        [
            ")",
            "",
            "# 此文件由 tools/generate_from_openrpc.py 生成。",
            "",
            "NotificationListener = Callable[[Any], Awaitable[None] | None]",
            "",
            "",
            "class AuthorityRpcError(RuntimeError):",
            "    def __init__(self, code: int, message: str, data: Any | None = None) -> None:",
            "        self.code = code",
            "        self.data = data",
            "        super().__init__(message)",
            "",
            "",
            "class AuthorityRpcClient:",
            "    def __init__(self, uri: str) -> None:",
            "        self._uri = uri",
            "        self._websocket: Any | None = None",
            "        self._receiver_task: asyncio.Task[None] | None = None",
            "        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}",
            "        self._id_counter = count(1)",
            "        self._send_lock = asyncio.Lock()",
        ]
    )
    for notification in openrpc_document["x-notifications"]:
        lines.append(
            f"        self.{notification_listener_attr(notification['name'])}: set[NotificationListener] = set()"
        )
    lines.extend(
        [
            "",
            '    async def __aenter__(self) -> "AuthorityRpcClient":',
            "        await self.connect()",
            "        return self",
            "",
            "    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:",
            "        await self.close()",
            "",
            "    async def connect(self) -> None:",
            "        if self._websocket is not None:",
            "            return",
            "        self._websocket = await websockets.connect(self._uri)",
            "        self._receiver_task = asyncio.create_task(self._receiver_loop())",
            "",
            "    async def close(self) -> None:",
            "        websocket = self._websocket",
            "        receiver_task = self._receiver_task",
            "        self._websocket = None",
            "        self._receiver_task = None",
            "        if websocket is not None:",
            "            await websocket.close()",
            "        if receiver_task is not None:",
            "            receiver_task.cancel()",
            "            try:",
            "                await receiver_task",
            "            except asyncio.CancelledError:",
            "                pass",
            "",
        ]
    )
    for notification in openrpc_document["x-notifications"]:
        lines.extend(
            [
                f"    def on_{notification_handler_name(notification['name'])}(self, listener: Callable[[{notification_type_name(notification['name'])}], Awaitable[None] | None]) -> Callable[[], None]:",
                f"        self.{notification_listener_attr(notification['name'])}.add(listener)",
                f"        return lambda: self.{notification_listener_attr(notification['name'])}.discard(listener)",
                "",
            ]
        )
    lines.extend(
        [
            "    async def _receiver_loop(self) -> None:",
            "        websocket = self._websocket",
            "        if websocket is None:",
            "            return",
            "        try:",
            "            async for payload in websocket:",
            "                message = json.loads(payload)",
            "                if isinstance(message, dict) and 'id' in message and ('result' in message or 'error' in message):",
            "                    request_id = str(message.get('id'))",
            "                    future = self._pending.pop(request_id, None)",
            "                    if future is not None and not future.done():",
            "                        future.set_result(message)",
            "                    continue",
            "                if isinstance(message, dict) and 'method' in message:",
            "                    await self._handle_notification(message)",
            "        finally:",
            "            for future in self._pending.values():",
            "                if not future.done():",
            "                    future.set_exception(RuntimeError('authority websocket 已关闭'))",
            "            self._pending.clear()",
            "",
            "    async def _handle_notification(self, message: dict[str, Any]) -> None:",
            "        envelope = JsonRpcNotificationEnvelope.model_validate(message)",
        ]
    )
    for notification in openrpc_document["x-notifications"]:
        lines.extend(
            [
                f"        if envelope.method == {build_notification_constant_name(notification['name'])}:",
                "            validated = validate_notification_params(envelope.method, envelope.params)",
                f"            await self._emit(self.{notification_listener_attr(notification['name'])}, validated)",
                "            return",
            ]
        )
    lines.extend(
        [
            "",
            "    async def _emit(self, listeners: set[NotificationListener], payload: Any) -> None:",
            "        for listener in list(listeners):",
            "            result = listener(payload)",
            "            if asyncio.iscoroutine(result):",
            "                await result",
            "",
            "    async def _request(self, method: str, params: Any | None = None) -> Any:",
            "        if self._websocket is None:",
            "            await self.connect()",
            "        websocket = self._websocket",
            "        assert websocket is not None",
            "        request_id = str(next(self._id_counter))",
            "        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()",
            "        self._pending[request_id] = future",
            "        async with self._send_lock:",
            "            await websocket.send(json.dumps(create_request_envelope(request_id, method, params)))",
            "        response_payload = await future",
            "        if 'error' in response_payload:",
            "            response = JsonRpcErrorResponseEnvelope.model_validate(response_payload)",
            "            raise AuthorityRpcError(response.error.code, response.error.message, response.error.data)",
            "        response = JsonRpcSuccessResponseEnvelope.model_validate(response_payload)",
            "        return validate_method_result(method, response.result)",
            "",
        ]
    )
    for method in openrpc_document["methods"]:
        wrapper_name = snake_case(method["name"].split(".")[-1])
        result_name = method_type_name(method["name"], "Result")
        if method.get("params"):
            params_name = method_type_name(method["name"], "Params")
            lines.extend(
                [
                    f"    async def {wrapper_name}(self, params: {params_name}) -> {result_name}:",
                    "        return await self._request(",
                    f"            {build_method_constant_name(method['name'])},",
                    '            params.model_dump(mode="json", exclude_unset=True),',
                    "        )",
                    "",
                ]
            )
        else:
            lines.extend(
                [
                    f"    async def {wrapper_name}(self) -> {result_name}:",
                    f"        return await self._request({build_method_constant_name(method['name'])})",
                    "",
                ]
            )
    lines.extend(
        [
            "__all__ = [",
            '    "AuthorityRpcClient",',
            '    "AuthorityRpcError",',
            "]",
            "",
        ]
    )
    return "\n".join(lines)


def generate_generated_init(openrpc_document: dict[str, Any]) -> str:
    lines = [
        "# 此文件由 tools/generate_from_openrpc.py 生成。",
        "from .client import AuthorityRpcClient, AuthorityRpcError",
        "from .methods import *",
        "from .models import *",
        "from .notifications import *",
        "",
        "__all__ = [",
        '    "AuthorityRpcClient",',
        '    "AuthorityRpcError",',
    ]
    for method in openrpc_document["methods"]:
        if method.get("params"):
            lines.append(f'    "{method_type_name(method["name"], "Params")}",')
        lines.append(f'    "{method_type_name(method["name"], "Result")}",')
    for notification in openrpc_document["x-notifications"]:
        lines.append(f'    "{notification_type_name(notification["name"])}",')
    lines.extend(["]", ""])
    return "\n".join(lines)


def expected_files() -> dict[Path, str]:
    openrpc_document = read_openrpc_document()
    fingerprint = compute_fingerprint()
    schema_bundle = read_schema_bundle()
    method_specs = build_method_specs(openrpc_document)
    notification_specs = build_notification_specs(openrpc_document)
    return {
        GENERATED_DIR / "__init__.py": generate_generated_init(openrpc_document),
        GENERATED_DIR / "methods.py": generate_methods_py(openrpc_document),
        GENERATED_DIR / "notifications.py": generate_notifications_py(openrpc_document),
        GENERATED_DIR / "schema_bundle.py": generate_schema_bundle_py(
            fingerprint=fingerprint,
            schema_bundle=schema_bundle,
            method_specs=method_specs,
            notification_specs=notification_specs,
        ),
        GENERATED_DIR / "models.py": generate_models_py(openrpc_document),
        GENERATED_DIR / "client.py": generate_client_py(openrpc_document),
        GENERATED_DIR / ".fingerprint": fingerprint + "\n",
    }


def write_files(files: dict[Path, str]) -> None:
    if LEGACY_GENERATED_DIR.exists():
        shutil.rmtree(LEGACY_GENERATED_DIR)
    if GENERATED_DIR.exists():
        shutil.rmtree(GENERATED_DIR)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    for path, content in files.items():
        path.write_text(content, encoding="utf-8")


def check_files(files: dict[Path, str]) -> int:
    stale_paths: list[Path] = []
    if LEGACY_GENERATED_DIR.exists():
        stale_paths.append(LEGACY_GENERATED_DIR)
    for path, expected in files.items():
        if not path.exists() or path.read_text(encoding="utf-8") != expected:
            stale_paths.append(path)
    if not stale_paths:
        return 0
    print("以下 OpenRPC 生成物需要同步：", file=sys.stderr)
    for path in stale_paths:
        print(f"- {path}", file=sys.stderr)
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="根据共享 OpenRPC 真源生成 python-openrpc-authority-template 的轻量产物。"
    )
    parser.add_argument("--write", action="store_true", help="写入 _generated/ 目录。")
    parser.add_argument("--check", action="store_true", help="检查 _generated/ 是否过期。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    files = expected_files()
    if args.check:
        return check_files(files)
    write_files(files)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
