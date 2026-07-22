"""add video_type to upload_jobs

Revision ID: c1d2e3f4a5b6
Revises: b4d7e9a1c2f3
Create Date: 2026-07-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b4d7e9a1c2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "upload_jobs",
        sa.Column("video_type", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("upload_jobs", "video_type")
