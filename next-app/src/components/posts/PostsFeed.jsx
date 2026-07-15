'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageSquare,
  Repeat2,
  Send,
  MoreHorizontal,
  Loader2,
  X,
  Trash2,
  Flag,
} from 'lucide-react';
import CommentsDrawer from '@/components/flash/CommentsDrawer';
import { useAuth } from '@/context/AuthContext';
import { useReport } from '@/context/ReportContext';
import {
  fetchPostsPage,
  likePost,
  repostPost,
  deletePost,
  POSTS_PAGE_SIZE,
} from '@/lib/clientApi';
import styles from '@/styles/pages/Posts.module.css';

function formatTime(dateStr) {
  if (!dateStr) return 'some time ago';
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function PostCard({
  post,
  lastRef,
  user,
  onLike,
  onRepost,
  onDelete,
  onComment,
  activePostMenuId,
  setActivePostMenuId,
  onSelectImage,
}) {
  const isRepost = !!post.original_post;
  const displayData = isRepost ? post.original_post : post;
  const reposter = isRepost ? post.owner : null;

  return (
    <article className={styles.postCard} ref={lastRef}>
      {isRepost && (
        <div className={styles.repostBadge}>
          <Repeat2 size={14} /> Reposted by {reposter?.username}
        </div>
      )}

      <div className={styles.cardHeader}>
        <div className={styles.authorInfo}>
          <Link href={`/profile/${displayData.owner?.username || ''}`} className={styles.avatar}>
            {displayData.owner?.profile_pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayData.owner.profile_pic} alt="" loading="lazy" />
            ) : (
              <div className={styles.avatarFallback}>
                {displayData.owner?.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </Link>
          <div className={styles.authorText}>
            <Link
              href={`/profile/${displayData.owner?.username || ''}`}
              className={styles.authorName}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {displayData.owner?.username || 'Anonymous'}
            </Link>
            <div className={styles.postTime}>{formatTime(displayData.created_at)}</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.optionsBtn}
            onClick={(e) => {
              e.stopPropagation();
              setActivePostMenuId(activePostMenuId === displayData.id ? null : displayData.id);
            }}
          >
            <MoreHorizontal size={20} />
          </button>
          {activePostMenuId === displayData.id && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-glass)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 10,
                minWidth: 130,
                overflow: 'hidden',
              }}
            >
              {user && user.id === displayData.owner_id ? (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(displayData.id);
                    setActivePostMenuId(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    color: '#ff4d4d',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Trash2 size={14} /> Delete Post
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    openReportModal('post', displayData.id);
                    setActivePostMenuId(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Flag size={14} /> Report Post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/post/${displayData.id}`}
        className={styles.content}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        {displayData.content}
      </Link>

      {displayData.image_url && (
        <button
          type="button"
          className={styles.imageContainer}
          onClick={() => onSelectImage(displayData.image_url)}
          style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer', width: '100%' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayData.image_url}
            alt="Post content"
            className={styles.postImage}
            loading="lazy"
          />
        </button>
      )}

      {displayData.tags && (
        <div className={styles.tags}>
          {displayData.tags.split(',').map((tag, i) => (
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
          onClick={() => onLike(displayData.id)}
          className={`${styles.actionBtn} ${displayData.liked_by_user ? styles.active : ''}`}
        >
          <Heart size={18} fill={displayData.liked_by_user ? 'var(--accent-primary)' : 'none'} />
          <span>{displayData.likes_count || 0}</span>
        </button>

        <button type="button" onClick={() => onComment(displayData.id)} className={styles.actionBtn}>
          <MessageSquare size={18} />
          <span>{displayData.comments_count || 0}</span>
        </button>

        <button type="button" onClick={() => onRepost(displayData.id)} className={styles.actionBtn}>
          <Repeat2 size={18} />
          <span>{isRepost ? 'Reposted' : ''}</span>
        </button>

        <div className={styles.viewsCount}>{displayData.views_count || 0} views</div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/post/${displayData.id}`);
          }}
          className={styles.actionBtn}
          aria-label="Copy link"
        >
          <Send size={18} />
        </button>
      </div>
    </article>
  );
}

export default function PostsFeed({ initialPosts = [] }) {
  const { token, user } = useAuth();
  const { openReportModal } = useReport();
  const [posts, setPosts] = useState(initialPosts);
  const [nextSkip, setNextSkip] = useState(initialPosts.length);
  const [hasMore, setHasMore] = useState(initialPosts.length >= POSTS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activePostMenuId, setActivePostMenuId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    const handleCloseMenu = () => setActivePostMenuId(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchPostsPage({ skip: nextSkip, token });
      const list = Array.isArray(data) ? data : [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...list.filter((p) => !seen.has(p.id))];
      });
      setNextSkip((s) => s + list.length);
      setHasMore(list.length >= POSTS_PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, nextSkip, token]);

  const observerRef = useRef(null);
  const setLastPostRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || loadingMore || !hasMore) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMore();
      });
      observerRef.current.observe(node);
    },
    [loadingMore, hasMore, loadMore]
  );

  const handleLike = async (id) => {
    if (!token) return;
    try {
      const result = await likePost(id, token);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.original_post?.id === id) {
            return {
              ...p,
              original_post: {
                ...p.original_post,
                liked_by_user: result.liked,
                likes_count: result.likes_count,
              },
            };
          }
          if (p.id === id) {
            return { ...p, liked_by_user: result.liked, likes_count: result.likes_count };
          }
          return p;
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepost = async (id) => {
    if (!token) return;
    try {
      await repostPost(id, token);
      const data = await fetchPostsPage({ skip: 0, token });
      const list = Array.isArray(data) ? data : [];
      setPosts(list);
      setNextSkip(list.length);
      setHasMore(list.length >= POSTS_PAGE_SIZE);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(id, token);
      setPosts((prev) => prev.filter((p) => p.id !== id && p.original_post?.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.postsContainer}>
      <h1 className={styles.header}>Community</h1>

      <div className={styles.feedList}>
        {posts.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              lastRef={posts.length === index + 1 ? setLastPostRef : null}
              user={user}
              onLike={handleLike}
              onRepost={handleRepost}
              onDelete={handleDelete}
              onComment={setActiveCommentPostId}
              activePostMenuId={activePostMenuId}
              setActivePostMenuId={setActivePostMenuId}
              onSelectImage={setSelectedImage}
            />
          ))
        )}
      </div>

      {loadingMore && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Loader2 className="animate-spin" color="var(--accent-primary)" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
          }}
        >
          You&apos;ve reached the end of the feed!
        </div>
      )}

      {activeCommentPostId && (
        <CommentsDrawer postId={activeCommentPostId} onClose={() => setActiveCommentPostId(null)} />
      )}

      {selectedImage && (
        <div className={styles.modalOverlay} onClick={() => setSelectedImage(null)} role="presentation">
          <button type="button" className={styles.closeModal} onClick={() => setSelectedImage(null)}>
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Preview"
            className={styles.modalImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
