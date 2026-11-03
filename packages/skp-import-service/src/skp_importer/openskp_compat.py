"""
Compatibility shims for the bundled OpenSKP reader.

OpenSKP triangulates every SketchUp face with a plain Delaunay
triangulation of the face outline and then keeps only the triangles whose
*centroid* falls inside the face polygon
(``openskp._core.triangulate_face_3d``). For concave faces, and for faces
with inner loops such as window/door openings, that leaves gaps in the
surface and keeps triangles that bridge across the notches and holes.
Those stray triangles connect unrelated vertices, which is what makes the
imported model look shredded.

:func:`patch_openskp` swaps that routine for a constrained Delaunay
triangulation, which honours the polygon boundary (holes included) and
therefore reproduces the original face exactly. It intentionally keeps
OpenSKP's triangles/quad fast paths untouched.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np

Triangles = list[list[int]]
Triangulate = Callable[[Any, list[list[int]], Any], Triangles]

_PATCHED = False


def _project_to_2d(
    vertices_3d: Any, loops: list[list[int]], normal: Any
) -> tuple[dict[int, tuple[float, float]], list[int]] | None:
    """Project the face outline onto its own plane, mirroring OpenSKP's basis."""
    normal_arr = np.asarray(normal, dtype=float)
    length = float(np.linalg.norm(normal_arr))
    normal_arr = (
        normal_arr / length if length > 1e-6 else np.array([0.0, 0.0, 1.0])
    )

    if abs(normal_arr[0]) < 0.9:
        helper = np.array([1.0, 0.0, 0.0])
    else:
        helper = np.array([0.0, 1.0, 0.0])

    u_axis = np.cross(normal_arr, helper)
    u_axis = u_axis / np.linalg.norm(u_axis)
    v_axis = np.cross(normal_arr, u_axis)

    coords: dict[int, tuple[float, float]] = {}
    for loop in loops:
        for vertex_id in loop:
            if vertex_id in coords:
                continue
            point = vertices_3d.get(vertex_id)
            if point is None:
                return None
            coords[vertex_id] = (
                float(np.dot(point, u_axis)),
                float(np.dot(point, v_axis)),
            )

    if not coords:
        return None
    return coords, list(coords)


def _map_triangle(
    part: Any, points: np.ndarray, vertex_ids: np.ndarray
) -> list[int] | None:
    """Map a triangulated part back onto OpenSKP vertex ids."""
    if getattr(part, "geom_type", None) != "Polygon":
        return None
    coords = list(part.exterior.coords)[:3]
    if len(coords) < 3:
        return None

    ids: list[int] = []
    for coord in coords:
        distances = (points[:, 0] - coord[0]) ** 2 + (points[:, 1] - coord[1]) ** 2
        nearest = int(np.argmin(distances))
        if distances[nearest] > 1e-8:
            return None
        ids.append(int(vertex_ids[nearest]))

    if len(set(ids)) != 3:
        return None
    return ids


def _constrained_triangles(
    vertices_3d: Any, loops: list[list[int]], normal: Any
) -> Triangles | None:
    """Triangulate a face inside its outline, or ``None`` to keep OpenSKP's result."""
    if not loops or not loops[0] or len(loops[0]) < 3:
        return []
    if len(loops) == 1 and len(loops[0]) == 3:
        return [list(loops[0])]
    if len(loops) == 1 and len(loops[0]) == 4:
        quad = loops[0]
        return [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]

    try:
        from shapely import constrained_delaunay_triangles
        from shapely.geometry import Polygon
    except ImportError:  # pragma: no cover - Shapely always ships with OpenSKP
        print("OpenSKP compat notice: constrained triangulation unavailable")
        return None

    projected = _project_to_2d(vertices_3d, loops, normal)
    if projected is None:
        return None
    coords, vertex_ids = projected

    rings: list[list[tuple[float, float]]] = []
    for loop in loops:
        ring = [coords[vertex_id] for vertex_id in loop if vertex_id in coords]
        if len(ring) >= 3:
            rings.append(ring)
    if not rings:
        return None

    try:
        polygon = Polygon(rings[0], rings[1:])
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty or polygon.area <= 0:
            return None
        parts = constrained_delaunay_triangles(polygon)
    except Exception:  # noqa: BLE001 - fall back to OpenSKP's triangulation
        return None

    if parts.is_empty:
        return None

    points = np.array([coords[vertex_id] for vertex_id in vertex_ids])
    id_array = np.array(vertex_ids)

    triangles: Triangles = []
    for part in parts.geoms:
        triangle = _map_triangle(part, points, id_array)
        if triangle is not None:
            triangles.append(triangle)
    return triangles or None


def patch_openskp() -> None:
    """Replace OpenSKP's per-face triangulation with a constrained one."""
    global _PATCHED
    if _PATCHED:
        return

    try:
        import openskp._core as openskp_core
    except ImportError:  # pragma: no cover - OpenSKP is a hard dependency
        print("OpenSKP compat notice: could not patch face triangulation")
        return

    original: Triangulate = openskp_core.triangulate_face_3d

    def triangulate_face_3d(
        vertices_3d: Any, loops: list[list[int]], normal: Any
    ) -> Triangles:
        triangles = _constrained_triangles(vertices_3d, loops, normal)
        if triangles is None:
            return original(vertices_3d, loops, normal)
        return triangles

    openskp_core.triangulate_face_3d = triangulate_face_3d
    _PATCHED = True
