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
                    item_count INTEGER NOT NULL DEFAULT 0,
                    data BLOB NOT NULL
                );
                """
            )

    def put(self, geometry_id: int, display_value: list[Base]) -> None:
        """Store the display value (list of Meshes) for a geometry ID."""
        data_bytes = pickle.dumps(display_value, protocol=pickle.HIGHEST_PROTOCOL)
        count = len(display_value)
        with self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO geometries (id, item_count, data)"
                " VALUES (?, ?, ?);",
                (geometry_id, count, data_bytes),
            )

    def put_batch(self, items: list[tuple[int, list[Base]]]) -> None:
        """Store multiple display values in a single transaction."""
        if not items:
            return
        records = [
            (
                geom_id,
                len(val),
                pickle.dumps(val, protocol=pickle.HIGHEST_PROTOCOL),
            )
            for geom_id, val in items
        ]
        with self._conn:
            self._conn.executemany(
                "INSERT OR REPLACE INTO geometries (id, item_count, data)"
                " VALUES (?, ?, ?);",
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

    def get_count(self, geometry_id: int) -> int:
        """Return the count of items for a geometry without deserializing the BLOB."""
        cursor = self._conn.cursor()
        cursor.execute(
            "SELECT item_count FROM geometries WHERE id = ?;", (geometry_id,)
        )
        row = cursor.fetchone()
        return row[0] if row else 0

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

    def total_bytes(self) -> int:
        """Return the total pickled payload size of the stored geometries.

        Callers snapshot this once before uploading, so the value stays a stable
        denominator for upload progress even though rows are reclaimed from the
        cache as geometries are consumed during serialization.
        """
        cursor = self._conn.cursor()
        cursor.execute("SELECT COALESCE(SUM(length(data)), 0) FROM geometries;")
        row = cursor.fetchone()
        return int(row[0]) if row else 0

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
    """A lazy-loading, memory-releasing list proxy for DataObject.displayValue.

    Satisfies isinstance(..., list) check in specklepy.
    Defers deserializing large Meshes from SQLite disk cache until BaseObjectSerializer
    traverses the attribute during send(), yields them one-by-one, and frees memory.
    """

    def __init__(
        self, geometry_id: int, disk_cache: GeometryDiskCache, item_count: int = 0
    ) -> None:
        super().__init__()
        self._geometry_id = geometry_id
        self._disk_cache = disk_cache
        self._item_count = item_count
        self._consumed = False

    def __iter__(self) -> Any:
        if self._consumed:
            return iter([])
        self._consumed = True
        items = self._disk_cache.pop(self._geometry_id)
        while items:
            # 即用即扔：yield 出一个后立即移除，断开局部强引用
            # 便于 GC 即时回收已序列化网格，避免堆积
            yield items.pop(0)

    def __len__(self) -> int:
        if self._consumed:
            return 0
        if self._item_count > 0:
            return self._item_count
        return self._disk_cache.get_count(self._geometry_id)

    def __getitem__(self, idx: Any) -> Any:
        items = self._disk_cache.get(self._geometry_id)
        return items[idx]

    def __bool__(self) -> bool:
        if self._consumed:
            return False
        if self._item_count > 0:
            return True
        return self._disk_cache.has(self._geometry_id)
