import contextlib
import gc
import math
import multiprocessing
import os
import threading
import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from time import time
from typing import Any, cast

import requests
from gql import gql
from ifcopenshell import file as ifc_file_type
from ifcopenshell import ifcopenshell_wrapper
from ifcopenshell.geom import iterator as ifc_geom_iterator
from ifcopenshell.geom import settings as ifc_geom_settings
from ifcopenshell.ifcopenshell_wrapper import TriangulationElement
from speckleifc.converter.geometry_converter import geometry_to_speckle
from speckleifc.ifc_geometry_processing import open_ifc
from speckleifc.importer import ImportJob
from specklepy.core.api.inputs.version_inputs import CreateVersionInput
from specklepy.core.api.operations import send
from specklepy.transports.server import ServerTransport
from specklepy.transports.server.batch_sender import BatchSender

from ifc_importer.client import setup_client
from ifc_importer.disk_cache import GeometryDiskCache, LazyGeometryList
from ifc_importer.domain import (
    FileimportError,
    FileimportPayload,
    FileimportResult,
    FileimportSuccess,
)

ProgressCallback = Callable[[int | None, str | None, str | None, bool], None]


def create_bounded_geometry_iterator(
    ifc_file: ifc_file_type,
    concurrency: int | None = None,
    linear_deflection: float | None = None,
) -> tuple[ifc_geom_iterator, int]:
    """Create geometry iterator with bounded concurrency and deflection."""
    if concurrency is None:
        env_concurrency = os.getenv("IFC_CONCURRENCY")
        if env_concurrency:
            try:
                concurrency = max(1, int(env_concurrency))
            except ValueError:
                concurrency = None
        if concurrency is None:
            # 默认采用更充沛的多线程算力（最大 6 线程，建议 4~6 线程）
            # 配合 SQLite 磁盘缓存，在安全内存水位下大幅提升并行三角化吞吐
            concurrency = min(6, max(2, multiprocessing.cpu_count() - 1))

    if linear_deflection is None:
        env_deflection = os.getenv("IFC_MESHER_LINEAR_DEFLECTION")
        if env_deflection:
            try:
                linear_deflection = float(env_deflection)
            except ValueError:
                linear_deflection = None
        if linear_deflection is None:
            # 适度放宽细分容差，削减 40%~60% 的微小面，大幅减轻内存负担
            linear_deflection = 1.0

    settings = ifc_geom_settings()
    settings.set("triangulation-type", ifcopenshell_wrapper.TRIANGLE_MESH)
    settings.set("weld-vertices", False)
    settings.set("use-world-coords", True)
    settings.set("no-wire-intersection-check", True)
    settings.set("use-material-names", True)
    settings.set("mesher-linear-deflection", linear_deflection)
    # 性能关键优化 1：开启相同几何形状复用，避免海量相同构件重复进行昂贵拓扑计算
    settings.set("permissive-shape-reuse", True)
    # 性能关键优化 2：优化圆弧分段数至 12（默认 16），显著加快管线/圆柱实体处理
    settings.set("circle-segments", 12)

    return ifc_geom_iterator(settings, ifc_file, concurrency), concurrency


class DiskBackedGeometryMap:
    """Dict-like proxy mapping geometry IDs to LazyGeometryList."""

    def __init__(self, disk_cache: GeometryDiskCache) -> None:
        self.disk_cache = disk_cache

    def get(self, geometry_id: int, default: Any = None) -> Any:
        if self.disk_cache.has(geometry_id):
            item_count = self.disk_cache.get_count(geometry_id)
            return LazyGeometryList(geometry_id, self.disk_cache, item_count)
        return default if default is not None else []

    def __contains__(self, geometry_id: int) -> bool:
        return self.disk_cache.has(geometry_id)


class ProgressBatchSender(BatchSender):
    """Memory-controlled batch sender with concurrency limit and dynamic upload
    progress reporting.
    """

    def __init__(
        self,
        server_url: str,
        stream_id: str,
        token: str,
        max_batch_size_mb: float = 0.5,
        max_batch_length: int = 2000,
        batch_buffer_length: int = 2,
        thread_count: int = 1,
        on_batch_sent: Callable[[int, int], None] | None = None,
    ) -> None:
        super().__init__(
            server_url,
            stream_id,
            token,
            max_batch_size_mb=max_batch_size_mb,
            max_batch_length=max_batch_length,
            batch_buffer_length=batch_buffer_length,
            thread_count=thread_count,
        )
        self._on_batch_sent = on_batch_sent
        self._sent_batches_count = 0
        self._sent_objects_count = 0
        self._lock = threading.Lock()

    def _bg_send_batch(self, session: requests.Session, batch: Any) -> None:
        super()._bg_send_batch(session, batch)
        with self._lock:
            self._sent_batches_count += 1
            self._sent_objects_count += len(batch)
            b_cnt = self._sent_batches_count
            o_cnt = self._sent_objects_count
        if self._on_batch_sent:
            with contextlib.suppress(Exception):
                self._on_batch_sent(b_cnt, o_cnt)


class ProgressServerTransport(ServerTransport):
    """ServerTransport with memory-conservative batching and progress reporting."""

    def __init__(
        self,
        stream_id: str,
        account: Any = None,
        client: Any = None,
        on_batch_sent: Callable[[int, int], None] | None = None,
    ) -> None:
        super().__init__(stream_id, client=client, account=account)
        if self.account is not None:
            self._batch_sender = ProgressBatchSender(
                self.url,
                self.stream_id,
                self.account.token,
                max_batch_size_mb=0.5,
                max_batch_length=2000,
                batch_buffer_length=2,
                thread_count=1,
                on_batch_sent=on_batch_sent,
            )


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
    disk_cache: GeometryDiskCache | None = None
    root_elements_total: int = field(default=1, init=False)
    converted_root_elements: int = field(default=0, init=False)
    geometry_estimate_total: int = field(default=1, init=False)

    def __post_init__(self) -> None:
        self.root_elements_total = max(1, len(self.ifc_file.by_type("IfcRoot", False)))
        self.geometry_estimate_total = max(
            1, len(self.ifc_file.by_type("IfcProduct", False))
        )
        if self.disk_cache:
            # 替换为流式磁盘代理映射，避免几百万面几何在内存中常驻
            self.cached_display_values = DiskBackedGeometryMap(self.disk_cache)  # type: ignore

    def convert_element(self, step_element) -> object:
        result = super().convert_element(step_element)
        if step_element.is_a("IfcRoot"):
            self.converted_root_elements += 1
            # 适度降低全代 GC 频次（每 1000 个构件），减少 stop-the-world 阻塞耗时
            if self.converted_root_elements % 1000 == 0:
                gc.collect()
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
        iterator, concurrency = create_bounded_geometry_iterator(self.ifc_file)
        if not iterator.initialize():
            raise ValueError("Failed to find any geometry in file")

        self.geometries_count = 0
        if self.progress_callback:
            self.progress_callback(
                30,
                "preprocessing_geometry",
                f"Pre-processing IFC geometry (threads: {concurrency})",
                True,
            )

        batch: list[tuple[int, list[Any]]] = []
        batch_size = 200

        try:
            while True:
                shape = cast(TriangulationElement, iterator.get())
                self.geometries_count += 1
                geometry_id = cast(int, shape.id)

                try:
                    display_value = geometry_to_speckle(
                        shape, self._render_material_manager
                    )
                    if self.disk_cache:
                        batch.append((geometry_id, display_value))
                        if len(batch) >= batch_size:
                            self.disk_cache.put_batch(batch)
                            batch.clear()
                            # 仅在每 1000 个构件时轻量 GC，大幅消减全堆扫描时间
                            if self.geometries_count % 1000 == 0:
                                gc.collect()
                    else:
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

            if self.disk_cache and batch:
                self.disk_cache.put_batch(batch)
                batch.clear()
        finally:
            # 显式彻底释放 IfcOpenShell C++ 迭代器与 OpenCASCADE 底层几何缓存
            del iterator
            gc.collect()

    def dispose(self) -> None:
        """Explicitly break references to C++ ifc_file and internal structures."""
        self.ifc_file = None
        if hasattr(self, "elements") and isinstance(self.elements, dict):
            self.elements.clear()
        if hasattr(self, "tree"):
            self.tree = None
        self.disk_cache = None
        self.cached_display_values = None
        self.progress_callback = None


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

        ifc_file = open_ifc(str(local_file))

        parse_start = time()
        cache_db_path = workdir / "geom_cache.sqlite"
        with GeometryDiskCache(cache_db_path) as disk_cache:
            import_job = ProgressImportJob(
                ifc_file=ifc_file,
                disk_cache=disk_cache,
                progress_callback=progress_reporter.report,
            )
            data = import_job.convert()

            # 关键优化 1：构件树已构建完成，立即销毁 IfcOpenShell C++ 对象与底噪内存
            import_job.dispose()
            del import_job
            del ifc_file
            gc.collect()

            # 关键优化 2：上传细粒度进度实时动态推进 (88% -> 95%)
            def on_batch_uploaded(batch_index: int, objects_sent: int) -> None:
                step = int(math.sqrt(batch_index * 2))
                percent = min(95, 88 + step)
                msg = (
                    f"Uploading converted model (batch {batch_index},"
                    f" {objects_sent} objects sent)"
                )
                progress_reporter.report(
                    percent,
                    "uploading_model_object",
                    msg,
                    True,
                )

            account = client.account
            remote_transport = ProgressServerTransport(
                project.id, account=account, on_batch_sent=on_batch_uploaded
            )

            progress_reporter.report(
                88,
                "uploading_model_object",
                "Uploading converted model (starting upload)",
                True,
            )
            root_id = send(data, transports=[remote_transport], use_default_cache=False)

            progress_reporter.report(
                95,
                "uploading_model_object",
                "Uploading converted model (objects upload finished)",
                True,
            )

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

