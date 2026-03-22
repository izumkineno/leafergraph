from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

AUTHORITY_JSON_RPC_VERSION = "2.0"

AUTHORITY_JSON_RPC_ERROR_CODES = {
    "parse_error": -32700,
    "invalid_request": -32600,
    "method_not_found": -32601,
    "invalid_params": -32602,
    "internal_error": -32603,
}


class JsonRpcRequestEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jsonrpc: Literal["2.0"]
    id: str | int
    method: str
    params: Any | None = None


class JsonRpcNotificationEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jsonrpc: Literal["2.0"]
    method: str
    params: Any | None = None


class JsonRpcSuccessResponseEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jsonrpc: Literal["2.0"]
    id: str | int | None
    result: Any


class JsonRpcErrorObject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: int
    message: str
    data: Any | None = None


class JsonRpcErrorResponseEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jsonrpc: Literal["2.0"]
    id: str | int | None
    error: JsonRpcErrorObject


def create_request_envelope(
    request_id: str | int,
    method: str,
    params: Any | None = None,
) -> dict[str, Any]:
    return JsonRpcRequestEnvelope(
        jsonrpc=AUTHORITY_JSON_RPC_VERSION,
        id=request_id,
        method=method,
        params=params,
    ).model_dump(mode="json", exclude_none=True)


def create_success_envelope(
    request_id: str | int | None,
    result: Any,
) -> dict[str, Any]:
    return JsonRpcSuccessResponseEnvelope(
        jsonrpc=AUTHORITY_JSON_RPC_VERSION,
        id=request_id,
        result=result,
    ).model_dump(mode="json", exclude_none=True)


def create_error_envelope(
    request_id: str | int | None,
    code: int,
    message: str,
    data: Any | None = None,
) -> dict[str, Any]:
    return JsonRpcErrorResponseEnvelope(
        jsonrpc=AUTHORITY_JSON_RPC_VERSION,
        id=request_id,
        error=JsonRpcErrorObject(code=code, message=message, data=data),
    ).model_dump(mode="json", exclude_none=True)


def create_notification_envelope(
    method: str,
    params: Any | None = None,
) -> dict[str, Any]:
    return JsonRpcNotificationEnvelope(
        jsonrpc=AUTHORITY_JSON_RPC_VERSION,
        method=method,
        params=params,
    ).model_dump(mode="json", exclude_none=True)
