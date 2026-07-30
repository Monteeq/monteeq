"""merge_media_analysis_and_previous_heads

Revision ID: 08a64feff54a
Revises: a1b2c3d4e5f6, d3a4b5c6e7f8
Create Date: 2026-07-28 14:17:18.366617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08a64feff54a'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'd3a4b5c6e7f8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
