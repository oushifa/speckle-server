import traceback
from pathlib import Path
from time import time

import requests
from speckleifc.main import open_and_convert_file

from ifc_importer.client import setup_client
from ifc_importer.domain import (
    FileimportError,
    FileimportPayload,
    FileimportResult,
    FileimportSuccess,
)


def _download_blob(payload: FileimportPayload, destination: Path) -> float:
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
        with destination.open("wb") as output_file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output_file.write(chunk)

    return time() - start


def process_job(workdir_path: str, job_payload_json: str) -> None:
    workdir = Path(workdir_path)
    result_file = workdir / "result.json"

    try:
        payload = FileimportPayload.model_validate_json(job_payload_json)
        extension = Path(payload.file_name).suffix or f".{payload.file_type.lower()}"
        local_file = workdir / f"input{extension}"

        client = setup_client(payload)
        project = client.project.get(payload.project_id)

        download_duration_seconds = _download_blob(payload, local_file)

        parse_start = time()
        version = open_and_convert_file(
            file_path=str(local_file),
            project=project,
            version_message=f"Imported from file: {payload.file_name}",
            model_id=payload.model_id,
            client=client,
        )
        parse_duration_seconds = time() - parse_start

        version_id = getattr(version, "id", None)
        if not version_id:
            raise ValueError("Converter did not return a version id")

        outcome = FileimportSuccess(
            download_duration_seconds=download_duration_seconds,
            parse_duration_seconds=parse_duration_seconds,
            version_id=version_id,
        )
    except Exception as ex:
        outcome = FileimportError(reason=str(ex), stack_trace=traceback.format_exc())

    result_file.write_text(
        FileimportResult(outcome=outcome).model_dump_json(by_alias=True), encoding="utf-8"
    )
