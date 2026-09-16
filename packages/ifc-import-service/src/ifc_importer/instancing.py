"""Geometry instancing (deduplication) for the IFC importer.

The IFC format reuses geometry through ``IfcRepresentationMap`` /
``IfcMappedItem``: one definition, many placements. IfcOpenShell's mesher bakes
each placement into world coordinates, so the naive converter uploads the same
triangulation once per instance. In real Revit exports this is the dominant size
driver (measured on ``2026-911-single-drf_备份2.ifc``: 7.85 GB of mesh JSON, 97.8%
of which is duplicated definition geometry).

This module emits Speckle's instance model instead:

* every distinct piece of *local* (unplaced) geometry becomes one
  ``InstanceDefinitionProxy`` plus the mesh objects it references;
* every placed element references its definition through an ``InstanceProxy``
  carrying the 4x4 placement matrix.

The Speckle viewer already understands this structure end to end
(``SpeckleConverter.InstanceDefinitionProxyToNode`` /
``ConvertInstanceProxyToNode`` / ``SpeckleGeometryConverter`` /
``Batcher`` hardware instancing), so re-imports render hardware-instanced.

Two safety rules keep the output identical to the old world-coordinate output:

1. Definitions are keyed by a hash of the actual meshed geometry (vertices,
   faces, material ids and materials), not by IFC entity id. Two elements only
   ever share a definition when they mesh to byte-identical geometry.
2. Elements whose definition would not be drawn through the viewer's *hardware
   instancing* path (see ``IFC_INSTANCING_MIN_VERTICES``) keep the previous
   behaviour: the placement matrix is baked into the vertices and the meshes are
   emitted inline, exactly as before.

Environment variables:

* ``IFC_INSTANCING`` - ``0``/``false`` disables instancing entirely and restores
  the previous world-coordinate output (default: ``1``).
* ``IFC_INSTANCING_MIN_VERTICES`` - minimum total vertex count for a definition
  to be instantiated (default: ``10000``, matching the viewer's
  ``Batcher.minInstancedBatchVertices``). Below it the viewer transforms
  positions per-batch without rotating normals, so we keep those elements baked.

Known viewer limitation: for models georeferenced far from the origin the viewer
sets ``needsRTE`` and deliberately skips hardware instancing, falling back to the
per-batch path above (no normal rotation). Those models should either keep
``IFC_INSTANCING=0`` or have normal rotation added to ``MeshBatch.build``.
"""

from __future__ import annotations

import hashlib
import os
from collections import Counter
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from speckleifc.converter.geometry_converter import geometry_to_speckle
from speckleifc.render_material_proxy_manager import RenderMaterialProxyManager
from specklepy.objects.base import Base
from specklepy.objects.geometry import Mesh

from ifc_importer.disk_cache import GeometryDiskCache
from ifc_importer.geometry_slimming import GeometrySlimming, slim_meshes

if TYPE_CHECKING:
    from ifcopenshell import file as ifc_file_type
    from ifcopenshell.ifcopenshell_wrapper import TriangulationElement

INSTANCE_PROXY_SPECKLE_TYPE = "Speckle.Core.Models.Instances.InstanceProxy"
INSTANCE_DEFINITION_PROXY_SPECKLE_TYPE = (
    "Speckle.Core.Models.Instances.InstanceDefinitionProxy"
)
# Hidden container type: the frontend skips anything under `Objects.Other`
# (see `HIDDEN_SPECKLE_TYPES` in the web app) so definitions stay out of the tree UI.
INSTANCE_GEOMETRY_CONTAINER_TYPE = "Objects.Other.IfcInstanceGeometry"

MESH_UNITS = "m"
DEFINITION_ID_PREFIX = "ifcdef-"
DEFAULT_MIN_INSTANCED_VERTICES = 10_000

_FALSEY = {"0", "false", "no", "off", ""}


def create_instance_proxy(
    application_id: str, definition_id: str, transform: list[float]
) -> Base:
    """Build an ``InstanceProxy``.

    ``specklepy`` already owns the ``Speckle.Core.Models.Instances.InstanceProxy``
    type with snake_case fields, but the viewer reads camelCase
    (``obj.DefinitionId || obj.definitionId``, ``obj.maxDepth``), so the object is
    built from a plain ``Base`` with explicit property names.
    """
    proxy = Base.of_type(INSTANCE_PROXY_SPECKLE_TYPE)
    proxy["applicationId"] = application_id
    proxy["definitionId"] = definition_id
    proxy["transform"] = transform
    proxy["units"] = MESH_UNITS
    proxy["maxDepth"] = 0
    return proxy


def create_instance_definition_proxy(
    application_id: str, name: str, objects: list[str]
) -> Base:
    """Build an ``InstanceDefinitionProxy`` (see ``create_instance_proxy``)."""
    proxy = Base.of_type(INSTANCE_DEFINITION_PROXY_SPECKLE_TYPE)
    proxy["applicationId"] = application_id
    proxy["name"] = name
    proxy["objects"] = objects
    proxy["maxDepth"] = 0
    return proxy


@dataclass(frozen=True)
class InstancingConfig:
    """Resolved instancing configuration."""

    enabled: bool = True
    min_instanced_vertices: int = DEFAULT_MIN_INSTANCED_VERTICES


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in _FALSEY


def _env_int(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return max(minimum, int(raw))
    except ValueError:
        return default


def resolve_instancing_config() -> InstancingConfig:
    """Read the instancing configuration from the environment."""
    return InstancingConfig(
        enabled=_env_flag("IFC_INSTANCING", True),
        min_instanced_vertices=_env_int(
            "IFC_INSTANCING_MIN_VERTICES",
            DEFAULT_MIN_INSTANCED_VERTICES,
            0,
        ),
    )


class InstancePlan:
    """Geometry-free IFC information used to decide what is worth instancing."""

    def __init__(
        self,
        product_maps: dict[int, tuple[int, ...]],
        map_usage: dict[int, int],
    ) -> None:
        self.product_maps = product_maps
        self.map_usage = map_usage

    @classmethod
    def build(cls, ifc_file: ifc_file_type) -> InstancePlan:
        product_maps: dict[int, tuple[int, ...]] = {}
        map_usage: Counter[int] = Counter()

        for product in ifc_file.by_type("IfcProduct"):
            representation = getattr(product, "Representation", None)
            if representation is None:
                continue
            map_ids: list[int] = []
            for body in representation.Representations:
                if body.RepresentationIdentifier != "Body":
                    continue
                for item in body.Items:
                    if item.is_a("IfcMappedItem"):
                        map_ids.append(item.MappingSource.id())
            if map_ids:
                product_maps[product.id()] = tuple(map_ids)
                for map_id in set(map_ids):
                    map_usage[map_id] += 1

        return cls(product_maps, dict(map_usage))

    def shared_instance_count(self, product_id: int) -> int:
        """Upper bound on how many elements share this product's geometry.

        If a product combines several representation maps, the *combination* can
        only be as reusable as its least reused map, hence the ``min``.
        """
        map_ids = self.product_maps.get(product_id)
        if not map_ids:
            return 0
        return min(self.map_usage.get(map_id, 0) for map_id in map_ids)


def shape_signature(shape: TriangulationElement) -> str:
    """Content hash identifying a piece of local geometry.

    Covers everything ``geometry_to_speckle`` writes into the output meshes, so
    equal signatures guarantee identical meshes (and therefore safe sharing).
    """
    geometry = shape.geometry
    digest = hashlib.sha1()
    digest.update(np.asarray(geometry.verts, dtype=np.float64).tobytes())
    digest.update(np.asarray(geometry.faces, dtype=np.int64).tobytes())
    digest.update(np.asarray(geometry.material_ids, dtype=np.int64).tobytes())
    for material in geometry.materials:
        digest.update(str(material.calc_hash()).encode("utf-8"))
    return digest.hexdigest()


def placement_matrix(shape: TriangulationElement) -> np.ndarray:
    """4x4 placement matrix (metres) in Speckle's convention.

    IfcOpenShell returns ``world = local @ matrix`` (row-vector convention) for
    shapes meshed with ``use-world-coords=False``; Speckle/three.js expect
    ``world = matrix @ local`` in row-major order, i.e. the transpose.
    """
    matrix = np.asarray(shape.transformation.matrix, dtype=np.float64)
    return matrix.reshape(4, 4).T


def transform_array(shape: TriangulationElement) -> list[float]:
    """Row-major 4x4 array for ``InstanceProxy.transform``."""
    return placement_matrix(shape).reshape(-1).tolist()


def bake_transform(
    meshes: Iterable[Mesh], matrix: np.ndarray, transform_normals: bool
) -> None:
    """Bake a placement matrix into local meshes (in place)."""
    rotation = matrix[:3, :3]
    translation = matrix[:3, 3]

    normal_matrix = None
    if transform_normals:
        try:
            normal_matrix = np.linalg.inv(rotation).T
        except np.linalg.LinAlgError:
            normal_matrix = rotation

    for mesh in meshes:
        if mesh.vertices:
            vertices = np.asarray(mesh.vertices, dtype=np.float64).reshape(-1, 3)
            mesh.vertices = (vertices @ rotation.T + translation).reshape(-1).tolist()

        if normal_matrix is not None and mesh.vertexNormals:
            normals = np.asarray(mesh.vertexNormals, dtype=np.float64).reshape(-1, 3)
            normals = normals @ normal_matrix.T
            lengths = np.linalg.norm(normals, axis=1, keepdims=True)
            lengths[lengths == 0] = 1.0
            mesh.vertexNormals = (normals / lengths).reshape(-1).tolist()


@dataclass
class GeometryDefinition:
    """A shared geometry definition stored in the disk cache."""

    definition_id: str
    cache_id: int
    objects: list[str]
    name: str
    instance_count: int = 0


class LazyDefinitionGeometry(list):
    """Streams the shared definition meshes out of the disk cache.

    Subclasses ``list`` because the ``specklepy`` serialiser only detaches values
    it recognises as lists. Meshes are popped (and therefore reclaimed) one
    definition at a time while the model is being serialised.
    """

    def __init__(
        self, definitions: Iterable[GeometryDefinition], cache: GeometryDiskCache
    ) -> None:
        super().__init__()
        self._definitions = list(definitions)
        self._cache = cache
        self._consumed = False

    def __iter__(self) -> Iterator[Base]:
        if self._consumed:
            return iter([])
        self._consumed = True
        return self._iterate()

    def _iterate(self) -> Iterator[Base]:
        for definition in self._definitions:
            yield from self._cache.pop(definition.cache_id)

    def __len__(self) -> int:
        return sum(len(definition.objects) for definition in self._definitions)

    def __bool__(self) -> bool:
        return bool(self._definitions)


class GeometryInstancer:
    """Converts IfcOpenShell shapes into shared definitions + instance proxies.

    Geometry must be meshed with ``use-world-coords=False``: shapes then carry
    their placement in ``shape.transformation`` and mesh identical local
    geometry for identical definitions.
    """

    def __init__(
        self,
        ifc_file: ifc_file_type,
        disk_cache: GeometryDiskCache,
        render_material_manager: RenderMaterialProxyManager,
        config: InstancingConfig | None = None,
        slimming: GeometrySlimming | None = None,
        plan: InstancePlan | None = None,
    ) -> None:
        self._config = config or resolve_instancing_config()
        self._slimming = slimming or GeometrySlimming()
        self._cache = disk_cache
        self._render_material_manager = render_material_manager
        self._plan = plan if plan is not None else InstancePlan.build(ifc_file)

        self._definitions: dict[str, GeometryDefinition] = {}
        self._ordered_definitions: list[GeometryDefinition] = []

        self.instanced_elements = 0
        self.inlined_elements = 0

    @property
    def enabled(self) -> bool:
        return self._config.enabled

    @property
    def definition_count(self) -> int:
        return len(self._ordered_definitions)

    @property
    def definitions(self) -> tuple[GeometryDefinition, ...]:
        return tuple(self._ordered_definitions)

    def convert(self, shape: TriangulationElement) -> list[Base]:
        """Return the ``displayValue`` list for one meshed element."""
        if not shape.geometry.faces:
            return []

        if self._should_instance(shape):
            display_value = self._instance_display_value(shape)
            if display_value is not None:
                self.instanced_elements += 1
                return display_value

        self.inlined_elements += 1
        return self._inline_display_value(shape)

    def attach(self, tree: Base) -> None:
        """Attach definitions + definition geometry to the model root object."""
        if not self._ordered_definitions:
            return
        container = Base.of_type(INSTANCE_GEOMETRY_CONTAINER_TYPE)
        container["instanceDefinitions"] = [
            create_instance_definition_proxy(
                application_id=definition.definition_id,
                name=definition.name,
                objects=list(definition.objects),
            )
            for definition in self._ordered_definitions
        ]
        # Detached so every mesh is stored as its own object instead of bloating
        # the root object; the lazy list streams them during serialisation.
        container["@displayValue"] = LazyDefinitionGeometry(
            self._ordered_definitions, self._cache
        )
        tree["instanceGeometry"] = container

    def _should_instance(self, shape: TriangulationElement) -> bool:
        if not self._config.enabled:
            return False

        instances = self._plan.shared_instance_count(shape.id)
        if instances < 2:
            return False

        # Speckle meshes are unindexed (3 vertices per triangle), and
        # ``geometry.faces`` holds exactly 3 vertex indices per triangle, so this
        # is the vertex count the viewer will batch.
        vertices = len(shape.geometry.faces)
        return vertices * instances >= self._config.min_instanced_vertices

    def _instance_display_value(self, shape: TriangulationElement) -> list[Base] | None:
        signature = shape_signature(shape)
        definition = self._definitions.get(signature)
        if definition is None:
            definition = self._create_definition(signature, shape)
            if definition is None:
                return None

        definition.instance_count += 1
        return [
            create_instance_proxy(
                application_id=shape.guid,
                definition_id=definition.definition_id,
                transform=transform_array(shape),
            )
        ]

    def _create_definition(
        self, signature: str, shape: TriangulationElement
    ) -> GeometryDefinition | None:
        definition_id = f"{DEFINITION_ID_PREFIX}{signature[:32]}"

        # Convert with a scratch material manager: meshes get their definition
        # scoped application ids first, then the material mappings are replayed
        # against the renamed meshes.
        scratch = RenderMaterialProxyManager()
        meshes = [mesh for mesh in geometry_to_speckle(shape, scratch) if mesh.faces]
        if not meshes:
            return None

        remapped: dict[str, Mesh] = {}
        objects: list[str] = []
        for index, mesh in enumerate(meshes):
            previous_id = mesh.applicationId
            mesh.applicationId = f"{definition_id}_{index}"
            objects.append(mesh.applicationId)
            if previous_id is not None:
                remapped[previous_id] = mesh

        for proxy in scratch.render_material_proxies.values():
            for previous_id in proxy.objects:
                mesh = remapped.get(previous_id)
                if mesh is not None:
                    self._render_material_manager.add_mesh_material_mapping(
                        proxy.value, mesh
                    )

        if self._slimming.enabled:
            slim_meshes(meshes, self._slimming)

        # Definitions live in the disk cache under negative ids so the python
        # heap stays bounded on huge models.
        cache_id = -(len(self._ordered_definitions) + 1)
        self._cache.put(cache_id, meshes)

        name = (
            getattr(shape, "name", None) or getattr(shape, "type", None) or "geometry"
        )
        definition = GeometryDefinition(
            definition_id=definition_id,
            cache_id=cache_id,
            objects=objects,
            name=str(name),
        )
        self._definitions[signature] = definition
        self._ordered_definitions.append(definition)
        return definition

    def _inline_display_value(self, shape: TriangulationElement) -> list[Base]:
        """Previous behaviour: world coordinates inlined on the element."""
        meshes = geometry_to_speckle(shape, self._render_material_manager)
        if shape.geometry.faces:
            bake_transform(
                meshes,
                placement_matrix(shape),
                transform_normals=not self._slimming.drop_vertex_normals,
            )
        if self._slimming.enabled:
            slim_meshes(meshes, self._slimming)
        return list(meshes)


__all__ = [
    "GeometryDefinition",
    "GeometryInstancer",
    "InstancePlan",
    "InstancingConfig",
    "LazyDefinitionGeometry",
    "bake_transform",
    "create_instance_definition_proxy",
    "create_instance_proxy",
    "placement_matrix",
    "resolve_instancing_config",
    "shape_signature",
    "transform_array",
]
