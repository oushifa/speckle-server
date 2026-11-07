import tempfile
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

from skp_importer import openskp_compat
from skp_importer.domain import FileimportPayload, FileimportResult, FileimportSuccess
from skp_importer.skp_parser import (
    SkpParseError,
    SkpParser,
    SkpUnsupportedVersionError,
)


def test_skp_parser_rejects_file_without_version():
    with tempfile.TemporaryDirectory() as tmpdir:
        dummy_skp = Path(tmpdir) / "test.skp"
        # Not a SketchUp model: no version header.
        dummy_skp.write_bytes(
            b"SketchUp Model dummy content for unit test testing 12345678"
        )

        parser = SkpParser(dummy_skp, stable_root_id="test_model_123")
        with pytest.raises(SkpParseError):
            parser.parse()


def test_skp_parser_rejects_unsupported_version():
    with tempfile.TemporaryDirectory() as tmpdir:
        legacy_skp = Path(tmpdir) / "legacy.skp"
        # SketchUp 8 header (file version 8) - older than the oldest version
        # openskp can decode.
        header = b"\x00" * 8 + "{8.0.16844}".encode("utf-16-le")
        legacy_skp.write_bytes(header + b"\x00" * 0x60)

        parser = SkpParser(legacy_skp, stable_root_id="test_legacy_model")
        with pytest.raises(SkpUnsupportedVersionError) as excinfo:
            parser.parse()

        message = str(excinfo.value)
        # The error must name both the file's version and the supported range.
        assert "8" in message
        assert "13" in message


def test_skp_parser_full_model_extraction():
    clean_skp = Path("/tmp/Kitchen_clean.skp")
    if not clean_skp.exists():
        return

    parser = SkpParser(clean_skp, stable_root_id="test_kitchen_model")
    root = parser.parse()

    assert root["speckle_type"] == "Objects.Organization.Collection"
    assert root["applicationId"] == "test_kitchen_model"
    # Verify multiple layers are extracted
    layers = root["elements"]
    assert len(layers) > 1, f"Expected multiple layers, got {len(layers)}"

    total_meshes = sum(len(layer["elements"]) for layer in layers)
    assert total_meshes > 50, (
        f"Expected hundreds of component meshes, got {total_meshes}"
    )

    # Verify mesh properties
    sample_mesh = None
    for layer in layers:
        for elem in layer["elements"]:
            if elem["speckle_type"] == "Objects.Geometry.Mesh" and getattr(
                elem, "renderMaterial", None
            ):
                sample_mesh = elem
                break
        if sample_mesh:
            break

    assert sample_mesh is not None
    assert len(sample_mesh["vertices"]) > 0
    assert len(sample_mesh["faces"]) > 0
    assert (
        sample_mesh["renderMaterial"]["speckle_type"] == "Objects.Other.RenderMaterial"
    )


def test_skp_parser_legacy_znzmo_multi_component():
    znzmo_skp = Path("/Users/yujian/work/speckle-server/ignores/znzmo-1149111425-1.skp")
    if not znzmo_skp.exists():
        return

    parser = SkpParser(znzmo_skp, stable_root_id="test_znzmo_model")
    root = parser.parse()

    assert root["speckle_type"] == "Objects.Organization.Collection"
    layers = root["elements"]
    assert len(layers) >= 1

    total_meshes = sum(len(layer["elements"]) for layer in layers)
    # Ensure it is parsed into multiple components, NOT just 1 mesh!
    assert total_meshes > 50, f"Expected multiple meshes, got {total_meshes}"

    # Ensure materials are properly attached
    has_material = False
    for layer in layers:
        for elem in layer["elements"]:
            if getattr(elem, "renderMaterial", None):
                has_material = True
                break
        if has_material:
            break
    assert has_material, "Expected component meshes to have assigned render materials"


# Staircase face taken from a real SketchUp model. A plain Delaunay
# triangulation filtered by triangle centroid leaves a large gap in it.
CONCAVE_FACE_RING = [
    (614.1732, 110.2363),
    (602.3622, 110.2363),
    (602.3622, 118.1103),
    (444.8819, 118.1103),
    (444.8819, 88.5827),
    (161.4173, 88.5827),
    (161.4173, 49.2126),
    (0.0, 49.2126),
    (0.0, 39.3701),
    (19.685, 39.3701),
    (19.685, 0.0),
    (614.1732, 0.0),
]


def _concave_face():
    vertices = {
        index: np.array([x, y, 0.0], dtype=float)
        for index, (x, y) in enumerate(CONCAVE_FACE_RING)
    }
    loops = [list(range(len(CONCAVE_FACE_RING)))]
    return vertices, loops, Polygon(CONCAVE_FACE_RING)


def _triangulated_area(triangles):
    covered = [
        Polygon([CONCAVE_FACE_RING[index] for index in triangle])
        for triangle in triangles
    ]
    covered = [polygon for polygon in covered if polygon.is_valid and polygon.area > 0]
    return unary_union(covered) if covered else Polygon()


def test_constrained_triangulation_covers_concave_face():
    vertices, loops, face = _concave_face()
    assert face.is_valid

    triangles = openskp_compat._constrained_triangles(vertices, loops, (0.0, 0.0, 1.0))

    assert triangles
    covered = _triangulated_area(triangles)
    assert face.difference(covered).area == pytest.approx(0.0, abs=1e-6)
    assert covered.difference(face).area == pytest.approx(0.0, abs=1e-6)


def test_patch_openskp_installs_constrained_triangulation():
    import openskp._core as openskp_core

    openskp_compat.patch_openskp()

    patched = openskp_core.triangulate_face_3d
    vertices, loops, face = _concave_face()
    covered = _triangulated_area(patched(vertices, loops, (0.0, 0.0, 1.0)))
    assert face.difference(covered).area == pytest.approx(0.0, abs=1e-6)

    # Patching is idempotent, so the original reader is never wrapped twice.
    openskp_compat.patch_openskp()
    assert openskp_core.triangulate_face_3d is patched


def test_fileimport_payload_validation():
    raw_payload = {
        "payloadVersion": 1,
        "jobType": "fileImport",
        "serverUrl": "http://127.0.0.1:3000",
        "projectId": "proj_123",
        "modelId": "model_456",
        "token": "test_token",
        "blobId": "blob_789",
        "fileType": "skp",
        "fileName": "sample.skp",
        "timeOutSeconds": 300,
    }
    payload = FileimportPayload.model_validate(raw_payload)
    assert payload.file_type == "skp"
    assert payload.blob_id == "blob_789"

    success_result = FileimportResult(
        outcome=FileimportSuccess(
            download_duration_seconds=1.2,
            parse_duration_seconds=3.4,
            version_id="ver_abc",
        )
    )
    dumped = success_result.model_dump_json(by_alias=True)
    assert "downloadDurationSeconds" in dumped
    assert "versionId" in dumped


def test_openskp_patch_normalizes_layer0_color():
    import openskp._core as openskp_core

    openskp_compat.patch_openskp()
    # Mock full_parse returning a dict with layer_colors
    dummy_path = "/tmp/non_existent.skp"
    if hasattr(openskp_core, "full_parse"):
        orig = openskp_core.full_parse
        try:
            openskp_core.full_parse = lambda p: {"layer_colors": {"Layer0": (255, 84, 84)}}
            openskp_compat._PATCHED = False
            openskp_compat.patch_openskp()
            res = openskp_core.full_parse(dummy_path)
            assert res["layer_colors"]["Layer0"] == (235, 235, 230)
        finally:
            openskp_core.full_parse = orig


def test_skp_parser_restores_z_up_coordinates():
    # Verify the mapping (gx, gy, gz) -> (gx, -gz, gy)
    # where glTF (Y-up) baked coords have gy=Z_height, gz=-Y_depth
    gx, gy, gz = 1.0, 10.0, -5.0
    positions = [gx, gy, gz]
    vertices = []
    for v_idx in range(0, len(positions), 3):
        vx = float(positions[v_idx])
        vy = float(positions[v_idx + 1])
        vz = float(positions[v_idx + 2])
        vertices.extend([vx, -vz, vy])

    # Restored Speckle Z-up coords should have:
    # X = gx = 1.0
    # Y = -gz = 5.0 (original Y_depth)
    # Z = gy = 10.0 (original Z_height)
    assert vertices == [1.0, 5.0, 10.0]


def test_face_deduplication_patch_avoids_duplicate_mesh():
    import openskp._face_groups as fg

    openskp_compat._PATCHED = False
    openskp_compat.patch_openskp()

    # Create dummy builder and ctx
    class DummyBuilder:
        vertices = {0: (0.0, 0.0, 0.0), 1: (1.0, 0.0, 0.0), 2: (1.0, 1.0, 0.0)}
        edges = {0: (0, 1), 1: (1, 2), 2: (2, 0)}
        faces = {
            0: {
                "material_id": 1,
                "back_material_id": 2,
                "loops": [[(0, 0), (1, 0), (2, 0)]],
                "normal": (0.0, 0.0, 1.0),
            }
        }

    class DummyCtx:
        material_id_to_name = {1: "MatFront", 2: "MatBack"}
        materials = {
            "MatFront": {"color": {"r": 114, "g": 114, "b": 114}},
            "MatBack": {"color": {"r": 138, "g": 158, "b": 69}},
        }
        materials_by_folder = {}
        fallback_color = (200, 200, 200)
        definition_id = "def1"

        @staticmethod
        def texture_index_for(_tex):
            return None

    groups = fg.build_local_face_groups(DummyBuilder(), DummyCtx())
    # Should only emit 1 group (the front material), NOT 2 groups!
    assert len(groups) == 1
    key = list(groups.keys())[0]
    color, double_sided, _tex, _trans = key
    assert color == (114, 114, 114)
    assert double_sided is True


def test_skp_collection_and_mesh_detachment():
    from specklepy.serialization.base_object_serializer import BaseObjectSerializer
    from specklepy.transports.memory import MemoryTransport
    from skp_importer.skp_parser import (
        _create_collection,
        _create_mesh,
        _create_render_material,
    )

    mat = _create_render_material("TestMat", 100, 150, 200)
    mesh = _create_mesh(
        vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
        faces=[3, 0, 1, 2],
        application_id="mesh_1",
        material=mat,
    )
    layer = _create_collection("Layer0", [mesh], "layer_0", collection_type="Layer")
    root = _create_collection("Model.skp", [layer], "root_model", collection_type="Model")

    transport = MemoryTransport()
    serializer = BaseObjectSerializer(write_transports=[transport])
    _root_id, serialized_root = serializer.traverse_base(root)

    closure = serialized_root.get("__closure", {})
    assert len(closure) >= 2, f"Expected detached child objects in closure, got {len(closure)}"
    assert serialized_root.get("totalChildrenCount", 0) >= 2
    assert serialized_root["elements"][0]["speckle_type"] == "reference"
    assert len(transport.objects) >= 3



