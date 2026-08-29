from __future__ import annotations

import traceback
from collections.abc import Callable
from pathlib import Path
from time import time

import requests
from specklepy.core.api.operations import (
    send,  # pyright: ignore[reportMissingTypeStubs]
)
from specklepy.transports.server import (
    ServerTransport,  # pyright: ignore[reportMissingTypeStubs]
)

from skp_importer.client import create_version, setup_client, update_progress
from skp_importer.domain import (
    FileimportError,
    FileimportPayload,
    FileimportResult,
    FileimportSuccess,
)
from skp_importer.skp_parser import SkpParser

ProgressCallback = Callable[[int | None, str | None, str | None, bool], None]


class ProgressReporter:
    def __init__(self, payload: FileimportPayload, client) -> None:
        self._payload = payload
        self._client = client
        self._last_progress: tuple[int | None, str | None, str | None] | None = None
        self._last_reported_at = 0.0

    def report(
        self,
        progress_percent: int | None,
        progress_phase: str | None,
        progress_message: str | None,
        force: bool = False,
    ) -> None:
        if progress_percent is not None:
            progress_percent = max(0, min(100, round(progress_percent)))

        next_progress = (progress_percent, progress_phase, progress_message)
        now = time()
        if not force:
            if next_progress == self._last_progress:
                return
            if self._last_reported_at:
                previous_percent = (
                    self._last_progress[0] if self._last_progress else None
                )
                percent_step = (
                    abs(progress_percent - previous_percent)
                    if progress_percent is not None and previous_percent is not None
                    else 0
                )
                if now - self._last_reported_at < 0.75 and percent_step < 2:
                    return

        update_progress(
            server_url=self._payload.server_url,
            token=self._payload.token,
            project_id=self._payload.project_id,
            job_id=self._payload.blob_id,
            progress_percent=progress_percent,
            progress_phase=progress_phase,
            progress_message=progress_message,
        )
        self._last_progress = next_progress
        self._last_reported_at = now


def _download_blob(
    payload: FileimportPayload,
    destination: Path,
    progress_callback: ProgressCallback | None = None,
) -> float:
    start = time()
    server_origin = payload.server_url.rstrip("/")
    blob_url = f"{server_origin}/api/stream/{payload.project_id}/blob/{payload.blob_id}"

    with requests.get(
        blob_url,
        headers={"Authorization": f"Bearer {payload.token}"},
        stream=True,
        timeout=300,
    ) as response:
        response.raise_for_status()
        total_bytes = int(response.headers.get("Content-Length") or 0)
        downloaded_bytes = 0
        with destination.open("wb") as output_file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output_file.write(chunk)
                    downloaded_bytes += len(chunk)
                    if progress_callback and total_bytes > 0:
                        progress_ratio = min(1.0, downloaded_bytes / total_bytes)
                        progress_callback(
                            int(5 + (progress_ratio * 20)),
                            "downloading_source",
                            "Downloading SketchUp (.skp) file",
                            False,
                        )

    return time() - start


def process_job(workdir_path: str, job_payload_json: str) -> None:
    workdir = Path(workdir_path)
    result_file = workdir / "result.json"

    try:
        payload = FileimportPayload.model_validate_json(job_payload_json)
        extension = Path(payload.file_name).suffix or f".{payload.file_type.lower()}"
        local_file = workdir / f"input{extension}"

        client = setup_client(payload)
        progress_reporter = ProgressReporter(payload, client)
        progress_reporter.report(
            2, "starting", f"Preparing SketchUp import for {payload.file_name}", True
        )

        download_duration_seconds = _download_blob(
            payload, local_file, progress_reporter.report
        )

        progress_reporter.report(
            28, "opening_skp", "Opening and parsing SketchUp model", True
        )

        stable_root_id = payload.model_id
        parser = SkpParser(
            local_file,
            stable_root_id=stable_root_id,
            progress_callback=progress_reporter.report,
        )

        parse_start = time()
        root = parser.parse()

        progress_reporter.report(
            85,
            "uploading_model_object",
            "Uploading converted SketchUp model",
            True,
        )

        transport = ServerTransport(client=client, stream_id=payload.project_id)
        object_id = send(root, transports=[transport])

        progress_reporter.report(
            95,
            "creating_version",
            "Creating model version",
            True,
        )

        version_id = create_version(
            server_url=payload.server_url,
            token=payload.token,
            project_id=payload.project_id,
            model_id=payload.model_id,
            object_id=object_id,
            message=f"Imported from SketchUp: {payload.file_name}",
            source_application="sketchup",
        )
        parse_duration_seconds = time() - parse_start

        progress_reporter.report(
            100, "completed", "SketchUp import completed successfully", True
        )

        outcome = FileimportSuccess(
            download_duration_seconds=download_duration_seconds,
            parse_duration_seconds=parse_duration_seconds,
            version_id=version_id,
        )
    except Exception as ex:
        if "progress_reporter" in locals():
            progress_reporter.report(
                None, "failed", f"SketchUp import failed: {ex}", True
            )
        outcome = FileimportError(reason=str(ex), stack_trace=traceback.format_exc())

    result_file.write_text(
        FileimportResult(outcome=outcome).model_dump_json(by_alias=True),
        encoding="utf-8",
    )
