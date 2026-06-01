from __future__ import annotations

import hashlib
import traceback
from pathlib import Path
from time import time
from typing import Iterable

import ezdxf
import requests
from ezdxf.colors import aci2rgb
from specklepy.core.api.operations import send  # pyright: ignore[reportMissingTypeStubs]
from specklepy.objects.base import Base  # pyright: ignore[reportMissingTypeStubs]
from specklepy.transports.server import ServerTransport  # pyright: ignore[reportMissingTypeStubs]

from dxf_importer.client import create_version, setup_client
from dxf_importer.domain import (
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


def _to_polyline(
    points: Iterable[tuple[float, float, float]],
    *,
    units: str,
    closed: bool,
    application_id: str,
    layer: str,
    dxf_type: str,
    display_color: int | None,
) -> Base:
    coords: list[float] = []
    for x, y, z in points:
        coords.extend([float(x), float(y), float(z)])

    poly = Base()
    poly["speckle_type"] = "Objects.Geometry.Polyline"
    poly["applicationId"] = application_id
    poly["layer"] = layer
    poly["dxfType"] = dxf_type
    poly["dxfHandle"] = application_id
    if display_color is not None:
        poly["displayStyle"] = {
            "speckle_type": "Objects.Other.DisplayStyle",
            "color": int(display_color),
        }
    poly["value"] = coords
    poly["closed"] = closed
    poly["units"] = units
    return poly


def _argb(r: int, g: int, b: int, a: int = 255) -> int:
    return (int(a) << 24) + (int(r) << 16) + (int(g) << 8) + int(b)


def _resolve_entity_color(doc, e, *, layer_name: str) -> int | None:
    try:
        true_color = getattr(getattr(e, "dxf", None), "true_color", None)
        if isinstance(true_color, int) and true_color != 0:
            r = (true_color >> 16) & 255
            g = (true_color >> 8) & 255
            b = true_color & 255
            return _argb(r, g, b)
    except Exception:
        pass

    try:
        aci = int(getattr(getattr(e, "dxf", None), "color", 256) or 256)
    except Exception:
        aci = 256

    if aci in (0, 256):
        try:
            layer = doc.layers.get(layer_name)
            aci = int(layer.dxf.color or 7)
        except Exception:
            aci = 7

    try:
        r, g, b = aci2rgb(abs(int(aci)))
        return _argb(r, g, b)
    except Exception:
        return None


def _normalize_layer_name(layer: str | None) -> str:
    name = (layer or "").strip()
    return name or "0"


def _normalize_handle(handle: str | None) -> str:
    h = (handle or "").strip()
    return h.upper()


def _quantize(value: float) -> float:
    return float(round(float(value), 6))


def _pt_key(p: tuple[float, float, float]) -> tuple[float, float, float]:
    return (p[0], p[1], p[2])


def _normalize_points(
    points: list[tuple[float, float, float]], *, closed: bool
) -> list[tuple[float, float, float]]:
    pts = [(_quantize(x), _quantize(y), _quantize(z)) for x, y, z in points]
    if closed and len(pts) >= 2 and _pt_key(pts[0]) == _pt_key(pts[-1]):
        pts = pts[:-1]

    if len(pts) < 2:
        return pts

    if closed:
        min_index = min(range(len(pts)), key=lambda i: _pt_key(pts[i]))
        rotated = pts[min_index:] + pts[:min_index]
        reversed_pts = list(reversed(pts))
        min_index_rev = min(range(len(reversed_pts)), key=lambda i: _pt_key(reversed_pts[i]))
        rotated_rev = reversed_pts[min_index_rev:] + reversed_pts[:min_index_rev]
        return rotated if tuple(rotated) <= tuple(rotated_rev) else rotated_rev

    if _pt_key(pts[0]) > _pt_key(pts[-1]):
        pts.reverse()
    return pts


def _fallback_entity_id(
    *,
    stable_root_id: str,
    layer: str,
    dxftype: str,
    points: list[tuple[float, float, float]],
    closed: bool,
) -> str:
    payload = {
        "root": stable_root_id,
        "layer": layer,
        "type": dxftype,
        "closed": bool(closed),
        "points": points,
    }
    raw = repr(payload).encode("utf-8")
    digest = hashlib.sha1(raw).hexdigest()
    return f"NOHANDLE:{digest}"


def _coords_to_points(coords: list[float] | None) -> list[tuple[float, float, float]]:
    if not coords:
        return []
    out: list[tuple[float, float, float]] = []
    for i in range(0, len(coords), 3):
        if i + 2 >= len(coords):
            break
        out.append((float(coords[i]), float(coords[i + 1]), float(coords[i + 2])))
    return out


def _units_from_doc(doc) -> str:
    try:
        code = int(doc.header.get("$INSUNITS", 0) or 0)
    except Exception:
        code = 0

    if code == 4:
        return "mm"
    if code == 5:
        return "cm"
    if code == 6:
        return "m"
    if code == 1:
        return "in"
    if code == 2:
        return "ft"
    return "m"


def _resolve_drawing_id(payload: FileimportPayload) -> str | None:
    url = f"{payload.server_url.rstrip('/')}/api/v1/projects/{payload.project_id}/drawings"
    cursor: str | None = None
    for _ in range(20):
        params = {"limit": 200}
        if cursor:
            params["cursor"] = cursor
        res = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {payload.token}"},
            timeout=60,
        )
        res.raise_for_status()
        body = res.json() or {}
        data = body.get("data") or {}
        items = data.get("items") or []
        for item in items:
            if item.get("blobId") == payload.blob_id:
                return item.get("id")
        cursor = data.get("cursor")
        if not cursor:
            break
    return None


def _extract_entities(doc, *, units: str) -> dict[str, list[Base]]:
    msp = doc.modelspace()
    out: dict[str, list[Base]] = {}

    for e in msp:
        t = e.dxftype()
        layer = _normalize_layer_name(getattr(getattr(e, "dxf", None), "layer", None))
        handle = _normalize_handle(getattr(getattr(e, "dxf", None), "handle", None))
        display_color = _resolve_entity_color(doc, e, layer_name=layer)
        if t == "LINE":
            start = e.dxf.start
            end = e.dxf.end
            pts = _normalize_points(
                [(start.x, start.y, start.z), (end.x, end.y, end.z)], closed=False
            )
            out.setdefault(layer, []).append(
                _to_polyline(
                    pts,
                    units=units,
                    closed=False,
                    application_id=handle,
                    layer=layer,
                    dxf_type=t,
                    display_color=display_color,
                )
            )
        elif t == "LWPOLYLINE":
            elevation = float(getattr(e.dxf, "elevation", 0.0) or 0.0)
            pts = _normalize_points(
                [(p[0], p[1], elevation) for p in e.get_points("xy")],
                closed=bool(getattr(e, "closed", False)),
            )
            if len(pts) >= 2:
                out.setdefault(layer, []).append(
                    _to_polyline(
                        pts,
                        units=units,
                        closed=bool(getattr(e, "closed", False)),
                        application_id=handle,
                        layer=layer,
                        dxf_type=t,
                        display_color=display_color,
                    )
                )
        elif t == "POLYLINE":
            pts = _normalize_points(
                [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) for v in e.vertices],
                closed=bool(getattr(e, "is_closed", False) or getattr(e, "closed", False)),
            )
            if len(pts) >= 2:
                out.setdefault(layer, []).append(
                    _to_polyline(
                        pts,
                        units=units,
                        closed=bool(getattr(e, "is_closed", False) or getattr(e, "closed", False)),
                        application_id=handle,
                        layer=layer,
                        dxf_type=t,
                        display_color=display_color,
                    )
                )

    return out


def _collection(*, name: str, elements: list[Base], application_id: str) -> Base:
    c = Base()
    c["speckle_type"] = "Speckle.Core.Models.Collection"
    c["applicationId"] = application_id
    c["name"] = name
    c["elements"] = elements
    return c


def process_job(workdir_path: str, job_payload_json: str) -> None:
    workdir = Path(workdir_path)
    result_file = workdir / "result.json"

    try:
        payload = FileimportPayload.model_validate_json(job_payload_json)
        extension = Path(payload.file_name).suffix or f".{payload.file_type.lower()}"
        local_file = workdir / f"input{extension}"

        client = setup_client(payload)

        download_duration_seconds = _download_blob(payload, local_file)

        parse_start = time()
        doc = ezdxf.readfile(str(local_file))

        units = _units_from_doc(doc)
        drawing_id = _resolve_drawing_id(payload)
        stable_root_id = drawing_id or payload.model_id

        layers = _extract_entities(doc, units=units)
        if not layers:
            raise ValueError("DXF contains no supported entities (LINE/LWPOLYLINE/POLYLINE)")

        layer_collections: list[Base] = []
        for layer_name in sorted(layers.keys()):
            layer_elements = layers[layer_name]
            if not layer_elements:
                continue

            for element in layer_elements:
                element_id = _normalize_handle(getattr(element, "dxfHandle", None))
                if not element_id:
                    element_id = _fallback_entity_id(
                        stable_root_id=stable_root_id,
                        layer=str(layer_name),
                        dxftype=str(getattr(element, "dxfType", None) or "UNKNOWN"),
                        points=_coords_to_points(getattr(element, "value", None)),
                        closed=bool(getattr(element, "closed", False)),
                    )
                element["applicationId"] = f"{stable_root_id}:{element_id}"

            layer_elements.sort(key=lambda el: str(getattr(el, "applicationId", None) or ""))

            layer_collections.append(
                _collection(
                    name=str(layer_name),
                    elements=layer_elements,
                    application_id=f"{stable_root_id}:layer:{layer_name}",
                )
            )

        root = _collection(
            name=payload.file_name,
            elements=layer_collections,
            application_id=stable_root_id,
        )

        transport = ServerTransport(client=client, stream_id=payload.project_id)
        object_id = send(root, transports=[transport])

        parse_duration_seconds = time() - parse_start

        version_id = create_version(
            server_url=payload.server_url,
            token=payload.token,
            project_id=payload.project_id,
            model_id=payload.model_id,
            object_id=object_id,
            message=f"Imported from DXF: {payload.file_name}",
            source_application="dxf-import-service",
        )

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
