import asyncio
import base64
import contextlib
import sys
import tempfile
import time
from math import floor
from pathlib import Path

import structlog
from specklepy.core.api.inputs.file_import_inputs import (
    FileImportErrorInput,
    FileImportResult,
    FileImportSuccessInput,
)
from specklepy.logging import metrics

from dxf_importer.client import setup_client
from dxf_importer.domain import FileimportError, FileimportResult, JobStatus
from dxf_importer.repository import (
    deduct_from_compute_budget,
    get_next_job,
    return_job_to_queued,
    set_job_status,
    setup_connection,
)

IDLE_TIMEOUT = 1


class JobPausedException(Exception):
    """Raised when the job is paused by an administrator."""
    pass


async def _watch_job_paused(connection, job_id: str, poll_interval: float = 1.0) -> None:
    """Watch if job status in DB is changed to paused."""
    while True:
        await asyncio.sleep(poll_interval)
        try:
            row = await connection.fetchrow(
                "SELECT status FROM background_jobs WHERE id = $1", job_id
            )
            if row and row["status"] == JobStatus.PAUSED.value:
                return
        except Exception:
            pass


async def job_manager(logger: structlog.stdlib.BoundLogger):
    parser = "dxf_importer"
    logger = logger.bind(parser=parser)
    connection = await setup_connection()
    logger.info("job processor started")
    while True:
        job = await get_next_job(connection)
        if not job:
            await asyncio.sleep(IDLE_TIMEOUT)
            continue

        start = time.time()
        duration = 0
        job_timeout = max(
            1, min(job.payload.time_out_seconds, job.remaining_compute_budget_seconds)
        )

        metrics.METRICS_TRACKER = None
        metrics.HOST_APP = "dxf"

        job_id = job.id
        job_status = JobStatus.QUEUED
        ex: Exception | None = None
        attempt = job.attempt
        version_id: str | None = None
        speckle_client = None

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                speckle_client = setup_client(job.payload)

                if attempt > job.max_attempt:
                    raise Exception(
                        "Unhandled error silently failed the job multiple times"
                    )

                logger = logger.bind(job_id=job_id, project_id=job.payload.project_id)
                logger.info(
                    "starting job {job_id} for project {project_id},"
                    + " attempt {attempt} /"
                    + " {max_attempts} with remaining compute budget"
                    + " {remaining_compute_budget_seconds}s and timeout {job_timeout}s",
                    attempt=attempt,
                    max_attempts=job.max_attempt,
                    remaining_compute_budget_seconds=job.remaining_compute_budget_seconds,
                    job_timeout=job_timeout,
                )
                cmd = (
                    f"{sys.executable} job_processor.py {temp_dir}"
                    + f" {base64.b64encode(job.payload.model_dump_json().encode()).decode()}"
                )
                process = await asyncio.create_subprocess_shell(cmd)
                watch_task = asyncio.create_task(
                    _watch_job_paused(connection, job_id)
                )
                wait_task = asyncio.create_task(process.wait())
                try:
                    done, pending = await asyncio.wait(
                        [watch_task, wait_task],
                        timeout=job_timeout,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for t in pending:
                        t.cancel()

                    if watch_task in done and wait_task not in done:
                        process.kill()
                        with contextlib.suppress(Exception):
                            await process.wait()
                        raise JobPausedException("Job was paused by administrator")

                    if wait_task in done:
                        exit_code = wait_task.result()
                    else:
                        raise TimeoutError(f"Job reached timeout of {job_timeout} seconds")
                except TimeoutError as te:
                    process.kill()
                    raise Exception(
                        "Job was cancelled due to reaching the"
                        + f" {job_timeout} second timeout"
                    ) from te
                if exit_code != 0:
                    raise Exception(f"Job failed with exit code {exit_code}")

                result_path = Path(temp_dir, "result.json")
                if not result_path.exists():
                    raise Exception("Job exited without a result")

                outcome = FileimportResult.model_validate_json(
                    result_path.read_text()
                ).outcome

                if isinstance(outcome, FileimportError):
                    logger.error("File import subprocess failed", exc_info=outcome.stack_trace)
                    raise Exception(outcome.reason)

                version_id = outcome.version_id
                duration = time.time() - start
                logger.info(
                    "Finished parsing job after {duration}s,"
                    + " creating version {version_id}",
                    duration=duration,
                    version_id=version_id,
                )

                _ = speckle_client.file_import.finish_file_import_job(
                    FileImportSuccessInput(
                        project_id=job.payload.project_id,
                        job_id=job.payload.blob_id,
                        result=FileImportResult(
                            parser=parser,
                            version_id=version_id,
                            download_duration_seconds=outcome.download_duration_seconds,
                            duration_seconds=duration,
                            parse_duration_seconds=outcome.parse_duration_seconds,
                        ),
                    )
                )
                job_status = JobStatus.SUCCEEDED

            except JobPausedException:
                job_status = JobStatus.PAUSED
                logger.info(
                    "dxf job {job_id} was paused by administrator, terminating process immediately",
                    job_id=job_id,
                )
            except Exception as e:
                ex = e
                job_status = JobStatus.FAILED
            finally:
                if job_status == JobStatus.PAUSED:
                    logger.info("Skipping budget deduction and failure reporting for paused dxf job {job_id}", job_id=job_id)
                else:
                    if duration <= 0:
                        duration = time.time() - start
                        await deduct_from_compute_budget(
                            connection, logger, job_id, floor(duration)
                        )

                if job_status == JobStatus.FAILED:
                    logger.error("job processing failed", exc_info=ex)
                    if speckle_client is None:
                        await set_job_status(connection, logger, job_id, JobStatus.FAILED)
                        continue
                    try:
                        _ = speckle_client.file_import.finish_file_import_job(
                            FileImportErrorInput(
                                project_id=job.payload.project_id,
                                job_id=job.payload.blob_id,
                                reason=str(ex),
                                result=FileImportResult(
                                    parser=parser,
                                    version_id=None,
                                    download_duration_seconds=0,
                                    duration_seconds=time.time() - start,
                                    parse_duration_seconds=0,
                                ),
                            )
                        )
                    except Exception as ex:
                        logger.error("failed to report job failure", exc_info=ex)
                        await return_job_to_queued(connection, logger, job_id)

