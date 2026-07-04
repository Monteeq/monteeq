from sqlalchemy import text
from sqlalchemy.orm import Session


def sync_pk_sequence(db: Session, table_name: str, column: str = "id") -> None:
    """
    Realign a PostgreSQL serial/identity sequence with MAX(id) in the table.
    Safe to call when rows were inserted with explicit IDs or after manual imports.
    """
    if db.get_bind().dialect.name != "postgresql":
        return

    max_id = db.execute(
        text(f"SELECT COALESCE(MAX({column}), 0) FROM {table_name}")
    ).scalar()
    db.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence(:table, :column), "
            ":max_id, :is_called)"
        ),
        {
            "table": table_name,
            "column": column,
            "max_id": max_id,
            "is_called": max_id > 0,
        },
    )
