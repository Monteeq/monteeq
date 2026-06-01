"""add_public_id_to_video

Revision ID: 553a88ea49e2
Revises: 0d4c4236b249
Create Date: 2026-06-01 22:02:03.583845

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '553a88ea49e2'
down_revision: Union[str, Sequence[str], None] = '0d4c4236b249'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('videos', sa.Column('public_id', sa.String(), nullable=True))
    op.execute("UPDATE videos SET public_id = 'vid_' || substring(md5(random()::text), 1, 16) WHERE public_id IS NULL")
    op.create_index(op.f('ix_videos_public_id'), 'videos', ['public_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_videos_public_id'), table_name='videos')
    op.drop_column('videos', 'public_id')

