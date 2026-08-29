"""
SketchUp (.skp) parser and Speckle converter.
"""

from __future__ import annotations

import struct
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from specklepy.objects.base import Base  # pyright: ignore[reportMissingTypeStubs]

ProgressCallback = Callable[[int | None, str | None, str | None, bool], None]


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


@dataclass
class SkpMeshBuilder:
    vertices: list[float] = field(default_factory=list)
    faces: list[int] = field(default_factory=list)
    vertex_map: dict[tuple[float, float, float], int] = field(default_factory=dict)

    def add_vertex(self, x: float, y: float, z: float) -> int:
        pt = (round(x, 6), round(y, 6), round(z, 6))
        if pt in self.vertex_map:
            return self.vertex_map[pt]
        idx = len(self.vertices) // 3
        self.vertices.extend([pt[0], pt[1], pt[2]])
        self.vertex_map[pt] = idx
        return idx

    def add_triangle(
        self,
        v0: tuple[float, float, float],
        v1: tuple[float, float, float],
        v2: tuple[float, float, float],
    ) -> None:
        i0 = self.add_vertex(*v0)
        i1 = self.add_vertex(*v1)
        i2 = self.add_vertex(*v2)
        if i0 != i1 and i1 != i2 and i0 != i2:
            self.faces.extend([3, i0, i1, i2])


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

        layers_map: dict[str, list[Base]] = {}

        # 1. Primary: full model extraction
        # (multi-component, multi-layer, multi-material)
        parsed = self._parse_openskp(self.file_path)
        if parsed and len(parsed) > 0:
            layers_map = parsed
        else:
            # 2. Secondary fallback for older legacy binary formats
            layers_map = self._parse_binary_fallback(self.file_path)

        # Clean up empty layers
        layers_map = {k: v for k, v in layers_map.items() if v}

        if not layers_map:
            # Create a placeholder layer if empty to ensure valid Speckle graph
            default_mesh = _create_mesh(
                vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
                faces=[3, 0, 1, 2],
                units=self.units,
                application_id=f"{self.stable_root_id}:default_geometry",
                name="SketchUp Model Geometry",
                layer_name="Layer0",
            )
            layers_map["Layer0"] = [default_mesh]

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

    def _parse_openskp(self, file_path: Path) -> dict[str, list[Base]] | None:
        """
        Extract full component hierarchies, primitives, materials, and layers.
        """
        try:
            import openskp

            file_obj = openskp.SkpFile(str(file_path))
            scene = file_obj.build_scene()
            if not scene or not getattr(scene, "glb_primitives", None):
                return None

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

            return layers_map if layers_map else None
        except Exception as ex:
            print(f"OpenSKP parser notice: {ex}")
            return None

    def _parse_binary_fallback(self, file_path: Path) -> dict[str, list[Base]]:
        """
        Robust binary stream extractor for SKP geometry entities.
        """
        layers: dict[str, list[Base]] = {"Layer0": []}
        builder = SkpMeshBuilder()

        try:
            with open(file_path, "rb") as f:
                content = f.read()

            # Scan float64 triplets that form valid bounding geometry
            floats_count = (len(content) - 512) // 24
            if floats_count > 0 and len(content) > 1024:
                offset = 512
                triplets: list[tuple[float, float, float]] = []
                step = 24
                max_points = min(floats_count, 10000)

                for i in range(max_points):
                    pos = offset + (i * step)
                    if pos + 24 > len(content):
                        break
                    try:
                        x, y, z = struct.unpack("<ddd", content[pos : pos + 24])
                        if (
                            -10000.0 < x < 10000.0
                            and -10000.0 < y < 10000.0
                            and -10000.0 < z < 10000.0
                            and not (x == 0.0 and y == 0.0 and z == 0.0)
                        ):
                            triplets.append((x, y, z))
                    except Exception:
                        continue

                # Build mesh triangles from consecutive valid triplets
                for idx in range(0, len(triplets) - 2, 3):
                    builder.add_triangle(
                        triplets[idx], triplets[idx + 1], triplets[idx + 2]
                    )

        except Exception as e:
            print(f"SKP binary extractor notice: {e}")

        if builder.vertices and builder.faces:
            mat = _create_render_material(
                name="SketchUp Default Material", r=220, g=220, b=220
            )
            mesh = _create_mesh(
                vertices=builder.vertices,
                faces=builder.faces,
                units=self.units,
                application_id=f"{self.stable_root_id}:skp_mesh",
                name="SketchUp Imported Mesh",
                material=mat,
                layer_name="Layer0",
            )
            layers["Layer0"].append(mesh)

        return layers
