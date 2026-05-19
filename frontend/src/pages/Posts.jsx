import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageSquare, Repeat2, Send, MoreHorizontal, Loader2, X } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, getPosts } from '../api';
import { useNavigate } from 'react-router-dom';
import CommentsDrawer from '../components/CommentsDrawer';
import { PostSkeleton } from '../components/Skeleton';
import SEO from '../components/SEO';
import styles from './Posts.module.css';

const Posts = () => {
    const { showNotification } = useNotification();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [skip, setSkip] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeCommentPostId, setActiveCommentPostId] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const observer = useRef();

    const lastPostElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setSkip(prevSkip => prevSkip + 3);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    const fetchPosts = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        try {
            const data = await getPosts(token, isInitial ? 0 : skip, 3);
            if (Array.isArray(data)) {
                if (isInitial) {
                    setPosts(data);
                } else {
                    setPosts(prev => [...prev, ...data]);
                }
                setHasMore(data.length === 3);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
            showNotification('error', err?.message || 'Failed to load community feed');
        } finally {
            if (isInitial) setLoading(false);
            else setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchPosts(true);
    }, [token]);

    useEffect(() => {
        if (skip > 0) {
            fetchPosts(false);
        }
    }, [skip]);

    const formatTime = (dateStr) => {
        if (!dateStr) return 'some time ago';
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const handleLike = async (id) => {
        if (!token) {
            showNotification('error', err?.message || 'Please login to like');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/posts/${id}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setPosts(posts.map(p => p.id === id ? {
                    ...p,
                    liked_by_user: result.liked,
                    likes_count: result.likes_count
                } : p));
            }
        } catch (error) {
            console.error("Error liking post:", error);
        }
    };

    const handleRepost = async (id) => {
        if (!token) {
            showNotification('error', err?.message || 'Please login to repost');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/posts/${id}/repost`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showNotification('success', 'Reposted to your profile!');
                setSkip(0);
                fetchPosts(true);
            } else {
                showNotification('error', err?.message || 'Failed to repost');
            }
        } catch (error) {
            showNotification('error', err?.message || 'Something went wrong while reposting');
        }
    };

    const handleTagClick = (tag) => {
        const query = tag.startsWith('#') ? tag : `#${tag}`;
        navigate(`/search?q=${encodeURIComponent(query)}`);
    };

    return (
        <div className={styles.postsContainer}>
            <SEO 
                title="Community Feed"
                description="Join the conversation on Monteeq. Share updates, images, and thoughts with the creator community."
            />
            
            <h1 className={styles.header}>Community</h1>

            <div className={styles.feedList}>
                {loading ? (
                    [...Array(3)].map((_, i) => <PostSkeleton key={i} />)
                ) : posts.length === 0 ? (
                    <div className={styles.emptyState}>
                        <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p>No posts yet. Be the first to share something!</p>
                    </div>
                ) : (
                    posts.map((post, index) => {
                        const isRepost = !!post.original_post;
                        const displayData = isRepost ? post.original_post : post;
                        const reposter = isRepost ? post.owner : null;

                        return (
                            <div
                                key={post.id}
                                className={styles.postCard}
                                ref={posts.length === index + 1 ? lastPostElementRef : null}
                            >
                                {isRepost && (
                                    <div className={styles.repostBadge}>
                                        <Repeat2 size={14} /> Reposted by {reposter.username}
                                    </div>
                                )}
                                
                                <div className={styles.cardHeader}>
                                    <div className={styles.authorInfo}>
                                        <div className={styles.avatar} onClick={() => navigate(`/profile/${displayData.owner?.username}`)}>
                                            {displayData.owner?.profile_pic ? (
                                                <img src={displayData.owner.profile_pic} alt="" loading="lazy" />
                                            ) : (
                                                <div className={styles.avatarFallback}>
                                                    {displayData.owner?.username?.[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.authorText}>
                                            <div className={styles.authorName} onClick={() => navigate(`/profile/${displayData.owner?.username}`)}>
                                                {displayData.owner?.username || 'Anonymous'}
                                            </div>
                                            <div className={styles.postTime}>{formatTime(displayData.created_at)}</div>
                                        </div>
                                    </div>
                                    <button className={styles.optionsBtn}>
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>

                                <div className={styles.content}>
                                    {displayData.content}
                                </div>

                                {displayData.image_url && (
                                    <div className={styles.imageContainer} onClick={() => setSelectedImage(displayData.image_url)}>
                                        <img src={displayData.image_url} alt="Post content" className={styles.postImage} loading="lazy" />
                                    </div>
                                )}

                                {displayData.tags && (
                                    <div className={styles.tags}>
                                        {displayData.tags.split(',').map((tag, i) => (
                                            <span
                                                key={i}
                                                className={styles.tag}
                                                onClick={() => handleTagClick(tag.trim())}
                                            >
                                                #{tag.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    <button
                                        onClick={() => handleLike(displayData.id)}
                                        className={`${styles.actionBtn} ${displayData.liked_by_user ? styles.active : ''}`}
                                    >
                                        <Heart size={18} fill={displayData.liked_by_user ? 'var(--accent-primary)' : 'none'} />
                                        <span>{displayData.likes_count || 0}</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => setActiveCommentPostId(displayData.id)}
                                        className={styles.actionBtn}
                                    >
                                        <MessageSquare size={18} />
                                        <span>{displayData.comments_count || 0}</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => handleRepost(displayData.id)}
                                        className={styles.actionBtn}
                                    >
                                        <Repeat2 size={18} />
                                        <span>{isRepost ? 'Reposted' : ''}</span>
                                    </button>
                                    
                                    <div className={styles.viewsCount}>
                                        {displayData.views_count || 0} views
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/post/${displayData.id}`);
                                            showNotification('success', 'Link copied!');
                                        }}
                                        className={styles.actionBtn}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {loadingMore && <div style={{ marginTop: '1.5rem' }}><PostSkeleton /></div>}

            {!hasMore && posts.length > 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    You've reached the end of the feed!
                </div>
            )}

            {activeCommentPostId && (
                <CommentsDrawer
                    postId={activeCommentPostId}
                    onClose={() => setActiveCommentPostId(null)}
                />
            )}

            {selectedImage && (
                <div className={styles.modalOverlay} onClick={() => setSelectedImage(null)}>
                    <button className={styles.closeModal} onClick={() => setSelectedImage(null)}>
                        <X size={24} />
                    </button>
                    <img src={selectedImage} alt="Preview" className={styles.modalImage} onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default Posts;
