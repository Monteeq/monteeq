"""performance indices

Revision ID: 7e1a2b3c4d5e
Revises: 7acd76e1bfde
Create Date: 2026-05-12 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7e1a2b3c4d5e'
down_revision = '7acd76e1bfde'
branch_labels = None
depends_on = None

def upgrade():
    # Video performance indices
    op.create_index('idx_videos_created_at_desc', 'videos', [sa.text('created_at DESC')])
    op.create_index('idx_videos_views_desc', 'videos', [sa.text('views DESC')])
    # op.create_index('idx_videos_category_created', 'videos', ['category', sa.text('created_at DESC')])
    
    # Comments optimization
    op.create_index('idx_comments_video_id_created', 'comments', ['video_id', sa.text('created_at DESC')])
    
    # Interaction performance
    op.create_index('idx_likes_video_id', 'likes', ['video_id'])
    op.create_index('idx_views_video_id', 'views', ['video_id'])
    
    # User activity
    op.create_index('idx_watch_history_user_watched', 'watch_history', ['user_id', sa.text('watched_at DESC')])

def downgrade():
    op.drop_index('idx_videos_created_at_desc', table_name='videos')
    op.drop_index('idx_videos_views_desc', table_name='videos')
    op.drop_index('idx_videos_category_created', table_name='videos')
    op.drop_index('idx_comments_video_id_created', table_name='comments')
    op.drop_index('idx_likes_video_id', table_name='likes')
    op.drop_index('idx_views_video_id', table_name='views')
    op.drop_index('idx_watch_history_user_watched', table_name='watch_history')
