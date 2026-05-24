import React, { useState } from 'react';
import { Play, Flame, Zap, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHomeFeed, useFlashFeed } from '../hooks/useFeed';
import VideoPreviewCard from '../components/VideoPreviewCard';
import { HomeSkeleton, VideoSkeleton } from '../components/Skeleton';
import SEO from '../components/SEO';

const CATEGORIES = ["All", "Gaming", "Music", "Live", "Comedy", "Vlogs", "Recently uploaded", "News", "Sports", "Learning"];

const Home = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [activeCategory, setActiveCategory] = useState("All");

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        refetch
    } = useHomeFeed(token, activeCategory);

    const { data: flashData, isLoading: flashLoading } = useFlashFeed(token);

    const handleVideoClick = (id) => {
        navigate(`/watch/${id}`);
    };

    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    };

    if (isLoading) return <HomeSkeleton />;

    const allVideos = data?.pages.flat() || [];

    return (
        <div className="home-container page-container">
            <SEO
                title="Home"
                description="Experience the best creative video content on Monteeq. Watch, share, and discover amazing videos from creators worldwide."
                canonical={`${window.location.origin}/`}
            />

            {/* Category Chips Bar */}
            <div className="category-chips-container">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Main Video Feed */}
            <div className="feed-section">
                {allVideos.length > 0 ? (
                    <div className="video-grid">
                        {allVideos.map(video => (
                            <VideoPreviewCard
                                key={video.id}
                                video={video}
                                variant="grid"
                                onClick={() => handleVideoClick(video.id)}
                            />
                        ))}
                    </div>
                ) : !isLoading ? (
                    <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-muted)', background: 'var(--bg-raised)', borderRadius: '32px', margin: '2rem 0', border: '1px solid var(--border-glass)' }}>
                        <Play size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No videos found</h2>
                        <p>We couldn't find any videos in the "{activeCategory}" category. Try another one!</p>
                    </div>
                ) : null}
            </div>

            {/* Flash Section */}
            {flashData && flashData.length > 0 && (
                <div className="flash-shelf-container" style={{ margin: '1rem 0', padding: '1.5rem 0', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
                    <div className="section-title" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}><Zap size={24} fill="currentColor" /></div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Flash</h2>
                        </div>
                        <button
                            onClick={() => navigate('/flash')}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            VIEW ALL
                        </button>
                    </div>

                    <div className="flash-shelf-grid">
                        {flashData.slice(0, window.innerWidth < 768 ? 6 : 18).map(flash => (
                            <div key={flash.id} className="flash-shelf-item hover-scale" onClick={() => navigate('/flash')}>
                                <div className="flash-thumbnail-container">
                                    <img src={flash.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                    <div className="flash-overlay-info">
                                        <div className="flash-item-title">{flash.title}</div>
                                        <div className="flash-item-views">{formatViews(flash.views)} views</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading more skeletons */}
            {isFetchingNextPage && (
                <div className="video-grid" style={{ marginTop: '2rem' }}>
                    {[...Array(4)].map((_, i) => <VideoSkeleton key={`more-skel-${i}`} />)}
                </div>
            )}

            {isError && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--accent-primary)' }}>
                    <p>Failed to load feed. Please check your connection.</p>
                    <button className="btn-secondary" onClick={() => refetch()} style={{ marginTop: '1rem' }}>Retry</button>
                </div>
            )}

            {/* Load More Button or Observer Trigger */}
            {hasNextPage && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
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

export default Home;
