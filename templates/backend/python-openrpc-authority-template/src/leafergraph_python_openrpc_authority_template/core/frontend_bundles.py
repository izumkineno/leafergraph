from __future__ import annotations

import time
from collections.abc import Callable
from copy import deepcopy
from typing import Any, Protocol

FrontendBundleListener = Callable[[dict[str, Any]], None]


def _clone(value: Any) -> Any:
    return deepcopy(value)


class FrontendBundleCatalogProvider(Protocol):
    def get_snapshot(self) -> dict[str, Any]:
        ...

    def subscribe(self, listener: FrontendBundleListener) -> Callable[[], None]:
        ...


class StaticFrontendBundleCatalogProvider:
    def __init__(self, packages: list[dict[str, Any]] | None = None) -> None:
        self._packages = _clone(packages or [])

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "type": "frontendBundles.sync",
            "mode": "full",
            "packages": _clone(self._packages),
            "emittedAt": time.time() * 1000,
        }

    def subscribe(self, listener: FrontendBundleListener) -> Callable[[], None]:
        def dispose() -> None:
            return None

        return dispose
