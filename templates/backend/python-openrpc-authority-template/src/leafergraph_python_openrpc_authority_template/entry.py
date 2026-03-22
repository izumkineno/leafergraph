from __future__ import annotations

from .core.bootstrap import ensure_generated
from .transport.server import main

ensure_generated()


if __name__ == "__main__":
    main()
