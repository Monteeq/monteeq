"""add cover_source and cover_s3_key to upload_jobs

Revision ID: b4d7e9a1c2f3
Revises: a8c3e1f2b4d6
Create Date: 2026-07-21 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4d7e9a1c2f3"
down_revision: Union[str, Sequence[str], None] = "a8c3e1f2b4d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "upload_jobs",
        sa.Column("cover_source", sa.String(), nullable=False, server_default="auto"),
    )
    op.add_column(
        "upload_jobs",
        sa.Column("cover_s3_key", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("upload_jobs", "cover_s3_key")
    op.drop_column("upload_jobs", "cover_source")
