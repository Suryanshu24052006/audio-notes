from pathlib import Path

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import config

pool = ConnectionPool(
    config.DATABASE_URL,
    kwargs={"row_factory": dict_row, "autocommit": True},
    min_size=1,
    max_size=5,
    open=False,
)


def init():
    pool.open()
    schema = (Path(__file__).parent / "schema.sql").read_text()
    with pool.connection() as conn:
        conn.execute(schema)


def update_recording(recording_id, **fields):
    # column names only ever come from our code, values are still passed as params
    columns = ", ".join(f"{name} = %({name})s" for name in fields)
    with pool.connection() as conn:
        conn.execute(
            f"UPDATE recordings SET {columns}, updated_at = now() WHERE id = %(id)s",
            {**fields, "id": recording_id},
        )
