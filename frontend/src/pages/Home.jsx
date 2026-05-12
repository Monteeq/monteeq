import React, { useState, useEffect } from 'react';
import { Play, Flame, Zap, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useHomeFeed, useFlashFeed } from '../hooks/useFeed';
import VideoPreviewCard from '../components/VideoPreviewCard';
import VirtualizedFeed from '../components/VirtualizedFeed';
import AdSenseAd from '../components/ads/AdSenseAd';
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
        isError 
    } = useHomeFeed(token, activeCategory);

    const { data: flashData, isLoading: flashLoading } = useFlashFeed(token);

    const featured = {
        title: "Origins of the Peak",
        desc: "A Home for Editors.",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
    };

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
            
            {/* Hero Section */}
            <section className="hero-section">
                <img src={featured.image} alt="Featured" className="hero-image" fetchpriority="high" />
                <div className="hero-content">
                    <div className="hero-badge">
                        <Flame size={14} /> <span>FEATURED</span>
                    </div>
                    <h1 className="hero-title">{featured.title}</h1>
                    <p className="hero-desc">{featured.desc}</p>
                    <button
                        className="btn-active hero-btn"
                        onClick={() => navigate(`/watch/${allVideos[0]?.id || 1}`)}
                    >
                        <Play fill="white" size={18} /> WATCH NOW
                    </button>
                </div>
            </section>

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

            {/* Main Video Feed with Virtualization */}
            <div className="feed-section">
                {allVideos.length > 0 ? (
                    <VirtualizedFeed 
                        videos={allVideos} 
                        onVideoClick={handleVideoClick} 
                    />
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        No videos found in this category.
                    </div>
                )}
            </div>

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
