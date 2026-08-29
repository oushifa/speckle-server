import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from time import time
from typing import cast

import requests
from gql import gql
from ifcopenshell.ifcopenshell_wrapper import TriangulationElement
from speckleifc.converter.geometry_converter import geometry_to_speckle
from speckleifc.ifc_geometry_processing import create_geometry_iterator, open_ifc
from speckleifc.importer import ImportJob
from specklepy.core.api.inputs.version_inputs import CreateVersionInput
from specklepy.core.api.operations import send
from specklepy.transports.server import ServerTransport

from ifc_importer.client import setup_client
from ifc_importer.domain import (
    FileimportError,
    FileimportPayload,
    FileimportResult,
    FileimportSuccess,
)

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

        try:
            self._client.httpclient.execute(
                gql(
                    """
                    mutation UpdateFileImportProgress(
                        $input: UpdateFileImportProgressInput!
                    ) {
                        fileUploadMutations {
                            updateFileImportProgress(input: $input)
                        }
                    }
                    """
                ),
                variable_values={
                    "input": {
                        "projectId": self._payload.project_id,
                        "jobId": self._payload.blob_id,
                        "progressPercent": progress_percent,
                        "progressPhase": progress_phase,
                        "progressMessage": progress_message,
                    }
                },
            )
            self._last_progress = next_progress
            self._last_reported_at = now
        except Exception as ex:
            print(f"Failed to report file import progress: {ex}")


@dataclass
class ProgressImportJob(ImportJob):
    progress_callback: ProgressCallback | None = None
    root_elements_total: int = field(default=1, init=False)
    converted_root_elements: int = field(default=0, init=False)
    geometry_estimate_total: int = field(default=1, init=False)

    def __post_init__(self) -> None:
        self.root_elements_total = max(1, len(self.ifc_file.by_type("IfcRoot", False)))
        self.geometry_estimate_total = max(
            1, len(self.ifc_file.by_type("IfcProduct", False))
        )

    def convert_element(self, step_element) -> object:
        result = super().convert_element(step_element)
        if step_element.is_a("IfcRoot"):
            self.converted_root_elements += 1
            if self.progress_callback:
                progress_ratio = self.converted_root_elements / self.root_elements_total
                self.progress_callback(
                    int(55 + (progress_ratio * 30)),
                    "converting_objects",
                    (
                        "Converting IFC object tree"
                        + " ("
                        + f"{self.converted_root_elements}/{self.root_elements_total}"
                        + ")"
                    ),
                    False,
                )
        return result

    def pre_process_geometry(self) -> None:
        iterator = create_geometry_iterator(self.ifc_file)
        if not iterator.initialize():
            raise ValueError("Failed to find any geometry in file")

        self.geometries_count = 0
        if self.progress_callback:
            self.progress_callback(
                30,
                "preprocessing_geometry",
                "Pre-processing IFC geometry",
                True,
            )

        while True:
            shape = cast(TriangulationElement, iterator.get())
            self.geometries_count += 1
            geometry_id = cast(int, shape.id)

            try:
                display_value = geometry_to_speckle(
                    shape, self._render_material_manager
                )
                self.cached_display_values[geometry_id] = display_value
            except Exception as ex:
                raise ValueError(
                    f"Failed to convert geometry with id: {geometry_id}"
                ) from ex

            if self.progress_callback and (
                self.geometries_count == 1 or self.geometries_count % 200 == 0
            ):
                progress_ratio = min(
                    1.0, self.geometries_count / self.geometry_estimate_total
                )
                self.progress_callback(
                    int(30 + (progress_ratio * 25)),
                    "preprocessing_geometry",
                    (
                        "Pre-processing IFC geometry"
                        + f" ({self.geometries_count} processed)"
                    ),
                    False,
                )

            if not iterator.next():
                break


def _download_blob(
    payload: FileimportPayload,
    destination: Path,
    progress_callback: ProgressCallback | None = None,
) -> float:
    start = time()
    blob_url = (
        f"{payload.server_url.rstrip('/')}/api/stream/{payload.project_id}/blob/{payload.blob_id}"
    )

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
                            "Downloading source IFC file",
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
            2, "starting", f"Preparing IFC import for {payload.file_name}", True
        )
        project = client.project.get(payload.project_id)

        download_duration_seconds = _download_blob(
            payload, local_file, progress_reporter.report
        )

        progress_reporter.report(
            28, "opening_ifc", "Opening IFC file", True
        )

        account = client.account
        remote_transport = ServerTransport(project.id, account=account)
        ifc_file = open_ifc(str(local_file))

        parse_start = time()
        import_job = ProgressImportJob(
            ifc_file=ifc_file, progress_callback=progress_reporter.report
        )
        data = import_job.convert()
        progress_reporter.report(
            88,
            "uploading_model_object",
            "Uploading converted model",
            True,
        )
        root_id = send(data, transports=[remote_transport], use_default_cache=False)
        progress_reporter.report(
            96,
            "creating_version",
            "Creating model version",
            True,
        )
        create_version = CreateVersionInput(
            object_id=root_id,
            model_id=payload.model_id,
            project_id=project.id,
            message=f"Imported from file: {payload.file_name}",
            source_application="ifc",
        )
        version = client.version.create(create_version)
        parse_duration_seconds = time() - parse_start

        version_id = getattr(version, "id", None)
        if not version_id:
            raise ValueError("Converter did not return a version id")

        progress_reporter.report(
            100, "completed", "IFC import completed", True
        )

        outcome = FileimportSuccess(
            download_duration_seconds=download_duration_seconds,
            parse_duration_seconds=parse_duration_seconds,
            version_id=version_id,
        )
    except Exception as ex:
        if "progress_reporter" in locals():
            progress_reporter.report(
                None, "failed", f"IFC import failed: {ex}", True
            )
        outcome = FileimportError(reason=str(ex), stack_trace=traceback.format_exc())

    result_file.write_text(
        FileimportResult(outcome=outcome).model_dump_json(by_alias=True),
        encoding="utf-8",
    )
