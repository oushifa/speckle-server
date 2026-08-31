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

from skp_importer.client import setup_client
from skp_importer.domain import (
    FileimportError,
    JobStatus,
)
from skp_importer.domain import (
    FileimportResult as DomainFileimportResult,
)
from skp_importer.repository import (
    deduct_from_compute_budget,
    get_next_job,
    return_job_to_queued,
    set_job_status,
    setup_connection,
)

IDLE_TIMEOUT = 1
MAX_SUBPROCESS_OUTPUT_CHARS = 4000


def _truncate_process_output(output: bytes | None) -> str | None:
    if not output:
        return None

    text = output.decode(errors="replace").strip()
    if not text:
        return None

    if len(text) <= MAX_SUBPROCESS_OUTPUT_CHARS:
        return text

    return (
        text[:MAX_SUBPROCESS_OUTPUT_CHARS]
        + f"\n... [truncated {len(text) - MAX_SUBPROCESS_OUTPUT_CHARS} chars]"
    )


class JobPausedError(Exception):
    """Raised when the job is paused by an administrator."""

    pass


async def _watch_job_paused(
    connection, job_id: str, poll_interval: float = 1.0
) -> None:
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
    parser = "sketchup"
    logger = logger.bind(parser=parser)
    connection = await setup_connection()
    logger.info("SKP job processor started")
    while True:
        try:
            job = await get_next_job(connection)
        except Exception as ex:
            logger.error("Failed to fetch next job: {message}", message=str(ex))
            await asyncio.sleep(2)
            with contextlib.suppress(Exception):
                connection = await setup_connection()
            continue

        if not job:
            await asyncio.sleep(IDLE_TIMEOUT)
            continue

        start = time.time()
        job_timeout = max(
            1, min(job.payload.time_out_seconds, job.remaining_compute_budget_seconds)
        )

        job_id = job.id
        job_status = JobStatus.QUEUED
        ex: Exception | None = None
        attempt = job.attempt
        speckle_client = None
        subprocess_stdout: str | None = None
        subprocess_stderr: str | None = None

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                speckle_client = setup_client(job.payload)

                if attempt > job.max_attempt:
                    raise Exception(
                        "Job exceeded max retry attempts after previous failures"
                    )

                logger = logger.bind(job_id=job_id, project_id=job.payload.project_id)
                logger.info(
                    "starting skp job {job_id} for project {project_id},"
                    + " attempt {attempt} /"
                    + " {max_attempts} with remaining compute budget"
                    + " {remaining_compute_budget_seconds}s and timeout {job_timeout}s",
                    attempt=attempt,
                    max_attempts=job.max_attempt,
                    remaining_compute_budget_seconds=job.remaining_compute_budget_seconds,
                    job_timeout=job_timeout,
                )
                job_payload = base64.b64encode(job.payload.model_dump_json().encode())

                process = await asyncio.create_subprocess_exec(
                    sys.executable,
                    "job_processor.py",
                    temp_dir,
                    job_payload.decode(),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                watch_task = asyncio.create_task(
                    _watch_job_paused(connection, job_id)
                )
                communicate_task = asyncio.create_task(process.communicate())
                try:
                    done, pending = await asyncio.wait(
                        [watch_task, communicate_task],
                        timeout=job_timeout,
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    for t in pending:
                        t.cancel()

                    if watch_task in done and communicate_task not in done:
                        process.kill()
                        with contextlib.suppress(Exception):
                            await process.communicate()
                        raise JobPausedError("Job was paused by administrator")

                    if communicate_task in done:
                        stdout, stderr = communicate_task.result()
                    else:
                        raise TimeoutError(
                            f"Job reached timeout of {job_timeout} seconds"
                        )
                except TimeoutError as te:
                    process.kill()
                    stdout, stderr = await process.communicate()
                    subprocess_stdout = _truncate_process_output(stdout)
                    subprocess_stderr = _truncate_process_output(stderr)
                    raise TimeoutError(
                        f"Job timed out after {job_timeout} seconds"
                    ) from te

                subprocess_stdout = _truncate_process_output(stdout)
                subprocess_stderr = _truncate_process_output(stderr)

                if process.returncode != 0:
                    raise Exception(f"Job failed with exit code: {process.returncode}")

                result_file = Path(temp_dir) / "result.json"
                if not result_file.is_file():
                    raise Exception("Job process did not produce a result file")

                result_json = result_file.read_text(encoding="utf-8")
                job_result = DomainFileimportResult.model_validate_json(result_json)
                if isinstance(job_result.outcome, FileimportError):
                    job_status = JobStatus.FAILED
                    ex = Exception(job_result.outcome.reason)
                else:
                    duration = time.time() - start
                    version_id = job_result.outcome.version_id
                    logger.info(
                        "Finished parsing skp job after {duration}s, "
                        + "creating version {version_id}",
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
                                download_duration_seconds=job_result.outcome.download_duration_seconds,
                                duration_seconds=duration,
                                parse_duration_seconds=job_result.outcome.parse_duration_seconds,
                            ),
                        )
                    )
                    job_status = JobStatus.SUCCEEDED
            except JobPausedError:
                job_status = JobStatus.PAUSED
                logger.info(
                    "skp job {job_id} was paused by administrator, "
                    + "terminating process immediately",
                    job_id=job_id,
                )
            except Exception as e:
                ex = e
                job_status = JobStatus.FAILED
            finally:
                if job_status == JobStatus.PAUSED:
                    logger.info(
                        "Skipping budget deduction for paused skp job {job_id}",
                        job_id=job_id,
                    )
                else:
                    duration_int = floor(time.time() - start)
                    await deduct_from_compute_budget(
                        connection, logger, job_id, duration_int
                    )

                if job_status == JobStatus.FAILED:
                    logger.error(
                        "skp job {job_id} failed with error: {message}",
                        message=str(ex),
                        job_id=job_id,
                        stdout=subprocess_stdout,
                        stderr=subprocess_stderr,
                        exc_info=ex,
                    )
                    if speckle_client is not None:
                        with contextlib.suppress(Exception):
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
                    await set_job_status(connection, logger, job_id, JobStatus.FAILED)
                elif job_status == JobStatus.QUEUED:
                    await return_job_to_queued(connection, logger, job_id)
                else:
                    await set_job_status(
                        connection, logger, job_id, JobStatus.SUCCEEDED
                    )
                    logger.info(
                        "job {job_id} succeeded in {duration}s",
                        job_id=job_id,
                        duration=duration_int,
                        stdout=subprocess_stdout,
                        stderr=subprocess_stderr,
                    )
