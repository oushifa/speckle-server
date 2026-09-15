import os
import tempfile
from pathlib import Path

import ifcopenshell
from specklepy.objects.data_objects import DataObject
from specklepy.objects.geometry import Mesh
from specklepy.serialization.base_object_serializer import BaseObjectSerializer
from specklepy.transports.abstract_transport import AbstractTransport

from ifc_importer.disk_cache import GeometryDiskCache
from ifc_importer.process_job import (
    DiskBackedGeometryMap,
    create_bounded_geometry_iterator,
    resolve_upload_tuning,
)


class MockTransport(AbstractTransport):
    def __init__(self):
        self.saved_objects = {}

    def begin_write(self):
        pass

    def end_write(self):
        pass

    def save_object(self, id: str, serialized_object: str):  # noqa: A002
        self.saved_objects[id] = serialized_object

    def copy_object_and_children(self, id, target_transport):  # noqa: A002
        pass

    def get_object(self, id):  # noqa: A002
        return self.saved_objects.get(id)

    def has_objects(self, id_list):
        return {i: (i in self.saved_objects) for i in id_list}

    @property
    def name(self):
        return "MockTransport"

    def save_object_from_transport(self, id, source_transport):  # noqa: A002
        pass


def test_disk_cache_basic_operations():
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "geom.sqlite"
        cache = GeometryDiskCache(db_path)

        # Verify put and get
        mesh1 = Mesh(
            vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            faces=[3, 0, 1, 2],
            units="m",
        )
        cache.put(101, [mesh1])
        assert cache.has(101) is True
        assert cache.has(999) is False
        assert cache.count() == 1

        # Verify get does not delete
        retrieved = cache.get(101)
        assert len(retrieved) == 1
        assert cache.count() == 1

        # Verify pop deletes from sqlite
        popped = cache.pop(101)
        assert len(popped) == 1
        assert cache.count() == 0
        assert cache.has(101) is False

        cache.close()


def test_disk_cache_batch_put():
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "geom_batch.sqlite"
        with GeometryDiskCache(db_path) as cache:
            batch = [
                (
                    i,
                    [
                        Mesh(
                            vertices=[float(i), 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
                            faces=[3, 0, 1, 2],
                            units="m",
                        )
                    ],
                )
                for i in range(10)
            ]
            cache.put_batch(batch)
            assert cache.count() == 10
            for i in range(10):
                assert cache.has(i) is True


def test_lazy_geometry_list_streaming_serialization():
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "streaming.sqlite"
        with GeometryDiskCache(db_path) as cache:
            mesh = Mesh(
                vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
                faces=[3, 0, 1, 2],
                units="m",
            )
            cache.put(42, [mesh])

            geom_map = DiskBackedGeometryMap(cache)
            assert 42 in geom_map
            assert 999 not in geom_map

            lazy_list = geom_map.get(42)
            assert isinstance(lazy_list, list)
            assert bool(lazy_list) is True
            assert lazy_list._consumed is False  # Still not read from disk!

            # Construct DataObject
            data_obj = DataObject(
                name="SampleWall",
                properties={"Type": "Exterior"},
                displayValue=lazy_list,
            )
            assert lazy_list._consumed is False  # Constructing did not load!

            # Serialize via BaseObjectSerializer
            transport = MockTransport()
            serializer = BaseObjectSerializer(write_transports=[transport])
            root_id, serialized_dict = serializer.traverse_base(data_obj)

            # Verification
            assert lazy_list._consumed is True  # Loaded on serialization demand
            assert cache.count() == 0  # Reclaimed from disk cache
            assert len(serialized_dict["displayValue"]) == 1
            assert serialized_dict["displayValue"][0]["speckle_type"] == "reference"
            mesh_ref_id = serialized_dict["displayValue"][0]["referencedId"]
            assert mesh_ref_id in serialized_dict["__closure"]
            assert transport.has_objects([mesh_ref_id])[mesh_ref_id] is True


def test_bounded_concurrency_config():
    os.environ["IFC_CONCURRENCY"] = "3"
    os.environ["IFC_MESHER_LINEAR_DEFLECTION"] = "0.8"

    f = ifcopenshell.file()
    _, concurrency = create_bounded_geometry_iterator(f)
    assert concurrency == 3

    del os.environ["IFC_CONCURRENCY"]
    del os.environ["IFC_MESHER_LINEAR_DEFLECTION"]


UPLOAD_TUNING_ENV = (
    "IFC_UPLOAD_BATCH_MB",
    "IFC_UPLOAD_BATCH_LENGTH",
    "IFC_UPLOAD_BATCH_BUFFER",
    "IFC_UPLOAD_THREADS",
)


def test_disk_cache_total_bytes():
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "total_bytes.sqlite"
        with GeometryDiskCache(db_path) as cache:
            assert cache.total_bytes() == 0
            mesh = Mesh(
                vertices=[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0],
                faces=[3, 0, 1, 2],
                units="m",
            )
            cache.put(1, [mesh])
            first = cache.total_bytes()
            assert first > 0

            cache.put(2, [mesh])
            assert cache.total_bytes() == first * 2

            # Popping reclaims the row; callers snapshot the total before upload.
            cache.pop(1)
            assert cache.total_bytes() == first


def test_upload_tuning_config():
    for key in UPLOAD_TUNING_ENV:
        os.environ.pop(key, None)

    defaults = resolve_upload_tuning()
    assert defaults.max_batch_size_mb == 8.0
    assert defaults.max_batch_length == 2000
    assert defaults.batch_buffer_length == 3
    assert defaults.thread_count == 4

    os.environ["IFC_UPLOAD_BATCH_MB"] = "12.5"
    os.environ["IFC_UPLOAD_BATCH_LENGTH"] = "500"
    os.environ["IFC_UPLOAD_BATCH_BUFFER"] = "5"
    os.environ["IFC_UPLOAD_THREADS"] = "2"

    overridden = resolve_upload_tuning()
    assert overridden.max_batch_size_mb == 12.5
    assert overridden.max_batch_length == 500
    assert overridden.batch_buffer_length == 5
    assert overridden.thread_count == 2

    # Invalid or out-of-range values fall back to safe minimums/defaults.
    os.environ["IFC_UPLOAD_BATCH_MB"] = "not-a-number"
    os.environ["IFC_UPLOAD_THREADS"] = "0"
    guarded = resolve_upload_tuning()
    assert guarded.max_batch_size_mb == 8.0
    assert guarded.thread_count == 1

    for key in UPLOAD_TUNING_ENV:
        os.environ.pop(key, None)


if __name__ == "__main__":
    test_disk_cache_basic_operations()
    test_disk_cache_batch_put()
    test_disk_cache_total_bytes()
    test_lazy_geometry_list_streaming_serialization()
    test_bounded_concurrency_config()
    test_upload_tuning_config()
    print("All unit tests passed successfully!")
