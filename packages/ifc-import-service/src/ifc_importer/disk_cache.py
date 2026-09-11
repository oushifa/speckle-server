import contextlib
import pickle
import sqlite3
from pathlib import Path
from typing import Any

from specklepy.objects import Base


class GeometryDiskCache:
    """A disk-backed temporary storage for IFC geometries during conversion.

    Prevents Python memory from accumulating millions of mesh vertices/faces
    by streaming geometries directly into a local SQLite database in WAL mode.
    """

    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)
        self._conn = sqlite3.connect(
            str(self.db_path),
            timeout=30.0,
            check_same_thread=False,
        )
        self._init_db()

    def _init_db(self) -> None:
        with self._conn:
            self._conn.execute("PRAGMA journal_mode = WAL;")
            self._conn.execute("PRAGMA synchronous = NORMAL;")
            self._conn.execute("PRAGMA temp_store = MEMORY;")
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS geometries (
                    id INTEGER PRIMARY KEY,
                    data BLOB NOT NULL
                );
                """
            )

    def put(self, geometry_id: int, display_value: list[Base]) -> None:
        """Store the display value (list of Meshes) for a geometry ID."""
        data_bytes = pickle.dumps(display_value, protocol=pickle.HIGHEST_PROTOCOL)
        with self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO geometries (id, data) VALUES (?, ?);",
                (geometry_id, data_bytes),
            )

    def put_batch(self, items: list[tuple[int, list[Base]]]) -> None:
        """Store multiple display values in a single transaction."""
        if not items:
            return
        records = [
            (
                geom_id,
                pickle.dumps(val, protocol=pickle.HIGHEST_PROTOCOL),
            )
            for geom_id, val in items
        ]
        with self._conn:
            self._conn.executemany(
                "INSERT OR REPLACE INTO geometries (id, data) VALUES (?, ?);",
                records,
            )

    def get(self, geometry_id: int) -> list[Base]:
        """Retrieve geometry without deleting it."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT data FROM geometries WHERE id = ?;", (geometry_id,))
        row = cursor.fetchone()
        if row:
            return pickle.loads(row[0])
        return []

    def pop(self, geometry_id: int) -> list[Base]:
        """Retrieve geometry and immediately delete it to reclaim disk space."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT data FROM geometries WHERE id = ?;", (geometry_id,))
        row = cursor.fetchone()
        if row:
            cursor.execute("DELETE FROM geometries WHERE id = ?;", (geometry_id,))
            self._conn.commit()
            return pickle.loads(row[0])
        return []

    def has(self, geometry_id: int) -> bool:
        """Check if geometry exists in cache."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT 1 FROM geometries WHERE id = ? LIMIT 1;", (geometry_id,))
        return cursor.fetchone() is not None

    def count(self) -> int:
        """Return the number of stored geometries."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM geometries;")
        row = cursor.fetchone()
        return row[0] if row else 0

    def close(self) -> None:
        """Close connection and clean up database files."""
        with contextlib.suppress(Exception):
            self._conn.close()

        for suffix in ["", "-wal", "-shm"]:
            f = Path(f"{self.db_path}{suffix}")
            if f.exists():
                with contextlib.suppress(Exception):
                    f.unlink()

    def __enter__(self) -> "GeometryDiskCache":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()


class LazyGeometryList(list):
    """A lazy-loading list proxy for DataObject.displayValue.

    Satisfies isinstance(..., list) check in specklepy.
    Defers deserializing large Meshes from SQLite disk cache until BaseObjectSerializer
    traverses the attribute during send(), and releases them immediately.
    """

    def __init__(self, geometry_id: int, disk_cache: GeometryDiskCache) -> None:
        super().__init__()
        self._geometry_id = geometry_id
        self._disk_cache = disk_cache
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self._loaded = True
            items = self._disk_cache.pop(self._geometry_id)
            self.extend(items)

    def __iter__(self) -> Any:
        self._ensure_loaded()
        return super().__iter__()

    def __len__(self) -> int:
        self._ensure_loaded()
        return super().__len__()

    def __getitem__(self, idx: Any) -> Any:
        self._ensure_loaded()
        return super().__getitem__(idx)

    def __bool__(self) -> bool:
        if self._loaded:
            return super().__len__() > 0
        return self._disk_cache.has(self._geometry_id)
