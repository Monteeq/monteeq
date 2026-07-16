'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Video, Zap, MessageSquare, Loader2, UserPlus, Flame, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFollowingFeed } from '@/hooks/useFeed';
import { getRecommendedCreators, toggleFollow, isAbortOrNetworkError } from '@/lib/browserApi';
import VideoPreviewCard from '@/components/VideoPreviewCard';
import { PostSkeleton, VideoSkeleton } from '@/components/Skeleton';
import SEO from '@/components/SEO';

import { useNotification } from '@/context/NotificationContext';
import styles from '@/styles/pages/Following.module.css';

const Following = () => {
    const { token, user } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();
    const [contentType, setContentType] = useState('all');
    const [recommendations, setRecommendations] = useState([]);
    const [recLoading, setRecLoading] = useState(false);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        refetch
    } = useFollowingFeed(token, contentType);

    useEffect(() => {
        if (token) {
            fetchRecs();
        }
    }, [token]);

    const fetchRecs = async () => {
        setRecLoading(true);
        try {
            const recs = await getRecommendedCreators(token);
            setRecommendations(recs);
        } catch (err) {
            if (!isAbortOrNetworkError(err)) {
                console.error("Failed to fetch recommendations", err);
            }
        } finally {
            setRecLoading(false);
        }
    };

    const handleFollow = async (creatorId) => {
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            await toggleFollow(creatorId, token);
            showNotification('success', 'Followed creator!');
            // In a real app, we'd update local state or invalidate queries
            fetchRecs();
            refetch();
        } catch (err) {
            showNotification('error', err?.message || 'Failed to follow');
        }
    };

    if (!token) {
        return (
            <div className={styles.followingContainer} style={{ textAlign: 'center', paddingTop: '10vh' }}>
                <Users size={64} style={{ marginBottom: '2rem', opacity: 0.5 }} />
                <h1 className={styles.title}>Following</h1>
                <p className={styles.emptyText}>Sign in to see updates from your favorite creators.</p>
                <button className="btn-active" onClick={() => router.push('/login')}>SIGN IN</button>
            </div>
        );
    }

    const allItems = data?.pages.flat() || [];

    return (
        <div className={styles.followingContainer}>
            <SEO 
                title="Following"
                description="Keep up with the creators you love. See the latest videos, flash clips, and community posts from your followed accounts."
            />

            <header className={styles.header}>
                <h1 className={styles.title}>Following</h1>
                <p className={styles.subtitle}>Latest updates from creators you follow</p>
            </header>

            <div className={styles.filters}>
                {['all', 'videos', 'flash', 'posts'].map(type => (
                    <button 
                        key={type}
                        className={`${styles.filterBtn} ${contentType === type ? styles.active : ''}`}
                        onClick={() => setContentType(type)}
                    >
                        {type === 'all' && 'All Content'}
                        {type === 'videos' && 'Videos'}
                        {type === 'flash' && 'Flash'}
                        {type === 'posts' && 'Posts'}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className={styles.feedGrid}>
                    {[...Array(6)].map((_, i) => <VideoSkeleton key={i} />)}
                </div>
            ) : allItems.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                        <Users size={32} />
                    </div>
                    <h2 className={styles.emptyTitle}>Your feed is quiet</h2>
                    <p className={styles.emptyText}>Follow some creators to see their latest videos and posts here.</p>
                    
                    <div className={styles.recommendationsSection}>
                        <h3 className={styles.recommendationsTitle}>
                            <Flame size={20} style={{ verticalAlign: 'middle', marginRight: '8px', color: 'var(--accent-primary)' }} />
                            Recommended Creators
                        </h3>
                        {recLoading ? (
                            <div className={styles.loadingContainer}><Loader2 className="animate-spin" /></div>
                        ) : recommendations.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2rem 1rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.9rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <UserPlus size={32} style={{ opacity: 0.25 }} />
                                <p>No creator recommendations right now — check back soon.</p>
                                <button
                                    className="btn-secondary"
                                    onClick={() => router.push('/search')}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    Search for creators
                                </button>
                            </div>
                        ) : (
                            <div className={styles.recommendationsGrid}>
                                {recommendations.map(creator => (
                                    <div key={creator.id} className={styles.creatorCard}>
                                        <img
                                            src={creator.profile_pic || null}
                                            alt={creator.username}
                                            className={styles.creatorAvatar}
                                            onClick={() => router.push(`/profile/${creator.username}`)}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div
                                            className={styles.creatorAvatar}
                                            style={{
                                                display: 'none',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'var(--accent-primary)',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '1.2rem',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => router.push(`/profile/${creator.username}`)}
                                        >
                                            {creator.username?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div
                                            className={styles.creatorName}
                                            onClick={() => router.push(`/profile/${creator.username}`)}
                                        >
                                            {creator.username}
                                        </div>
                                        <div className={styles.creatorStats}>
                                            {creator.full_name || 'Creator'}
                                        </div>
                                        <button
                                            className={`${styles.followBtn} btn-active`}
                                            onClick={() => handleFollow(creator.id)}
                                        >
                                            FOLLOW
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className={styles.feedGrid}>
                    {allItems.map((item, idx) => {
                        if (item.type === 'video' || item.type === 'flash') {
                            return (
                                <VideoPreviewCard 
                                    key={`${item.type}-${item.data.id}-${idx}`}
                                    video={item.data}
                                    onClick={() => router.push(`/watch/${item.data.id}`)}
                                />
                            );
                        } else if (item.type === 'post') {
                            return (
                                <div key={`post-${item.data.id}-${idx}`} className={styles.postItem} onClick={() => router.push('/posts')}>
                                    {/* Minimal post preview */}
                                    <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', height: '100%', border: '1px solid var(--border-glass)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
                                                <img src={item.data.owner?.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.data.owner?.username}</span>
                                        </div>
                                        <p style={{ fontSize: '0.95rem', lineHeight: '1.4', opacity: 0.9 }}>{item.data.content?.substring(0, 150)}{item.data.content?.length > 150 ? '...' : ''}</p>
                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            <span><Heart size={14} /> {item.data.likes_count}</span>
                                            <span><MessageSquare size={14} /> {item.data.comments_count}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            )}

            {hasNextPage && (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <button 
                        className="btn-secondary"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                    >
                        {isFetchingNextPage ? <Loader2 className="animate-spin" /> : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Following;
