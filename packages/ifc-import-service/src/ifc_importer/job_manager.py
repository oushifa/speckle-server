import asyncio
import base64
import contextlib
import os
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

from ifc_importer.client import setup_client
from ifc_importer.domain import FileimportError, FileimportResult, JobStatus
from ifc_importer.repository import (
    deduct_from_compute_budget,
    get_next_job,
    return_job_to_queued,
    set_job_status,
    setup_connection,
)

IDLE_TIMEOUT = 1
MAX_SUBPROCESS_OUTPUT_CHARS = 4000


def _find_job_processor_script() -> str:
    """Find the path of job_processor.py in Docker, local dev, or CLI."""
    # 1. 显式环境变量指定
    env_path = os.getenv("JOB_PROCESSOR_SCRIPT")
    if env_path and Path(env_path).is_file():
        return str(Path(env_path).resolve())

    # 2. main.py 启动入口同级目录 (在 Docker 容器中通常为 /app/job_processor.py)
    if sys.argv and sys.argv[0]:
        argv_target = Path(sys.argv[0]).resolve().parent / "job_processor.py"
        if argv_target.is_file():
            return str(argv_target)

    # 3. 当前工作目录
    cwd_target = Path.cwd() / "job_processor.py"
    if cwd_target.is_file():
        return str(cwd_target.resolve())

    # 4. 源码树目录 (开发环境: src/ifc_importer -> packages/ifc-import-service)
    src_parent = Path(__file__).resolve().parents[2] / "job_processor.py"
    if src_parent.is_file():
        return str(src_parent)

    # 5. Docker 镜像标准部署路径
    container_target = Path("/app/job_processor.py")
    if container_target.is_file():
        return str(container_target)

    return "job_processor.py"


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


async def _watch_job_paused(job_id: str, poll_interval: float = 1.0) -> None:
    """Watch if job status in DB is paused using an independent connection."""
    conn = None
    try:
        conn = await setup_connection()
        while True:
            await asyncio.sleep(poll_interval)
            row = await conn.fetchrow(
                "SELECT status FROM background_jobs WHERE id = $1", job_id
            )
            if row and row["status"] == JobStatus.PAUSED.value:
                return
    except asyncio.CancelledError:
        raise
    except Exception:
        pass
    finally:
        if conn and not conn.is_closed():
            with contextlib.suppress(Exception):
                await conn.close()


async def job_manager(logger: structlog.stdlib.BoundLogger):
    parser = "speckle_ifc"
    logger = logger.bind(parser=parser)
    connection = None
    logger.info("job processor started")

    while True:
        try:
            if connection is None or connection.is_closed():
                connection = await setup_connection()

            job = await get_next_job(connection)
            if not job:
                await asyncio.sleep(IDLE_TIMEOUT)
                continue
        except Exception as conn_err:
            logger.error(
                "Failed to query next job from queue database, reconnecting in 2s...",
                exc_info=conn_err,
            )
            if connection and not connection.is_closed():
                with contextlib.suppress(Exception):
                    await connection.close()
            connection = None
            await asyncio.sleep(2)
            continue

        start = time.time()
        duration = 0
        job_timeout = max(
            1800,
            max(job.payload.time_out_seconds, job.remaining_compute_budget_seconds),
        )

        # Forcefully reset metrics,
        # we don't want it to reuse any server/user ids between jobs
        metrics.METRICS_TRACKER = None
        metrics.HOST_APP = "ifc"

        job_id = job.id
        job_status = JobStatus.QUEUED
        ex: Exception | None = None
        attempt = job.attempt
        version_id: str | None = None
        speckle_client = None
        subprocess_stdout: str | None = None
        subprocess_stderr: str | None = None

        # this will create a new temp directory and also delete it,
        # when the with block closes
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                speckle_client = setup_client(job.payload)

                if attempt > job.max_attempt:
                    raise Exception(
                        "Job exceeded max retry attempts after previous failures whose "
                        + "details could not be reported back to the server"
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
                job_payload = base64.b64encode(job.payload.model_dump_json().encode())
                # subprocess: use same interpreter
                # so ifc_importer from site-packages is found
                processor_script = _find_job_processor_script()
                logger.info(
                    "launching job processor subprocess", script=processor_script
                )
                process = await asyncio.create_subprocess_exec(
                    sys.executable,
                    processor_script,
                    temp_dir,
                    job_payload.decode(),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                watch_task = asyncio.create_task(_watch_job_paused(job_id))
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
                    raise Exception(
                        "Job was cancelled due to reaching the"
                        + f" {job_timeout} second timeout"
                    ) from te
                subprocess_stdout = _truncate_process_output(stdout)
                subprocess_stderr = _truncate_process_output(stderr)

                exit_code = process.returncode
                if exit_code != 0:
                    extra_details = []
                    if subprocess_stderr:
                        extra_details.append(f"stderr: {subprocess_stderr}")
                    if subprocess_stdout:
                        extra_details.append(f"stdout: {subprocess_stdout}")
                    details = f" {' | '.join(extra_details)}" if extra_details else ""
                    raise Exception(f"Job failed with exit code {exit_code}.{details}")

                result_path = Path(temp_dir, "result.json")
                if not result_path.exists():
                    extra_details = []
                    if subprocess_stderr:
                        extra_details.append(f"stderr: {subprocess_stderr}")
                    if subprocess_stdout:
                        extra_details.append(f"stdout: {subprocess_stdout}")
                    details = f" {' | '.join(extra_details)}" if extra_details else ""
                    raise Exception(f"Job exited without a result.{details}")

                outcome = FileimportResult.model_validate_json(
                    result_path.read_text()
                ).outcome

                if isinstance(outcome, FileimportError):
                    logger.error(
                        "File import subprocess failed",
                        subprocess_stdout=subprocess_stdout,
                        subprocess_stderr=subprocess_stderr,
                        stack_trace=outcome.stack_trace,
                    )
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

            except JobPausedError:
                job_status = JobStatus.PAUSED
                logger.info(
                    "job {job_id} was paused by administrator, terminating immediately",
                    job_id=job_id,
                )
            except Exception as e:
                ex = e
                job_status = JobStatus.FAILED
            finally:
                try:
                    if job_status == JobStatus.PAUSED:
                        logger.info(
                            "Skipping budget deduction for paused job {job_id}",
                            job_id=job_id,
                        )
                    else:
                        if duration <= 0:
                            duration = time.time() - start
                            await deduct_from_compute_budget(
                                connection, logger, job_id, floor(duration)
                            )

                    if job_status == JobStatus.FAILED:
                        original_failure_reason = str(ex) if ex else None
                        logger.error(
                            "job processing failed",
                            exc_info=ex,
                            subprocess_stdout=subprocess_stdout,
                            subprocess_stderr=subprocess_stderr,
                        )
                        if speckle_client is None:
                            await set_job_status(
                                connection, logger, job_id, JobStatus.FAILED
                            )
                        else:
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
                            except Exception as report_ex:
                                logger.error(
                                    "failed to report job failure",
                                    exc_info=report_ex,
                                    original_failure_reason=original_failure_reason,
                                    subprocess_stdout=subprocess_stdout,
                                    subprocess_stderr=subprocess_stderr,
                                )
                                await return_job_to_queued(connection, logger, job_id)
                except Exception as final_err:
                    logger.error(
                        "Error during job cleanup or status update", exc_info=final_err
                    )
                    if connection and not connection.is_closed():
                        with contextlib.suppress(Exception):
                            await connection.close()
                    connection = None
