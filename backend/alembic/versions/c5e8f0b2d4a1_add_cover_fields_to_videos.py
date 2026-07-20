"""add cover_url and cover_source to videos

Revision ID: c5e8f0b2d4a1
Revises: b4d7e9a1c2f3
Create Date: 2026-07-21 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5e8f0b2d4a1"
down_revision: Union[str, Sequence[str], None] = "b4d7e9a1c2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("videos", sa.Column("cover_url", sa.String(), nullable=True))
    op.add_column("videos", sa.Column("cover_source", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("videos", "cover_source")
    op.drop_column("videos", "cover_url")
