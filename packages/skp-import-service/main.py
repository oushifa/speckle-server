import asyncio
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from multiprocessing import Process

import structlog
from prometheus_client import start_http_server
from structlog_to_seq import CelfProcessor

from skp_importer.config import settings
from skp_importer.job_manager import job_manager


def configure_logger() -> structlog.stdlib.BoundLogger:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=logging.DEBUG)

    structlog.configure(
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        processors=[
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.stdlib.add_log_level,
            CelfProcessor(),
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
    )
    return structlog.stdlib.get_logger()


class HealthcheckHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path == "/healthz":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "OK"}')
        else:
            self.send_response(404)
            self.end_headers()


def run_healthcheck_server(port: int) -> None:
    httpd = HTTPServer(("0.0.0.0", port), HealthcheckHTTPRequestHandler)
    httpd.serve_forever()


async def main():
    logger = configure_logger()
    task = asyncio.create_task(job_manager(logger))
    healthcheck_port = getattr(settings, "skp_importer_healthcheck_port", 9082)
    metrics_port = getattr(settings, "skp_importer_metrics_port", 9095)

    healthcheck_server_process = Process(
        target=run_healthcheck_server, args=(healthcheck_port,), daemon=True
    )
    healthcheck_server_process.start()
    start_http_server(metrics_port)

    try:
        await task
    except Exception as ex:
        logger.error(
            "Execution failed with exception: {message}", message=str(ex), exc_info=ex
        )
        raise
    finally:
        healthcheck_server_process.terminate()
        healthcheck_server_process.join()


if __name__ == "__main__":
    asyncio.run(main())
