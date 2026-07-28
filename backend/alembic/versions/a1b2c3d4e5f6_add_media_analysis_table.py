"""Add media_analysis table with pgvector embedding

Revision ID: a1b2c3d4e5f6
Revises: e8a1b2c3d4f5
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e8a1b2c3d4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        'media_analysis',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('video_id', sa.Integer(), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('frame_sample_paths', postgresql.JSONB(), nullable=True),
        sa.Column('scene_cuts', postgresql.JSONB(), nullable=True),
        sa.Column('beat_timestamps', postgresql.JSONB(), nullable=True),
        sa.Column('caption_embedding', postgresql.dialects.postgresql.VECTOR(384), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_media_analysis_video_id', 'media_analysis', ['video_id'])
    op.create_index('ix_media_analysis_status', 'media_analysis', ['status'])


def downgrade() -> None:
    op.drop_index('ix_media_analysis_status', table_name='media_analysis')
    op.drop_index('ix_media_analysis_video_id', table_name='media_analysis')
    op.drop_table('media_analysis')
