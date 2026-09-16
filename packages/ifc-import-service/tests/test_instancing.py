"""Tests for IFC geometry instancing (shared definitions + instance proxies).

Runs with plain ``python tests/test_instancing.py`` (pytest is not a dependency
of this service) and is also collectable by pytest.
"""

import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

import ifcopenshell
import numpy as np
from ifcopenshell import geom
from ifcopenshell import ifcopenshell_wrapper as w
from specklepy.objects.base import Base
from specklepy.objects.geometry import Mesh
from specklepy.serialization.base_object_serializer import BaseObjectSerializer

from ifc_importer.disk_cache import GeometryDiskCache
from ifc_importer.instancing import (
    GeometryInstancer,
    InstancePlan,
    InstancingConfig,
    LazyDefinitionGeometry,
    bake_transform,
    create_instance_definition_proxy,
    create_instance_proxy,
    placement_matrix,
    resolve_instancing_config,
)
from ifc_importer.process_job import ProgressImportJob

FIXTURES = (
    Path(__file__).resolve().parents[2]
    / "fileimport-service"
    / "src"
    / "ifc-dotnet"
    / "ifcs"
)
SHARED_FIXTURE = FIXTURES / "231110AC11-Institute-Var-2-IFC.ifc"


class CountingTransport:
    def __init__(self) -> None:
        self.bytes = 0
        self.objects: dict[str, str] = {}

    def begin_write(self) -> None:
        pass

    def end_write(self) -> None:
        pass

    def save_object(self, id: str, serialized_object: str) -> None:  # noqa: A002
        self.bytes += len(serialized_object)
        self.objects[id] = serialized_object


def _serialize(root: Base) -> tuple[int, dict[str, str], dict]:
    transport = CountingTransport()
    serializer = BaseObjectSerializer(write_transports=[transport])
    _root_id, serialized_root = serializer.write_json(root)
    root_obj = json.loads(serialized_root)
    return len(serialized_root) + transport.bytes, transport.objects, root_obj


def _mesher_settings(use_world_coords: bool):
    settings = geom.settings()
    settings.set("triangulation-type", w.TRIANGLE_MESH)
    settings.set("weld-vertices", False)
    settings.set("use-world-coords", use_world_coords)
    settings.set("no-wire-intersection-check", True)
    settings.set("use-material-names", True)
    settings.set("mesher-linear-deflection", 1.0)
    settings.set("permissive-shape-reuse", True)
    settings.set("circle-segments", 12)
    return settings


@contextmanager
def _converted(ifc_path: Path, instancing: bool = True):
    """Run the importer end to end against a throwaway disk cache."""
    ifc_file = ifcopenshell.open(str(ifc_path))
    tmp_dir = tempfile.TemporaryDirectory()
    cache = GeometryDiskCache(Path(tmp_dir.name) / "geom.sqlite")
    if not instancing:
        os.environ["IFC_INSTANCING"] = "0"
    try:
        job = ProgressImportJob(ifc_file=ifc_file, disk_cache=cache)
        root = job.convert()
        yield job, root, cache
    finally:
        os.environ.pop("IFC_INSTANCING", None)
        cache.close()
        tmp_dir.cleanup()


def _speckle_type(serialized_object: str) -> str:
    return json.loads(serialized_object).get("speckle_type", "")


def test_instance_proxy_serialisation_contract():
    """The viewer reads camelCase `definitionId`/`maxDepth`."""
    proxy = create_instance_proxy("app-1", "ifcdef-1", [1.0] * 16)
    assert proxy.speckle_type == "Speckle.Core.Models.Instances.InstanceProxy"

    serializer = BaseObjectSerializer()
    _id, serialized = serializer.write_json(proxy)
    data = json.loads(serialized)
    assert data["applicationId"] == "app-1"
    assert data["definitionId"] == "ifcdef-1"
    assert data["maxDepth"] == 0
    assert len(data["transform"]) == 16
    assert data["units"] == "m"
    # snake_case would be silently ignored by the viewer
    assert "definition_id" not in data


def test_instance_definition_proxy_serialisation_contract():
    definition = create_instance_definition_proxy("ifcdef-1", "Window", ["m-1", "m-2"])
    assert (
        definition.speckle_type
        == "Speckle.Core.Models.Instances.InstanceDefinitionProxy"
    )

    serializer = BaseObjectSerializer()
    _id, serialized = serializer.write_json(definition)
    data = json.loads(serialized)
    assert data["applicationId"] == "ifcdef-1"
    assert data["objects"] == ["m-1", "m-2"]
    assert data["name"] == "Window"
    assert data["maxDepth"] == 0


def test_placement_matrix_matches_world_coordinates():
    """world == local @ placement_matrix (Speckle/three.js convention)."""
    ifc_file = ifcopenshell.open(str(SHARED_FIXTURE))
    checked = 0
    for product in list(ifc_file.by_type("IfcProduct"))[:200]:
        try:
            world_shape = geom.create_shape(_mesher_settings(True), product)
            local_shape = geom.create_shape(_mesher_settings(False), product)
        except Exception:  # noqa: BLE001 - non-meshable representations
            continue
        world = np.asarray(world_shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
        local = np.asarray(local_shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
        if world.size == 0 or world.shape != local.shape:
            continue
        matrix = placement_matrix(local_shape)
        predicted = local @ matrix[:3, :3].T + matrix[:3, 3]
        assert np.abs(predicted - world).max() < 1e-6
        checked += 1
    assert checked > 50


def test_bake_transform_matches_placement_matrix():
    matrix = np.array(
        [
            [0.0, -1.0, 0.0, 3.0],
            [1.0, 0.0, 0.0, -2.0],
            [0.0, 0.0, 1.0, 0.5],
            [0.0, 0.0, 0.0, 1.0],
        ]
    )
    mesh = Mesh(
        vertices=[1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
        faces=[3, 0, 1, 2],
        vertexNormals=[1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
        units="m",
    )
    bake_transform([mesh], matrix, transform_normals=True)

    expected = (
        np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]) @ matrix[:3, :3].T
        + matrix[:3, 3]
    )
    np.testing.assert_allclose(
        np.asarray(mesh.vertices).reshape(-1, 3), expected, atol=1e-9
    )
    # normals are rotated, not translated, and stay unit length
    lengths = np.linalg.norm(np.asarray(mesh.vertexNormals).reshape(-1, 3), axis=1)
    np.testing.assert_allclose(lengths, np.ones(3), atol=1e-9)


def test_instancing_shares_definitions_and_emits_proxies():
    with _converted(SHARED_FIXTURE) as (job, root, _cache):
        assert job.instancer is not None
        assert job.instancer.instanced_elements > 0
        assert job.instancer.definition_count > 0

        # every definition is actually reused and has unique mesh ids
        for definition in job.instancer.definitions:
            assert definition.instance_count >= 2
            assert definition.objects
            assert len(set(definition.objects)) == len(definition.objects)

        container = root["instanceGeometry"]
        assert container.speckle_type == "Objects.Other.IfcInstanceGeometry"
        definition_proxies = container["instanceDefinitions"]
        definition_ids = {proxy["applicationId"] for proxy in definition_proxies}
        mesh_application_ids = {
            mesh_id for proxy in definition_proxies for mesh_id in proxy["objects"]
        }
        assert mesh_application_ids

        _size, objects, _root_obj = _serialize(root)
        proxy_objects = [
            json.loads(obj)
            for obj in objects.values()
            if _speckle_type(obj).endswith("Instances.InstanceProxy")
        ]
        assert len(proxy_objects) == job.instancer.instanced_elements
        for proxy in proxy_objects:
            assert proxy["definitionId"] in definition_ids
            assert len(proxy["transform"]) == 16

        # the definition meshes themselves are uploaded once each
        mesh_objects = {
            json.loads(obj)["applicationId"]
            for obj in objects.values()
            if _speckle_type(obj) == "Objects.Geometry.Mesh"
        }
        assert mesh_application_ids.issubset(mesh_objects)


def test_definition_geometry_is_reachable_from_the_root():
    """The viewer resolves definitions by walking detached references.

    ``SpeckleConverter.convertInstances`` collects definition meshes by walking
    the converted tree for nodes whose ``applicationId`` matches an
    ``InstanceDefinitionProxy.objects`` entry. The meshes must therefore be
    uploaded as real objects and referenced from the root graph.
    """
    with _converted(SHARED_FIXTURE) as (_job, root, _cache):
        _size, objects, root_obj = _serialize(root)

        container = root_obj["instanceGeometry"]
        mesh_ids = {
            mesh_id
            for proxy in container["instanceDefinitions"]
            for mesh_id in proxy["objects"]
        }
        assert mesh_ids, "fixture must actually share geometry"

        uploaded_by_application_id = {
            json.loads(obj).get("applicationId"): obj_id
            for obj_id, obj in objects.items()
            if _speckle_type(obj) == "Objects.Geometry.Mesh"
        }
        missing = mesh_ids - set(uploaded_by_application_id)
        assert not missing, f"definition meshes missing from the upload: {missing}"

        # the container references them as detached objects (what the viewer's
        # object loader follows)
        references = container["@displayValue"]
        assert isinstance(references, list) and references
        referenced_ids = {entry["referencedId"] for entry in references}
        assert referenced_ids == {uploaded_by_application_id[i] for i in mesh_ids}

        # the object loader walks `__closure` first, so definition meshes must be
        # part of it or they would never be downloaded
        closure = set(root_obj.get("__closure", {}).keys())
        assert referenced_ids.issubset(closure)


def test_instancing_reduces_serialised_payload():
    with _converted(SHARED_FIXTURE, instancing=True) as (_job, root, _cache):
        size_with, _objects_with, _root_with = _serialize(root)

    with _converted(SHARED_FIXTURE, instancing=False) as (job, root, _cache):
        assert job.instancer is None
        size_without, _objects_without, _root_without = _serialize(root)

    assert size_with < size_without, f"{size_with} !< {size_without}"


def test_disabled_instancing_keeps_world_coordinates():
    """The inline path must bake exactly the placement IfcOpenShell would."""
    ifc_file = ifcopenshell.open(str(SHARED_FIXTURE))
    with (
        tempfile.TemporaryDirectory() as tmp_dir,
        GeometryDiskCache(Path(tmp_dir) / "geom.sqlite") as cache,
    ):
        job = ProgressImportJob(ifc_file=ifc_file, disk_cache=cache)
        assert job.instancer is not None
        instancer = GeometryInstancer(
            ifc_file=ifc_file,
            disk_cache=cache,
            render_material_manager=job._render_material_manager,
            config=InstancingConfig(enabled=False),
        )

        checked = 0
        for product in list(ifc_file.by_type("IfcProduct"))[:200]:
            try:
                shape = geom.create_shape(_mesher_settings(False), product)
            except Exception:  # noqa: BLE001
                continue
            if not shape.geometry.faces:
                continue
            meshes = instancer.convert(shape)
            assert meshes, "non-instanced geometry must be inlined"
            assert all(isinstance(mesh, Mesh) for mesh in meshes)

            world_shape = geom.create_shape(_mesher_settings(True), product)
            world = np.asarray(world_shape.geometry.verts, dtype=np.float64).reshape(
                -1, 3
            )
            # Speckle meshes are expanded to 3 vertices per triangle, so the
            # expected positions come from the local face corners.
            local = np.asarray(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
            matrix = placement_matrix(shape)
            expected = (
                local[np.asarray(shape.geometry.faces, dtype=np.int64)]
                @ matrix[:3, :3].T
                + matrix[:3, 3]
            )
            baked = np.asarray(
                [v for mesh in meshes for v in mesh.vertices], dtype=np.float64
            ).reshape(-1, 3)
            assert baked.shape == expected.shape
            # The slimming config rounds to 4 decimals: the only deviation.
            assert np.abs(baked - expected).max() < 1e-4
            # Sanity: the mesher's own world coordinates agree with the
            # placement matrix used for baking.
            assert (
                np.abs(
                    world[np.asarray(shape.geometry.faces, dtype=np.int64)] - expected
                ).max()
                < 1e-6
            )
            checked += 1
        assert checked > 20


def test_lazy_definition_geometry_reclaims_disk_cache():
    with (
        tempfile.TemporaryDirectory() as tmp_dir,
        GeometryDiskCache(Path(tmp_dir) / "geom.sqlite") as cache,
    ):
        mesh = Mesh(
            vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            faces=[3, 0, 1, 2],
            units="m",
        )
        cache.put(-1, [mesh])

        class _Definition:
            cache_id = -1
            objects = ["a"]
            definition_id = "d"
            name = "n"

        lazy = LazyDefinitionGeometry([_Definition()], cache)
        assert isinstance(lazy, list)
        assert bool(lazy) is True
        assert cache.count() == 1  # nothing loaded yet

        exported = list(lazy)
        assert len(exported) == 1
        assert cache.count() == 0  # reclaimed once serialised


def test_instance_plan_counts_shared_maps():
    ifc_file = ifcopenshell.open(str(SHARED_FIXTURE))
    plan = InstancePlan.build(ifc_file)
    assert plan.product_maps
    assert plan.map_usage
    assert max(plan.map_usage.values()) > 1
    for product_id, map_ids in plan.product_maps.items():
        expected = min(plan.map_usage[map_id] for map_id in map_ids)
        assert plan.shared_instance_count(product_id) == expected


def test_instancing_config_env_switch():
    os.environ.pop("IFC_INSTANCING", None)
    os.environ.pop("IFC_INSTANCING_MIN_VERTICES", None)
    defaults = resolve_instancing_config()
    assert defaults.enabled is True
    assert defaults.min_instanced_vertices == 10_000

    os.environ["IFC_INSTANCING"] = "0"
    os.environ["IFC_INSTANCING_MIN_VERTICES"] = "123"
    try:
        overridden = resolve_instancing_config()
        assert overridden.enabled is False
        assert overridden.min_instanced_vertices == 123
    finally:
        os.environ.pop("IFC_INSTANCING", None)
        os.environ.pop("IFC_INSTANCING_MIN_VERTICES", None)


if __name__ == "__main__":
    test_instance_proxy_serialisation_contract()
    test_instance_definition_proxy_serialisation_contract()
    test_bake_transform_matches_placement_matrix()
    test_placement_matrix_matches_world_coordinates()
    test_instancing_shares_definitions_and_emits_proxies()
    test_definition_geometry_is_reachable_from_the_root()
    test_instancing_reduces_serialised_payload()
    test_disabled_instancing_keeps_world_coordinates()
    test_lazy_definition_geometry_reclaims_disk_cache()
    test_instance_plan_counts_shared_maps()
    test_instancing_config_env_switch()
    print("All instancing tests passed successfully!")
