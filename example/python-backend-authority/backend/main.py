import os
from http.server import ThreadingHTTPServer

from .runtime_timer import TimerRequestHandler, TimerRuntimeService


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    service = TimerRuntimeService()
    TimerRequestHandler.runtime = service
    server = ThreadingHTTPServer(("127.0.0.1", port), TimerRequestHandler)
    print(f"Python backend timer authority demo listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
