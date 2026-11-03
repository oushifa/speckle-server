"""
SketchUp (.skp) parser and Speckle converter.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path

from specklepy.objects.base import Base  # pyright: ignore[reportMissingTypeStubs]

from skp_importer.openskp_compat import patch_openskp

ProgressCallback = Callable[[int | None, str | None, str | None, bool], None]

# openskp decodes the classic MFC CArchive container of SketchUp 2013-2020
# (file versions 13-20) and the modern VFF/ZIP container of SketchUp 2021+
# (file versions 21+). Anything older cannot be decoded reliably, so it is
# rejected with an explicit error instead of being passed to a heuristic byte
# scanner, which used to emit corrupted (scrambled) vertices.
_LEGACY_MIN_VERSION = 13  # SketchUp 2013
_VFF_MIN_VERSION = 21  # SketchUp 2021


class SkpParseError(ValueError):
    """Raised when a .skp file cannot be parsed into geometry."""


class SkpUnsupportedVersionError(SkpParseError):
    """Raised when a .skp file's SketchUp version is not supported."""


def _sketchup_release_name(major_version: int) -> str:
    # SketchUp used bare numbers until 2012 (e.g. "SketchUp 8") and release
    # years from 2013 onwards.
    if major_version >= _LEGACY_MIN_VERSION:
        return f"SketchUp {2000 + major_version}"
    return f"SketchUp {major_version}"


def _read_skp_version(file_path: Path) -> tuple[int, str] | None:
    """Return the ``(major, raw)`` SketchUp version from the file header.

    The version is stored as a UTF-16LE ``{major.minor.patch}`` string in the
    header records shared by both the legacy and the VFF containers. Returns
    ``None`` when no version string is present (not a SketchUp model).
    """
    with file_path.open("rb") as handle:
        header = handle.read(0x60)
    text = header.replace(b"\x00", b"")  # UTF-16LE -> ASCII
    match = re.search(rb"\{(\d+(?:\.\d+)*)\}", text)
    if not match:
        return None
    raw = match.group(1).decode("ascii")
    return int(raw.split(".")[0]), raw


def _argb(r: int, g: int, b: int, a: int = 255) -> int:
    return (int(a) << 24) + (int(r) << 16) + (int(g) << 8) + int(b)


def _create_render_material(
    name: str,
    r: int = 200,
    g: int = 200,
    b: int = 200,
    opacity: float = 1.0,
    roughness: float = 0.5,
    metalness: float = 0.0,
    application_id: str | None = None,
) -> Base:
    mat = Base()
    mat["speckle_type"] = "Objects.Other.RenderMaterial"
    mat["name"] = name
    mat["diffuse"] = _argb(r, g, b, int(opacity * 255))
    mat["opacity"] = float(opacity)
    mat["roughness"] = float(roughness)
    mat["metalness"] = float(metalness)
    if application_id:
        mat["applicationId"] = application_id
    return mat


def _create_mesh(
    vertices: list[float],
    faces: list[int],
    *,
    units: str = "m",
    application_id: str,
    name: str | None = None,
    material: Base | None = None,
    layer_name: str | None = None,
) -> Base:
    mesh = Base()
    mesh["speckle_type"] = "Objects.Geometry.Mesh"
    mesh["applicationId"] = application_id
    if name:
        mesh["name"] = name
    if layer_name:
        mesh["layer"] = layer_name
    mesh["units"] = units
    mesh["vertices"] = vertices
    mesh["faces"] = faces
    if material:
        mesh["renderMaterial"] = material
    return mesh


def _create_collection(
    name: str,
    elements: list[Base],
    application_id: str,
    collection_type: str = "Layer",
) -> Base:
    col = Base()
    col["speckle_type"] = "Objects.Organization.Collection"
    col["name"] = name
    col["collectionType"] = collection_type
    col["applicationId"] = application_id
    col["elements"] = elements
    return col


class SkpParser:
    """
    Parser for SketchUp (.skp) files.
    Extracts geometric components, meshes, groups, layers, and materials into
    Speckle objects.
    """

    def __init__(
        self,
        file_path: Path | str,
        *,
        stable_root_id: str,
        progress_callback: ProgressCallback | None = None,
    ) -> None:
        self.file_path = Path(file_path)
        self.stable_root_id = stable_root_id
        self.progress_callback = progress_callback
        self.units = "m"

    def parse(self) -> Base:
        if not self.file_path.exists():
            raise FileNotFoundError(f"SKP file not found: {self.file_path}")

        if self.progress_callback:
            self.progress_callback(
                30, "reading_skp", "Reading SketchUp model data", True
            )

        version = _read_skp_version(self.file_path)
        if version is None:
            raise SkpParseError(
                f"Cannot read a SketchUp version from '{self.file_path.name}'. "
                "The file does not look like a valid SketchUp model."
            )
        major_version, raw_version = version
        if major_version < _LEGACY_MIN_VERSION:
            raise SkpUnsupportedVersionError(
                f"Unsupported SketchUp file version: "
                f"{_sketchup_release_name(major_version)} "
                f"(file version {major_version}, header '{raw_version}'). "
                f"Supported versions start at "
                f"{_sketchup_release_name(_LEGACY_MIN_VERSION)} "
                f"(file version {_LEGACY_MIN_VERSION})."
            )

        # Full scene extraction (OpenSKP): multi-component, multi-layer,
        # multi-material. A parse failure raises SkpParseError - we never
        # fabricate geometry from a heuristic byte scan, which used to emit
        # scrambled (corrupted) vertices.
        layers_map = self._parse_openskp(self.file_path)

        # Clean up empty layers
        layers_map = {k: v for k, v in layers_map.items() if v}

        if not layers_map:
            raise SkpParseError(
                f"No geometry found in '{self.file_path.name}' "
                f"({_sketchup_release_name(major_version)})."
            )

        if self.progress_callback:
            self.progress_callback(
                70,
                "organizing_layers",
                "Organizing SketchUp layers and collections",
                True,
            )

        layer_collections: list[Base] = []
        for layer_name in sorted(layers_map.keys()):
            elements = layers_map[layer_name]
            if not elements:
                continue

            for idx, el in enumerate(elements):
                if not getattr(el, "applicationId", None):
                    el["applicationId"] = f"{self.stable_root_id}:{layer_name}:{idx}"

            layer_col = _create_collection(
                name=layer_name,
                elements=elements,
                application_id=f"{self.stable_root_id}:layer:{layer_name}",
                collection_type="Layer",
            )
            layer_collections.append(layer_col)

        root = _create_collection(
            name=self.file_path.name,
            elements=layer_collections,
            application_id=self.stable_root_id,
            collection_type="Model",
        )
        return root

    def _parse_openskp(self, file_path: Path) -> dict[str, list[Base]]:
        """
        Extract full component hierarchies, primitives, materials, and layers.
        """
        try:
            import openskp

            patch_openskp()

            file_obj = openskp.SkpFile(str(file_path))
            scene = file_obj.build_scene()
            if not scene or not getattr(scene, "glb_primitives", None):
                return {}

            mesh_index = getattr(scene, "mesh_index", {}) or {}
            gltf_materials = getattr(scene, "gltf_materials", []) or []

            # Pre-create render materials
            materials: list[Base] = []
            for i, mat_dict in enumerate(gltf_materials):
                pbr = (
                    mat_dict.get("pbrMetallicRoughness", {})
                    if isinstance(mat_dict, dict)
                    else {}
                )
                color = pbr.get("baseColorFactor", [0.8, 0.8, 0.8, 1.0])
                r = int(color[0] * 255)
                g = int(color[1] * 255)
                b = int(color[2] * 255)
                a = float(color[3]) if len(color) > 3 else 1.0
                roughness = float(pbr.get("roughnessFactor", 0.5))
                metalness = float(pbr.get("metallicFactor", 0.0))
                mat_name = (
                    mat_dict.get("name")
                    if isinstance(mat_dict, dict) and mat_dict.get("name")
                    else f"Material_{i}"
                )
                mat_obj = _create_render_material(
                    name=mat_name,
                    r=r,
                    g=g,
                    b=b,
                    opacity=a,
                    roughness=roughness,
                    metalness=metalness,
                    application_id=f"{self.stable_root_id}:mat:{i}",
                )
                materials.append(mat_obj)

            layers_map: dict[str, list[Base]] = {}

            for idx, prim in enumerate(scene.glb_primitives):
                positions = getattr(prim, "positions", None)
                indices = getattr(prim, "indices", None)
                if (
                    positions is None
                    or indices is None
                    or len(positions) == 0
                    or len(indices) == 0
                ):
                    continue

                geom_name = getattr(prim, "geom_name", f"geom_{idx}")
                meta = mesh_index.get(geom_name)

                layer_name = "Layer0"
                comp_name = geom_name
                path_str = ""
                if meta:
                    layer_name = getattr(meta, "layer", "Layer0") or "Layer0"
                    comp_name = getattr(meta, "name", geom_name) or geom_name
                    defn_name = getattr(meta, "definition_name", "") or ""
                    if defn_name and defn_name != comp_name:
                        comp_name = f"{comp_name} ({defn_name})"
                    path_str = getattr(meta, "path", "") or ""

                vertices: list[float] = [float(v) for v in positions]

                # Convert triangle indices to Speckle faces format: [3, i0, i1, i2, ...]
                faces: list[int] = []
                for t_idx in range(0, len(indices) - 2, 3):
                    faces.extend(
                        [
                            3,
                            int(indices[t_idx]),
                            int(indices[t_idx + 1]),
                            int(indices[t_idx + 2]),
                        ]
                    )

                if not faces:
                    continue

                mat_idx = getattr(prim, "material_index", None)
                assigned_mat = None
                if mat_idx is not None and 0 <= mat_idx < len(materials):
                    assigned_mat = materials[mat_idx]

                mesh_obj = _create_mesh(
                    vertices=vertices,
                    faces=faces,
                    units=self.units,
                    application_id=f"{self.stable_root_id}:{layer_name}:{idx}",
                    name=comp_name,
                    material=assigned_mat,
                    layer_name=layer_name,
                )
                if path_str:
                    mesh_obj["sketchupPath"] = path_str

                layers_map.setdefault(layer_name, []).append(mesh_obj)

            return layers_map
        except Exception as ex:
            raise SkpParseError(
                f"Failed to parse '{file_path.name}' with OpenSKP: {ex}"
            ) from ex
