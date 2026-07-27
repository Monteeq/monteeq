'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Search as SearchIcon, Users, Play, Zap, Sparkles, AlertCircle, MessageSquare } from 'lucide-react';
import { searchUnified } from '@/lib/browserApi';
import { SearchUserSkeleton, SearchVideoSkeleton } from '@/components/Skeleton';
import VideoPreviewCard from '@/components/VideoPreviewCard';
import NativeFeedAd from '@/components/ads/NativeFeedAd';
import AdSenseAd from '@/components/ads/AdSenseAd';
import { useAuth } from '@/context/AuthContext';
import styles from '@/styles/pages/SearchPage.module.css';

const Search = () => {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState({ videos: [], users: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const data = await searchUnified(query);
                setResults(data);
            } catch (err) {
                console.error("Search failed:", err);
                setError("Something went wrong with the search.");
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const hasResults = results.users.length > 0 || results.videos.length > 0;

    return (
        <div className={`search-page page-container ${styles.searchPage}`}>
            <div className={styles.searchHeader}>
                <div className={styles.searchHeaderLabel}>
                    <SearchIcon size={20} />
                    <span>Search results for</span>
                </div>
                <h1 className={styles.searchHeaderTitle}>"{query}"</h1>
            </div>

            {loading ? (
                <div className="search-results-content">
                    <div className="results-section" style={{ marginBottom: '4rem' }}>
                        <div className={styles.usersList}>
                            {[1, 2, 3].map(i => <SearchUserSkeleton key={i} />)}
                        </div>
                    </div>
                    <div className="results-section">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {[1, 2, 3].map(i => <SearchVideoSkeleton key={i} />)}
                        </div>
                    </div>
                </div>
            ) : error ? (
                <div className={`${styles.errorState}`}>
                    <AlertCircle size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                    <h3>Oops! {error}</h3>
                    <button onClick={() => window.location.reload()} className={`btn-active ${styles.retryBtn}`}>Try Again</button>
                </div>
            ) : !hasResults ? (
                <div className={`${styles.emptyState}`}>
                    <Sparkles size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                    <h3>No users or videos matched your search.</h3>
                    <p className={styles.errorSubtitle}>Try broadening your keywords.</p>
                </div>
            ) : (
                <div className="search-results-content">
                    {/* Users Section */}
                    {results.users.length > 0 && (
                        <div className={styles.resultsSection}>
                            <div className={styles.sectionHeader}>
                                <Users size={24} color="var(--accent-primary)" />
                                <h2 className={styles.sectionTitle}>Editors</h2>
                            </div>
                            <div className={styles.usersList}>
                                {results.users.map(u => (
                                    <div
                                        key={u.id}
                                        className={`user-card glass hover-scale ${styles.userCard}`}
                                        onClick={() => router.push(`/profile/${u.username}`)}
                                    >
                                        <div className={styles.userAvatar}>
                                            {u.profile_pic ? <img src={u.profile_pic} alt="" className={styles.userAvatarImg} /> : <span>{u.username[0].toUpperCase()}</span>}
                                        </div>
                                        <div className={styles.userName}>{u.full_name || u.username}</div>
                                        <div className={styles.userHandle}>@{u.username}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Posts Section */}
                    {results.posts?.length > 0 && (
                        <div className={styles.resultsSection}>
                            <div className={styles.sectionHeader}>
                                <MessageSquare size={24} color="var(--accent-primary)" />
                                <h2 className={styles.sectionTitle}>Community Posts</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {results.posts.map(post => (
                                    <div
                                        key={post.id}
                                        className={`search-result-item glass hover-scale ${styles.postCard}`}
                                        onClick={() => router.push('/posts')}
                                    >
                                        <div className={styles.postAuthor}>
                                            <div className={styles.postAuthorAvatar}>
                                                {post.owner?.profile_pic && <img src={post.owner.profile_pic} alt="" />}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{post.owner?.username}</span>
                                        </div>
                                        <p className={styles.postContent}>{post.content}</p>
                                        {post.tags && (
                                            <div className={styles.postTags}>
                                                {post.tags.split(',').map(t => `#${t.trim()}`).join(' ')}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Videos Section */}
                    {results.videos.length > 0 && (
                        <div className={styles.resultsSection}>
                            <div className={styles.sectionHeader}>
                                <Play size={24} color="var(--accent-primary)" />
                                <h2 className={styles.sectionTitle}>Videos & Flash</h2>
                            </div>
                            <div className={`search-results-list ${styles.videosList}`}>
                                {/* Sponsored Search Result */}
                                {!user?.is_premium && (
                                    <AdSenseAd 
                                        client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                                        slot={process.env.NEXT_PUBLIC_ADSENSE_INFEED_SLOT_ID}
                                        layoutKey={process.env.NEXT_PUBLIC_ADSENSE_INFEED_LAYOUT_KEY}
                                        format="fluid"
                                    />
                                )}
                                
                                {results.videos.map(video => (
                                    <VideoPreviewCard
                                        key={video.id}
                                        video={video}
                                        variant="list"
                                        onClick={() => router.push(video.video_type === 'flash' ? `/flash/${video.id}` : `/watch/${video.id}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Search;
