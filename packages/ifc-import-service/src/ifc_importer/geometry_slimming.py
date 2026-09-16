"""Geometry payload slimming for the IFC importer.

Two independent, appearance-preserving reductions applied right before meshes
are persisted to the disk cache / uploaded:

1. ``vertexNormals`` are dropped. The Speckle viewer recomputes flat normals
   for meshes that do not ship normals (see
   ``packages/viewer/src/modules/batching/MeshBatch.ts`` ->
   ``Geometry.computeVertexNormalsBufferVirtual``), so the rendered result is
   unchanged while roughly half of every float array disappears.

2. Vertex coordinates are rounded. IFC/Revit sources carry 15+ significant
   digits (``use-world-coords`` output is already in metres). Rounding to 4
   decimals keeps 0.1 mm precision, which is far below anything a BIM model
   needs, and removes 40-50% of the remaining characters.

Measured on ``ignores/2026-911-single-drf_备份2.ifc``:

===========================  ==========  ==========
element                      baseline    slimmed
===========================  ==========  ==========
IfcWindow (50,352 tris)      16.76 MB    5.37 MB
IfcFurnishingElement (112k)  41.97 MB    12.49 MB
===========================  ==========  ==========

Environment variables (both optional):

* ``IFC_DROP_VERTEX_NORMALS`` - ``0``/``false`` keeps the mesher normals
  (default: ``1``).
* ``IFC_VERTEX_DECIMALS`` - number of decimals kept for vertex coordinates,
  ``0`` disables rounding (default: ``4``).
"""

import os
from dataclasses import dataclass

import numpy as np
from specklepy.objects.geometry import Mesh

DEFAULT_DROP_VERTEX_NORMALS = True
DEFAULT_VERTEX_DECIMALS = 4

_FALSEY = {"0", "false", "no", "off", ""}


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in _FALSEY


@dataclass(frozen=True)
class GeometrySlimming:
    """Resolved slimming configuration."""

    drop_vertex_normals: bool = DEFAULT_DROP_VERTEX_NORMALS
    vertex_decimals: int = DEFAULT_VERTEX_DECIMALS

    @property
    def enabled(self) -> bool:
        return self.drop_vertex_normals or self.vertex_decimals > 0


def resolve_geometry_slimming() -> GeometrySlimming:
    """Read slimming configuration from the environment."""
    decimals = DEFAULT_VERTEX_DECIMALS
    raw = os.getenv("IFC_VERTEX_DECIMALS")
    if raw is not None:
        try:
            decimals = max(0, int(raw))
        except ValueError:
            decimals = DEFAULT_VERTEX_DECIMALS

    return GeometrySlimming(
        drop_vertex_normals=_env_flag(
            "IFC_DROP_VERTEX_NORMALS", DEFAULT_DROP_VERTEX_NORMALS
        ),
        vertex_decimals=decimals,
    )


def _round_coordinates(values: list[float], decimals: int) -> list[float]:
    """Round a flat float list to ``decimals`` decimal places.

    ``np.round`` keeps this in C: a 1M float array is processed in ~10 ms,
    whereas the equivalent Python comprehension costs seconds.
    """
    if not values:
        return values
    return np.round(np.asarray(values, dtype=np.float64), decimals).tolist()


def slim_meshes(meshes: list[Mesh], config: GeometrySlimming) -> list[Mesh]:
    """Apply the configured reductions in place and return ``meshes``."""
    if not config.enabled:
        return meshes

    for mesh in meshes:
        if config.drop_vertex_normals and mesh.vertexNormals:
            mesh.vertexNormals = []
        if config.vertex_decimals > 0 and mesh.vertices:
            mesh.vertices = _round_coordinates(mesh.vertices, config.vertex_decimals)
    return meshes
