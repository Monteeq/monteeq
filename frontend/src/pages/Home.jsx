import React, { useState, useEffect } from 'react';
import { Play, Flame, TrendingUp, Heart, Zap, Loader2 } from 'lucide-react';
import { getVideos, likeVideo, getRecommendedFeed } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import VideoPreviewCard from '../components/VideoPreviewCard';
import NativeFeedAd from '../components/ads/NativeFeedAd';
import DashboardBannerAd from '../components/ads/DashboardBannerAd';
import AdSenseAd from '../components/ads/AdSenseAd';
import { VideoSkeleton, FlashSkeleton, HomeSkeleton } from '../components/Skeleton';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

const CATEGORIES = ["All", "Gaming", "Music", "Live", "Comedy", "Vlogs", "Recently uploaded", "News", "Sports", "Learning"];

const Home = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const { showNotification } = useNotification();
    const [videos, setVideos] = useState([]);
    const [flashVideos, setFlashVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [skip, setSkip] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [activeCategory, setActiveCategory] = useState("All");
    const observer = React.useRef();

    const lastVideoElementRef = React.useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setSkip(prevSkip => prevSkip + 12);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    const featured = {
        title: "Origins of the Peak",
        desc: "A Home for Editors.",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // For logged-in users, use the recommendation engine for the home feed.
            // getRecommendedFeed returns null on error, so we fall back to getVideos.
            let homeData;
            if (token) {
                homeData = await getRecommendedFeed('home', token, 12);
            }
            if (!homeData) {
                homeData = await getVideos('home', token, 0, 12);
            }

            const flashData = await getVideos('flash', token, 0, 18);
            setVideos(Array.isArray(homeData) ? homeData : []);
            setFlashVideos(Array.isArray(flashData) ? flashData : []);
            setHasMore((homeData?.length ?? 0) === 12);
        } catch (err) {
            console.error("Initial fetch error:", err);
            setError("Failed to load content.");
        } finally {
            setLoading(false);
        }
    };

    const fetchMoreVideos = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const newData = await getVideos('home', token, skip, 12);
            if (Array.isArray(newData)) {
                setVideos(prev => [...prev, ...newData]);
                setHasMore(newData.length === 12);
            }
        } catch (err) {
            console.error("Load more error:", err);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [token]);

    useEffect(() => {
        if (skip > 0) {
            fetchMoreVideos();
        }
    }, [skip]);

    const handleVideoClick = (id) => {
        navigate(`/watch/${id}`);
    };

    const handleFlashClick = () => {
        navigate('/flash');
    };

    const handleLike = async (e, videoId) => {
        e.stopPropagation();
        if (!token) {
            showNotification('info', 'Login Required', { message: 'Please login to like videos.' });
            navigate('/login');
            return;
        }

        try {
            const result = await likeVideo(videoId, token);
            setVideos(prev => prev.map(v =>
                v.id === videoId ? { ...v, liked_by_user: result.liked, likes_count: result.likes_count } : v
            ));
        } catch (err) {
            console.error("Like error:", err);
        }
    };

    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return "Just now";
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return "Just now";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) return `${diffInDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading && videos.length === 0) {
        return <HomeSkeleton />;
    }

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
                        <Flame size={14} /> <span>PREMIUM FEATURE</span>
                    </div>
                    <h1 className="hero-title">{featured.title}</h1>
                    <p className="hero-desc">{featured.desc}</p>
                    <button
                        className="btn-active hero-btn"
                        onClick={() => navigate(`/watch/${videos[0]?.id || 1}`)}
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

            {/* Trending Long Form - Part 1 */}
            <div style={{ padding: '0 0 1rem' }}>
                <div className="video-grid">
                    {error && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--accent-primary)' }}>{error}</div>}
                    {videos.slice(0, 8).map((video, index) => (
                        <VideoPreviewCard
                            key={video.id}
                            video={video}
                            variant="grid"
                            onClick={() => handleVideoClick(video.id)}
                        />
                    ))}
                </div>
            </div>

            {/* AdSense / Banner Section for Non-Pro Users */}
            {!user?.is_premium && (
                <div style={{ padding: '0.5rem 0' }}>
                    {/* You can toggle between DashboardBannerAd and AdSenseAd here */}
                    <AdSenseAd 
                        client={import.meta.env.VITE_ADSENSE_CLIENT_ID} 
                        slot={import.meta.env.VITE_ADSENSE_SLOT_ID} 
                    />
                </div>
            )}

            {/* Flash Section (3 Rows) */}
            {flashVideos.length > 0 && (
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
                        {flashVideos.slice(0, window.innerWidth < 768 ? 6 : 18).map(flash => (
                            <div key={flash.id} className="flash-shelf-item hover-scale" onClick={handleFlashClick}>
                                <div className="flash-thumbnail-container">
                                    <img src={flash.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                    <div className="flash-overlay-info">
                                        <div className="flash-item-title">
                                            {flash.title}
                                        </div>
                                        <div className="flash-item-views">
                                            {formatViews(flash.views)} views
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trending Long Form - Part 2 (Infinite Scroll) */}
            <div style={{ padding: '1rem 0 2rem' }}>
                <div className="video-grid">
                    {videos.slice(8).map((video, index) => (
                        <React.Fragment key={video.id}>
                            <VideoPreviewCard
                                video={video}
                                variant="grid"
                                onClick={() => handleVideoClick(video.id)}
                                ref={index === videos.slice(8).length - 1 ? lastVideoElementRef : null}
                            />
                            {(index + 1) % 6 === 0 && !user?.is_premium && (
                                <AdSenseAd 
                                    client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
                                    slot={import.meta.env.VITE_ADSENSE_INFEED_SLOT_ID}
                                    layoutKey={import.meta.env.VITE_ADSENSE_INFEED_LAYOUT_KEY}
                                    format="fluid"
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Loading More State */}
            {loadingMore && (
                <div className="video-grid" style={{ marginTop: '2rem' }}>
                    {[...Array(4)].map((_, i) => (
                        <VideoSkeleton key={`more-skel-${i}`} />
                    ))}
                </div>
            )}
            {!hasMore && videos.length > 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    You've reached the end of the line!
                </div>
            )}
        </div>
    );
};

export default Home;
