"""merge cover_fields_to_videos and video_type_to_upload_jobs

Revision ID: d3a4b5c6e7f8
Revises: c5e8f0b2d4a1, c1d2e3f4a5b6
Create Date: 2026-07-22 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3a4b5c6e7f8"
down_revision: Union[str, Sequence[str], None] = ("c5e8f0b2d4a1", "c1d2e3f4a5b6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
