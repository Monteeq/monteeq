"""add upload_jobs table

Revision ID: a8c3e1f2b4d6
Revises: 1cb317046980
Create Date: 2026-07-20 21:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a8c3e1f2b4d6"
down_revision: Union[str, Sequence[str], None] = "1cb317046980"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "upload_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="uploading"),
        sa.Column("video_id", sa.Integer(), sa.ForeignKey("videos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_upload_jobs_user_id", "upload_jobs", ["user_id"])
    op.create_index("ix_upload_jobs_status", "upload_jobs", ["status"])
    op.create_index("ix_upload_jobs_video_id", "upload_jobs", ["video_id"])
    op.create_index("ix_upload_jobs_user_status", "upload_jobs", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_upload_jobs_user_status", table_name="upload_jobs")
    op.drop_index("ix_upload_jobs_video_id", table_name="upload_jobs")
    op.drop_index("ix_upload_jobs_status", table_name="upload_jobs")
    op.drop_index("ix_upload_jobs_user_id", table_name="upload_jobs")
    op.drop_table("upload_jobs")
