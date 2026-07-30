"""Add visual_embedding vector(512) column + ivfflat index to media_analysis.

Uses CLIP ViT-B/32 (output dim = 512).

Revision ID: b7e2f4a1c8d3
Revises: fe9cdefede17
Create Date: 2026-07-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "b7e2f4a1c8d3"
down_revision: Union[str, Sequence[str], None] = "fe9cdefede17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the visual_embedding column (CLIP ViT-B/32 → 512 dims)
    op.execute(
        "ALTER TABLE media_analysis "
        "ADD COLUMN IF NOT EXISTS visual_embedding vector(512)"
    )

    # ivfflat index — skip if fewer than 10 rows (ivfflat requires lists <= rows)
    op.execute(
        """
        DO $$
        DECLARE
            row_count integer;
        BEGIN
            SELECT count(*) INTO row_count FROM media_analysis;
            IF row_count >= 10 THEN
                CREATE INDEX IF NOT EXISTS ix_media_analysis_visual_embedding
                    ON media_analysis
                    USING ivfflat (visual_embedding vector_cosine_ops)
                    WITH (lists = 10);
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_media_analysis_visual_embedding")
    op.execute("ALTER TABLE media_analysis DROP COLUMN IF EXISTS visual_embedding")
