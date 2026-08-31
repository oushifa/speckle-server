import tempfile
from pathlib import Path

from skp_importer.domain import FileimportPayload, FileimportResult, FileimportSuccess
from skp_importer.skp_parser import SkpParser


def test_skp_parser_fallback_flow():
    with tempfile.TemporaryDirectory() as tmpdir:
        dummy_skp = Path(tmpdir) / "test.skp"
        # Write dummy binary file
        dummy_skp.write_bytes(
            b"SketchUp Model dummy content for unit test testing 12345678"
        )

        parser = SkpParser(dummy_skp, stable_root_id="test_model_123")
        root = parser.parse()

        assert root["speckle_type"] == "Objects.Organization.Collection"
        assert root["name"] == "test.skp"
        assert root["applicationId"] == "test_model_123"
        assert len(root["elements"]) > 0

        layer0 = root["elements"][0]
        assert layer0["speckle_type"] == "Objects.Organization.Collection"
        assert layer0["name"] == "Layer0"
        assert len(layer0["elements"]) > 0


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
