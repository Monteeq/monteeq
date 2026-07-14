'use client';

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Users, Play, Zap, Sparkles, AlertCircle, MessageSquare } from 'lucide-react';
import { searchUnified } from '@/lib/browserApi';
import { SearchUserSkeleton, SearchVideoSkeleton } from '@/components/Skeleton';
import VideoPreviewCard from '@/components/VideoPreviewCard';
import NativeFeedAd from '@/components/ads/NativeFeedAd';
import AdSenseAd from '@/components/ads/AdSenseAd';
import { useAuth } from '@/context/AuthContext';

const Search = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search).get('q') || '';

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
        <div className="search-page page-container" style={{ padding: '2rem' }}>
            <div className="search-header" style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <SearchIcon size={20} />
                    <span>Search results for</span>
                </div>
                <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>"{query}"</h1>
            </div>

            {loading ? (
                <div className="search-results-content">
                    <div className="results-section" style={{ marginBottom: '4rem' }}>
                        <div style={{ display: 'flex', gap: '2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
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
                <div style={{ textAlign: 'center', padding: '5rem', background: 'rgba(255,0,0,0.05)', borderRadius: '1rem' }}>
                    <AlertCircle size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                    <h3>Oops! {error}</h3>
                    <button onClick={() => window.location.reload()} className="btn-active" style={{ marginTop: '1rem', padding: '0.5rem 2rem' }}>Try Again</button>
                </div>
            ) : !hasResults ? (
                <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--bg-surface)', borderRadius: '1rem' }}>
                    <Sparkles size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                    <h3>No users or videos matched your search.</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Try broadening your keywords.</p>
                </div>
            ) : (
                <div className="search-results-content">
                    {/* Users Section */}
                    {results.users.length > 0 && (
                        <div className="results-section" style={{ marginBottom: '4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.8rem' }}>
                                <Users size={24} color="var(--accent-primary)" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Editors</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                                {results.users.map(u => (
                                    <div
                                        key={u.id}
                                        className="user-card glass hover-scale"
                                        onClick={() => navigate(`/profile/${u.username}`)}
                                        style={{
                                            minWidth: '200px',
                                            padding: '1.5rem',
                                            borderRadius: '20px',
                                            textAlign: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-primary)', margin: '0 auto 1rem', overflow: 'hidden' }}>
                                            {u.profile_pic ? <img src={u.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800 }}>{u.username[0].toUpperCase()}</div>}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{u.full_name || u.username}</div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>@{u.username}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Posts Section */}
                    {results.posts?.length > 0 && (
                        <div className="results-section" style={{ marginBottom: '4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.8rem' }}>
                                <MessageSquare size={24} color="var(--accent-primary)" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Community Posts</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {results.posts.map(post => (
                                    <div
                                        key={post.id}
                                        className="search-result-item glass hover-scale"
                                        onClick={() => navigate('/posts')}
                                        style={{
                                            padding: '1.5rem',
                                            borderRadius: '20px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', overflow: 'hidden' }}>
                                                {post.owner?.profile_pic && <img src={post.owner.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{post.owner?.username}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{post.content}</p>
                                        {post.tags && (
                                            <div style={{ marginTop: '1rem', color: 'var(--accent-primary)', fontSize: '0.9rem' }}>
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
                        <div className="results-section">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.8rem' }}>
                                <Play size={24} color="var(--accent-primary)" />
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Videos & Flash</h2>
                            </div>
                            <div className="search-results-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                        onClick={() => navigate(video.video_type === 'flash' ? `/flash/${video.id}` : `/watch/${video.id}`)}
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
