"""Add ivfflat index on media_analysis.caption_embedding for fast cosine similarity.

Revision ID: fe9cdefede17
Revises: 08a64feff54a
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "fe9cdefede17"
down_revision: Union[str, Sequence[str], None] = "08a64feff54a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ivfflat requires at least `lists` rows in the table.
    # If fewer rows exist, skip index creation — it can be added later when
    # enough data accumulates.  Use lists=10 as a safe starting point.
    op.execute(
        """
        DO $$
        DECLARE
            row_count integer;
        BEGIN
            SELECT count(*) INTO row_count FROM media_analysis;
            IF row_count >= 10 THEN
                CREATE INDEX IF NOT EXISTS ix_media_analysis_caption_embedding
                    ON media_analysis
                    USING ivfflat (caption_embedding vector_cosine_ops)
                    WITH (lists = 10);
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS ix_media_analysis_caption_embedding"
    )
