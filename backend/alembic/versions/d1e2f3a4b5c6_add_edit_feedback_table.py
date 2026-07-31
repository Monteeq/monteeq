"""Add edit_feedback table for AI editing critique history.

Revision ID: d1e2f3a4b5c6
Revises: b7e2f4a1c8d3
Create Date: 2026-07-30 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "b7e2f4a1c8d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "edit_feedback",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("video_id", sa.Integer(), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("metrics_snapshot", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_edit_feedback_video_id"), "edit_feedback", ["video_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_edit_feedback_video_id"), table_name="edit_feedback")
    op.drop_table("edit_feedback")
