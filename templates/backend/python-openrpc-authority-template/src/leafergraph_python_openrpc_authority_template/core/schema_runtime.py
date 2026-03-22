from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator


def pascal_case(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", " ", value)
    parts = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])", normalized)
    if not parts:
        parts = normalized.split()
    return "".join(part.capitalize() for part in parts if part)


def method_type_name(method_name: str, suffix: str) -> str:
    return "".join(pascal_case(segment) for segment in method_name.split(".")) + suffix


def notification_type_name(notification_name: str) -> str:
    return method_type_name(notification_name, "NotificationParams")


def _merge_object_schemas(
    base_schema: dict[str, Any],
    branch_schema: dict[str, Any],
) -> dict[str, Any]:
    merged = {key: value for key, value in base_schema.items() if key != "allOf"}
    if branch_schema.get("type") == "object" or "properties" in branch_schema:
        merged["type"] = "object"
    if "properties" in branch_schema:
        properties = dict(merged.get("properties", {}))
        properties.update(branch_schema["properties"])
        merged["properties"] = properties
    if "required" in branch_schema:
        required = list(merged.get("required", []))
        for item in branch_schema["required"]:
            if item not in required:
                required.append(item)
        merged["required"] = required
    if "additionalProperties" in branch_schema:
        merged["additionalProperties"] = branch_schema["additionalProperties"]
    if "oneOf" in branch_schema:
        merged["oneOf"] = branch_schema["oneOf"]
    if "anyOf" in branch_schema:
        merged["anyOf"] = branch_schema["anyOf"]
    return merged


def normalize_schema(schema: dict[str, Any]) -> dict[str, Any]:
    if "allOf" not in schema:
        return schema
    base_schema = {key: value for key, value in schema.items() if key != "allOf"}
    all_of = schema["allOf"]
    if len(all_of) == 1 and isinstance(all_of[0], dict) and "oneOf" in all_of[0]:
        return {
            "oneOf": [
                _merge_object_schemas(base_schema, branch) for branch in all_of[0]["oneOf"]
            ]
        }
    merged = dict(base_schema)
    for branch in all_of:
        if isinstance(branch, dict):
            merged = _merge_object_schemas(merged, branch)
    return merged


def _literal_type(values: list[Any]) -> Any:
    if len(values) == 1:
        return Literal.__getitem__(values[0])
    return Literal.__getitem__(tuple(values))


def _union_type(types: list[Any]) -> Any:
    unique_types: list[Any] = []
    for item in types:
        if item not in unique_types:
            unique_types.append(item)
    if not unique_types:
        return Any
    result = unique_types[0]
    for item in unique_types[1:]:
        result = result | item
    return result


def _validator_groups(
    schema: dict[str, Any],
) -> tuple[str, list[list[str]]] | None:
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if not isinstance(branches, list) or not branches:
            continue
        groups: list[list[str]] = []
        for branch in branches:
            if not isinstance(branch, dict) or set(branch.keys()) != {"required"}:
                groups = []
                break
            required = branch.get("required")
            if not isinstance(required, list) or not required:
                groups = []
                break
            groups.append(list(required))
        if groups:
            return keyword, groups
    return None


class OpenRpcBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


@dataclass(slots=True)
class OpenRpcContract:
    method_param_models: dict[str, type[BaseModel] | None]
    method_result_types: dict[str, Any]
    method_result_adapters: dict[str, TypeAdapter[Any]]
    notification_param_types: dict[str, Any]
    notification_param_adapters: dict[str, TypeAdapter[Any]]


class SchemaCompiler:
    def __init__(self, schemas: dict[str, dict[str, Any]], module_name: str) -> None:
        self._schemas = schemas
        self._module_name = module_name
        self._named_types: dict[str, Any] = {}

    def compile_named(self, schema_name: str) -> Any:
        if schema_name in self._named_types:
            return self._named_types[schema_name]
        compiled = self.compile(pascal_case(schema_name), self._schemas[schema_name])
        self._named_types[schema_name] = compiled
        return compiled

    def compile(self, name: str, schema: dict[str, Any]) -> Any:
        normalized = normalize_schema(schema)
        if "$ref" in normalized:
            return self.compile_named(normalized["$ref"])
        if "const" in normalized:
            return _literal_type([normalized["const"]])
        if "enum" in normalized:
            return _literal_type(list(normalized["enum"]))
        if "type" in normalized and isinstance(normalized["type"], list):
            return _union_type(
                [
                    self.compile(f"{name}{pascal_case(str(item))}", {"type": item})
                    for item in normalized["type"]
                ]
            )
        if "oneOf" in normalized or "anyOf" in normalized:
            keyword = "oneOf" if "oneOf" in normalized else "anyOf"
            validator_spec = _validator_groups(normalized)
            if validator_spec is not None and (
                normalized.get("type") == "object" or "properties" in normalized
            ):
                return self._build_object_model(name, normalized)
            return _union_type(
                [
                    self.compile_variant(name, branch, index)
                    for index, branch in enumerate(normalized[keyword])
                ]
            )
        schema_type = normalized.get("type")
        if schema_type == "string":
            return str
        if schema_type == "integer":
            return int
        if schema_type == "number":
            return float
        if schema_type == "boolean":
            return bool
        if schema_type == "null":
            return type(None)
        if schema_type == "array":
            item_type = self.compile(f"{name}Item", normalized.get("items", {}))
            return list[item_type]
        if schema_type == "object" or "properties" in normalized:
            if (
                not normalized.get("properties")
                and normalized.get("additionalProperties", True) is True
            ):
                return dict[str, Any]
            additional_properties = normalized.get("additionalProperties")
            if (
                not normalized.get("properties")
                and isinstance(additional_properties, dict)
            ):
                return dict[str, self.compile(f"{name}Value", additional_properties)]
            return self._build_object_model(name, normalized)
        return Any

    def compile_variant(
        self,
        parent_name: str,
        schema: dict[str, Any],
        index: int,
    ) -> Any:
        normalized = normalize_schema(schema)
        if "$ref" in normalized:
            return self.compile_named(normalized["$ref"])
        properties = normalized.get("properties", {})
        for discriminator in ("type", "mode", "format", "slot"):
            property_schema = properties.get(discriminator)
            if isinstance(property_schema, dict):
                if "const" in property_schema:
                    return self.compile(
                        f"{parent_name}{pascal_case(str(property_schema['const']))}",
                        normalized,
                    )
                if "enum" in property_schema and len(property_schema["enum"]) == 1:
                    return self.compile(
                        f"{parent_name}{pascal_case(str(property_schema['enum'][0]))}",
                        normalized,
                    )
        return self.compile(f"{parent_name}Variant{index + 1}", normalized)

    def _build_object_model(self, name: str, schema: dict[str, Any]) -> type[BaseModel]:
        existing = self._named_types.get(name)
        if existing is not None and isinstance(existing, type):
            return existing
        required = set(schema.get("required", []))
        annotations: dict[str, Any] = {}
        namespace: dict[str, Any] = {
            "__module__": self._module_name,
            "model_config": ConfigDict(
                extra="forbid" if schema.get("additionalProperties") is False else "allow",
                populate_by_name=True,
            ),
        }
        for property_name, property_schema in schema.get("properties", {}).items():
            annotation = self.compile(f"{name}{pascal_case(property_name)}", property_schema)
            if property_name not in required:
                annotation = annotation | None
            annotations[property_name] = annotation
            constraints = self._build_field_constraints(property_schema)
            if property_name in required:
                namespace[property_name] = Field(..., **constraints) if constraints else ...
            else:
                namespace[property_name] = (
                    Field(default=None, **constraints) if constraints else None
                )
        namespace["__annotations__"] = annotations
        validator_spec = _validator_groups(schema)
        if validator_spec is not None:
            keyword, groups = validator_spec

            def _validate_groups(self: BaseModel) -> BaseModel:
                matches = [
                    all(getattr(self, field_name) is not None for field_name in group)
                    for group in groups
                ]
                if keyword == "anyOf" and not any(matches):
                    raise ValueError("至少需要满足一组必填条件")
                if keyword == "oneOf" and sum(matches) != 1:
                    raise ValueError("只能满足一组必填条件")
                return self

            namespace["_validate_groups"] = model_validator(mode="after")(_validate_groups)
        model = type(name, (OpenRpcBaseModel,), namespace)
        self._named_types[name] = model
        return model

    @staticmethod
    def _build_field_constraints(schema: dict[str, Any]) -> dict[str, Any]:
        constraints: dict[str, Any] = {}
        if "minimum" in schema:
            constraints["ge"] = schema["minimum"]
        if "maximum" in schema:
            constraints["le"] = schema["maximum"]
        if "minItems" in schema:
            constraints["min_length"] = schema["minItems"]
        if "maxItems" in schema:
            constraints["max_length"] = schema["maxItems"]
        if "minLength" in schema:
            constraints["min_length"] = schema["minLength"]
        if "maxLength" in schema:
            constraints["max_length"] = schema["maxLength"]
        return constraints


def build_openrpc_contract(
    *,
    schemas: dict[str, dict[str, Any]],
    method_specs: dict[str, dict[str, Any]],
    notification_specs: dict[str, dict[str, Any]],
    module_name: str,
) -> OpenRpcContract:
    compiler = SchemaCompiler(schemas, module_name)
    method_param_models: dict[str, type[BaseModel] | None] = {}
    method_result_types: dict[str, Any] = {}
    method_result_adapters: dict[str, TypeAdapter[Any]] = {}
    notification_param_types: dict[str, Any] = {}
    notification_param_adapters: dict[str, TypeAdapter[Any]] = {}

    for method_name, spec in method_specs.items():
        params_schema = spec.get("params")
        if params_schema is None:
            method_param_models[method_name] = None
        else:
            method_param_models[method_name] = compiler.compile(
                method_type_name(method_name, "Params"),
                params_schema,
            )
        result_type = compiler.compile(
            method_type_name(method_name, "Result"),
            spec["result"],
        )
        method_result_types[method_name] = result_type
        method_result_adapters[method_name] = TypeAdapter(result_type)

    for notification_name, schema in notification_specs.items():
        notification_type = compiler.compile(
            notification_type_name(notification_name),
            schema,
        )
        notification_param_types[notification_name] = notification_type
        notification_param_adapters[notification_name] = TypeAdapter(notification_type)

    return OpenRpcContract(
        method_param_models=method_param_models,
        method_result_types=method_result_types,
        method_result_adapters=method_result_adapters,
        notification_param_types=notification_param_types,
        notification_param_adapters=notification_param_adapters,
    )
