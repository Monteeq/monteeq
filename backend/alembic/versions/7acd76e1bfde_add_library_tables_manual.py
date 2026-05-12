"""Add library tables manual

Revision ID: 7acd76e1bfde
Revises: f463c2bc4dcf
Create Date: 2026-05-12 21:07:41.449114

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7acd76e1bfde'
down_revision: Union[str, Sequence[str], None] = 'f463c2bc4dcf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    """Upgrade schema."""
    # Watch History
    op.create_table(
        'watch_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('video_id', sa.Integer(), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('watched_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('progress_seconds', sa.Integer(), server_default='0'),
        sa.Column('duration_seconds', sa.Integer(), server_default='0'),
        sa.Column('is_completed', sa.Boolean(), server_default='false')
    )
    op.create_index('ix_history_user_id', 'watch_history', ['user_id'])

    # Watch Later
    op.create_table(
        'library_watch_later',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('video_id', sa.Integer(), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('saved_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )
    op.create_index('ix_watchlater_user_id', 'library_watch_later', ['user_id'])

    # Liked Videos
    op.create_table(
        'liked_videos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('video_id', sa.Integer(), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('liked_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )
    op.create_index('ix_liked_user_id', 'liked_videos', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_liked_user_id', table_name='liked_videos')
    op.drop_table('liked_videos')
    op.drop_index('ix_watchlater_user_id', table_name='library_watch_later')
    op.drop_table('library_watch_later')
    op.drop_index('ix_history_user_id', table_name='watch_history')
    op.drop_table('watch_history')

