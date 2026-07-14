'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageSquare, Repeat2, Send, ArrowLeft } from 'lucide-react';
import CommentsDrawer from '@/components/flash/CommentsDrawer';
import { useAuth } from '@/context/AuthContext';
import { likePost, repostPost } from '@/lib/clientApi';
import styles from '@/styles/pages/Posts.module.css';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString();
}

/**
 * Interactive shell for a single post — likes/comments/repost stay client-side.
 * Title/body/image are already in the server HTML via generateMetadata + this hydrated card.
 */
export default function PostDetailView({ post: initialPost, initialComments = [] }) {
  const { token } = useAuth();
  const isRepost = !!initialPost.original_post;
  const base = isRepost ? initialPost.original_post : initialPost;

  const [post, setPost] = useState(base);
  const [showComments, setShowComments] = useState(false);

  const handleLike = async () => {
    if (!token) return;
    try {
      const result = await likePost(post.id, token);
      setPost((prev) => ({
        ...prev,
        liked_by_user: result.liked,
        likes_count: result.likes_count,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepost = async () => {
    if (!token) return;
    try {
      await repostPost(post.id, token);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.postsContainer}>
      <Link
        href="/posts"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          marginBottom: '1.5rem',
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={18} /> Back to Community
      </Link>

      <article className={styles.postCard}>
        {isRepost && (
          <div className={styles.repostBadge}>
            <Repeat2 size={14} /> Reposted by {initialPost.owner?.username}
          </div>
        )}

        <div className={styles.cardHeader}>
          <div className={styles.authorInfo}>
            <Link href={`/profile/${post.owner?.username || ''}`} className={styles.avatar}>
              {post.owner?.profile_pic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.owner.profile_pic} alt="" />
              ) : (
                <div className={styles.avatarFallback}>
                  {post.owner?.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </Link>
            <div className={styles.authorText}>
              <Link
                href={`/profile/${post.owner?.username || ''}`}
                className={styles.authorName}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                {post.owner?.username || 'Anonymous'}
              </Link>
              <div className={styles.postTime}>{formatTime(post.created_at)}</div>
            </div>
          </div>
        </div>

        <div className={styles.content}>{post.content}</div>

        {post.image_url && (
          <div className={styles.imageContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image_url} alt="" className={styles.postImage} />
          </div>
        )}

        {post.tags && (
          <div className={styles.tags}>
            {post.tags.split(',').map((tag, i) => (
              <Link
                key={i}
                href={`/search?q=${encodeURIComponent(`#${tag.trim()}`)}`}
                className={styles.tag}
              >
                #{tag.trim()}
              </Link>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleLike}
            className={`${styles.actionBtn} ${post.liked_by_user ? styles.active : ''}`}
          >
            <Heart size={18} fill={post.liked_by_user ? 'var(--accent-primary)' : 'none'} />
            <span>{post.likes_count || 0}</span>
          </button>

          <button type="button" onClick={() => setShowComments(true)} className={styles.actionBtn}>
            <MessageSquare size={18} />
            <span>{post.comments_count || 0}</span>
          </button>

          <button type="button" onClick={handleRepost} className={styles.actionBtn}>
            <Repeat2 size={18} />
          </button>

          <div className={styles.viewsCount}>{post.views_count || 0} views</div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
            }}
            className={styles.actionBtn}
            aria-label="Copy link"
          >
            <Send size={18} />
          </button>
        </div>
      </article>

      {showComments && (
        <CommentsDrawer
          postId={post.id}
          onClose={() => setShowComments(false)}
          initialComments={initialComments}
        />
      )}
    </div>
  );
}
