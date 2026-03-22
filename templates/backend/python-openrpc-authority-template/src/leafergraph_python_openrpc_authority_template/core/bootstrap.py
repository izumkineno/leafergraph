from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path
from threading import Lock

_BOOTSTRAP_LOCK = Lock()
_GENERATION_CHECKED = False


def get_template_root() -> Path:
    return Path(__file__).resolve().parents[3]


def get_package_root() -> Path:
    return get_template_root() / "src" / "leafergraph_python_openrpc_authority_template"


def get_generated_dir() -> Path:
    return get_package_root() / "_generated"


def get_generator_script_path() -> Path:
    return get_template_root() / "tools" / "generate_from_openrpc.py"


def get_openrpc_path() -> Path:
    return get_template_root().parent / "shared" / "openrpc" / "authority.openrpc.json"


def _schema_paths() -> list[Path]:
    schema_root = get_openrpc_path().parent / "schemas"
    return sorted(schema_root.glob("*.json"))


def compute_openrpc_fingerprint() -> str:
    digest = hashlib.sha256()
    for path in [get_openrpc_path(), *_schema_paths(), get_generator_script_path()]:
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _fingerprint_file_path() -> Path:
    return get_generated_dir() / ".fingerprint"


def _read_generated_fingerprint() -> str | None:
    path = _fingerprint_file_path()
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8").strip() or None


def is_generated_fresh() -> bool:
    generated_dir = get_generated_dir()
    required_paths = [
        generated_dir / "__init__.py",
        generated_dir / "methods.py",
        generated_dir / "notifications.py",
        generated_dir / "schema_bundle.py",
        generated_dir / "models.py",
        generated_dir / "client.py",
        _fingerprint_file_path(),
    ]
    if not all(path.exists() for path in required_paths):
        return False
    return _read_generated_fingerprint() == compute_openrpc_fingerprint()


def ensure_generated() -> None:
    global _GENERATION_CHECKED

    if _GENERATION_CHECKED and is_generated_fresh():
        return

    with _BOOTSTRAP_LOCK:
        if _GENERATION_CHECKED and is_generated_fresh():
            return
        if not is_generated_fresh():
            subprocess.run(
                [sys.executable, str(get_generator_script_path()), "--write"],
                cwd=get_template_root(),
                check=True,
            )
        if not is_generated_fresh():
            raise RuntimeError("OpenRPC 生成物未能成功同步到 _generated/")
        _GENERATION_CHECKED = True
