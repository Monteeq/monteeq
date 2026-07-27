"""Add video_events table for engagement tracking

Revision ID: e8a1b2c3d4f5
Revises: 7acd76e1bfde
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a1b2c3d4f5'
down_revision: Union[str, Sequence[str], None] = '7acd76e1bfde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'video_events',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('video_id', sa.Integer(), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.Text(), nullable=False),
        sa.Column('watch_seconds', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_video_events_user_created', 'video_events', ['user_id', 'created_at'])
    op.create_index('ix_video_events_video_event', 'video_events', ['video_id', 'event_type'])
    op.create_index('ix_video_events_video_created', 'video_events', ['video_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_video_events_video_created', table_name='video_events')
    op.drop_index('ix_video_events_video_event', table_name='video_events')
    op.drop_index('ix_video_events_user_created', table_name='video_events')
    op.drop_table('video_events')
