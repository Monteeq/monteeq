import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getVideoById, getComments, postComment, updateComment, deleteComment, likeVideo, shareVideo, getVideos, getRecommendedFeed, toggleFollow } from '../api';
import VideoPreviewCard from '../components/VideoPreviewCard';
import { Heart, Share2, Send, Download, X, Crown, Lightbulb, LightbulbOff, UserPlus, UserCheck, Users } from 'lucide-react';
import VideoPlayerV2 from '../components/VideoPlayerV2';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import CommentItem from '../components/CommentItem';
import { WatchSkeleton } from '../components/Skeleton';

import SEO from '../components/SEO';
import AdSenseAd from '../components/ads/AdSenseAd';
import './WatchV2.css';

const DownloadModal = ({ video, onClose, user }) => {
    const { showNotification } = useNotification();
    const resolutions = [
        { label: '4K', value: '4k', src: video.url_4k, premium: true },
        { label: '2K', value: '2k', src: video.url_2k, premium: true },
        { label: '1080p', value: '1080p', src: video.url_1080p, premium: true },
        { label: '720p', value: '720p', src: video.url_720p, premium: false },
        { label: '480p', value: '480p', src: video.url_480p, premium: false },
    ].filter(r => r.src);

    if (resolutions.length === 0 && video.video_url) {
        resolutions.push({ label: 'Original', value: 'original', src: video.video_url, premium: false });
    }

    const handleDownload = (res) => {
        if (res.premium && !user?.is_premium) {
            showNotification('info', 'Premium Required', { message: `Downloading ${res.label} requires a Premium subscription.` });
            return;
        }
        const link = document.createElement('a');
        link.href = res.src;
        link.download = `${video.title}_${res.label}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <div className="modal-content glass" style={{ background: '#111', padding: '2rem', borderRadius: '2rem', width: '90%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Download Quality</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={24} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {resolutions.map(res => (
                        <button key={res.value} onClick={() => handleDownload(res)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', borderRadius: '1.2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}>
                            <span style={{ fontWeight: 700 }}>{res.label}</span>
                            {res.premium && !user?.is_premium ? <Crown size={18} color="#ffd700" /> : <Download size={18} color="#ff3b30" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Watch = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token, user } = useAuth();
    const { showNotification } = useNotification();
    const [video, setVideo] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isCinematic, setIsCinematic] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [suggestedVideos, setSuggestedVideos] = useState([]);
    // Full unfiltered list used only for prev/next navigation index lookup
    const [navQueue, setNavQueue] = useState([]);
    // Whether we're doing a background refresh (prev/next nav) vs a cold load
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Find the current video inside the full nav queue (includes current video)
    const currentIndex = navQueue.findIndex(v => v.id === parseInt(id));
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < navQueue.length - 1;

    const goToPrevious = () => {
        if (hasPrevious) navigate(`/watch/${navQueue[currentIndex - 1].id}`);
    };
    const goToNext = () => {
        if (hasNext) navigate(`/watch/${navQueue[currentIndex + 1].id}`);
    };

    useEffect(() => {
        let cancelled = false;

        // If we already have the target video in the navQueue, render it
        // immediately (optimistic) and only background-refresh the detail data.
        const queueMatch = navQueue.find(v => v.id === parseInt(id));
        if (queueMatch && video !== null) {
            // Optimistic: show queue data instantly, no skeleton
            setVideo(queueMatch);
            setComments([]);
            setIsRefreshing(true);

            const refresh = async () => {
                try {
                    const [videoData, commentsData] = await Promise.all([
                        getVideoById(id, token),
                        getComments(id)
                    ]);
                    if (cancelled) return;
                    setVideo(videoData);
                    setComments(commentsData);
                } catch (err) {
                    console.error('Background refresh failed', err);
                } finally {
                    if (!cancelled) setIsRefreshing(false);
                }
            };
            refresh();
            return () => { cancelled = true; };
        }

        // Cold load: show skeleton and fetch everything
        setSuggestedVideos([]);
        setNavQueue([]);

        const fetchAll = async () => {
            try {
                const [videoData, commentsData] = await Promise.all([
                    getVideoById(id, token),
                    getComments(id)
                ]);
                if (cancelled) return;
                setVideo(videoData);
                setComments(commentsData);
                // Seed follow state from video owner data
                setIsFollowing(videoData.owner?.is_following ?? false);
                setFollowersCount(videoData.owner?.followers_count ?? 0);

                // Fetch suggestions after main content renders
                const videoType = videoData.video_type || 'home';
                try {
                    const results = await getRecommendedFeed(videoType, token, 16);
                    if (cancelled) return;
                    if (Array.isArray(results) && results.length > 0) {
                        setNavQueue(results);                                          // full list for prev/next
                        setSuggestedVideos(results.filter(v => v.id !== parseInt(id))); // filtered for sidebar
                        return;
                    }
                } catch (_) { /* fall through to getVideos */ }

                // Fallback: plain video list
                try {
                    const fallback = await getVideos(videoType, token, 0, 16);
                    if (!cancelled) {
                        const list = fallback || [];
                        setNavQueue(list);                                          // full list for prev/next
                        setSuggestedVideos(list.filter(v => v.id !== parseInt(id))); // filtered for sidebar
                    }
                } catch (_) { /* non-critical */ }

            } catch (err) {
                console.error('Failed to load video', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchAll();
        return () => { cancelled = true; };
    }, [id, token]);

    useEffect(() => {
        if (video?.title) {
            window.dispatchEvent(new CustomEvent('monteeq:update-title', { detail: video.title }));
        }
    }, [video?.title]);

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !token) return;
        try {
            const added = await postComment({ videoId: id, content: newComment }, token);
            setComments([added, ...comments]);
            setNewComment("");
        } catch (err) {
            showNotification('error', err?.message || "Failed to post comment");
        }
    };

    const handleLike = async () => {
        if (!token) return;
        try {
            await likeVideo(id, token);
            setVideo(prev => ({
                ...prev,
                liked_by_user: !prev.liked_by_user,
                likes_count: prev.liked_by_user ? prev.likes_count - 1 : prev.likes_count + 1
            }));
        } catch (err) { console.error(err); }
    };

    const handleFollow = async () => {
        if (!token) { showNotification('info', 'Sign in to follow creators'); return; }
        if (followLoading) return;
        setFollowLoading(true);
        // Optimistic update
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowersCount(c => wasFollowing ? c - 1 : c + 1);
        try {
            await toggleFollow(video.owner?.id, token);
        } catch (err) {
            // Revert on failure
            setIsFollowing(wasFollowing);
            setFollowersCount(c => wasFollowing ? c + 1 : c - 1);
            showNotification('error', 'Failed to update follow status');
        } finally {
            setFollowLoading(false);
        }
    };

    // Sync follow state when video changes (optimistic nav)
    useEffect(() => {
        if (video?.owner) {
            setIsFollowing(video.owner.is_following ?? false);
            setFollowersCount(video.owner.followers_count ?? 0);
        }
    }, [video?.owner?.id]);

    const renderCreatorCard = (isMobileLayout) => {
        const isSelf = user?.id === video.owner?.id;

        return (
            <div className={`creatorCard ${isMobileLayout ? 'mobileCreatorCard' : 'desktopCreatorCard'}`}>
                <div className="creatorHeader" onClick={() => navigate(`/profile/${video.owner?.username}`)} style={{ cursor: 'pointer' }}>
                    <div className="avatar">
                        {video.owner?.profile_pic ? (
                            <img src={video.owner.profile_pic} alt="" loading="lazy" />
                        ) : (
                            <div className="avatarPlaceholder">{video.owner?.username?.charAt(0).toUpperCase()}</div>
                        )}
                    </div>
                    <div className="creatorMeta">
                        <h3>@{video.owner?.username}</h3>
                        <p className="followersDisplay">
                            <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                            <span>{followersCount.toLocaleString()} followers</span>
                        </p>
                    </div>
                </div>
                {!isSelf && (
                    <button 
                        className={`followBtn ${isFollowing ? 'following' : ''}`} 
                        onClick={handleFollow}
                        disabled={followLoading}
                    >
                        {isFollowing ? (
                            <>
                                <UserCheck size={15} />
                                <span>Following</span>
                            </>
                        ) : (
                            <>
                                <UserPlus size={15} />
                                <span>Follow</span>
                            </>
                        )}
                    </button>
                )}
            </div>
        );
    };

    if (loading) return <WatchSkeleton />;
    if (!video) return <div className="page-error">Video not found</div>;

    return (
        <div className={`watchContainer ${isCinematic ? 'cinematic' : ''}`}>
            <SEO 
                title={video.title}
                description={video.description || `Watch ${video.title} on Monteeq. The best video edits and creative content.`}
                video={video}
                ogImage={video.thumbnail_url}
            />
            <div className="dimOverlay" />

            {/* Slim bar shown while background-refreshing data after prev/next nav */}
            {isRefreshing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, #ff3b30, #ff6b6b)',
                    zIndex: 9999,
                    animation: 'refreshBar 1.2s ease-in-out infinite'
                }} />
            )}

            <div className="mainColumn">
                <div className="videoSection">
                    <VideoPlayerV2
                        src={video.video_url}
                        videoId={video.id}
                        title={video.title}
                        creator={video.owner?.username}
                        poster={video.thumbnail_url}
                        autoPlay={true}
                        isTheaterMode={isTheaterMode}
                        isCinematic={isCinematic}
                        toggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
                        toggleCinematic={() => setIsCinematic(!isCinematic)}
                        onPrevious={goToPrevious}
                        onNext={goToNext}
                        hasPrevious={hasPrevious}
                        hasNext={hasNext}
                        url_480p={video.url_480p}
                        url_720p={video.url_720p}
                        url_1080p={video.url_1080p}
                        url_2k={video.url_2k}
                        url_4k={video.url_4k}
                    />
                </div>

                <div className="titleRow">
                    <h1 className="vTitle">{video.title}</h1>
                    <button
                        className="actionBtn"
                        onClick={() => setIsCinematic(!isCinematic)}
                        style={{ border: isCinematic ? '1px solid #ff3b30' : '' }}
                    >
                        {isCinematic ? <Lightbulb color="#ff3b30" size={20} /> : <LightbulbOff size={20} />}
                        {isCinematic ? 'Lights On' : 'Cinematic Mode'}
                    </button>
                </div>

                <div className="actionRow">
                    <button className={`actionBtn ${video.liked_by_user ? 'active' : ''}`} onClick={handleLike}>
                        <Heart size={20} fill={video.liked_by_user ? 'white' : 'none'} /> {video.likes_count}
                    </button>
                    <button className="actionBtn" onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        showNotification('success', "Link copied!");
                    }}>
                        <Share2 size={20} /> Share
                    </button>
                    <button className="actionBtn" onClick={() => setShowDownloadModal(true)}>
                        <Download size={20} /> Download
                    </button>
                </div>

                {renderCreatorCard(true)}

                <div style={{ marginTop: '3rem' }}>
                    <div className="descriptionBox">
                        <div style={{ fontWeight: 800, marginBottom: '0.5rem', color: '#fff' }}>
                            {video.views?.toLocaleString()} Views • {new Date(video.created_at).toLocaleDateString()}
                        </div>
                        <p>{video.description || "No description provided."}</p>
                        {video.tags && video.tags.split(',').map((tag, i) => (
                            <span key={i} className="tagline">#{tag.trim()}</span>
                        ))}
                    </div>



                    {/* Multiplex Ads for Non-Pro Users */}
                    {!user?.is_premium && (
                        <div style={{ marginTop: '2rem' }}>
                            <AdSenseAd 
                                client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
                                slot={import.meta.env.VITE_ADSENSE_MULTIPLEX_SLOT_ID}
                                format="autorelaxed"
                            />
                        </div>
                    )}

                    <div style={{ marginTop: '4rem' }}>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem' }}>Comments ({comments.length})</h3>
                        <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
                            <div className="avatar"></div>
                            <div style={{ flex: 1, display: 'flex', gap: '1rem' }}>
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem', color: '#fff', outline: 'none' }}
                                  />
                                <button type="submit" disabled={!newComment.trim()} style={{ background: '#ff3b30', border: 'none', borderRadius: '12px', padding: '0 1.5rem', cursor: 'pointer' }}>
                                    <Send size={20} color="white" />
                                </button>
                            </div>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {comments.map(c => <CommentItem key={c.id} comment={c} isApproved={true} />)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="sideColumn">
                {renderCreatorCard(false)}

                {suggestedVideos.length > 0 && (
                    <div className="suggestedSection">
                        <h4 className="suggestedTitle">Up Next</h4>
                        <div className="suggestedList">
                            {suggestedVideos.map(v => (
                                <VideoPreviewCard
                                    key={v.id}
                                    video={v}
                                    variant="list"
                                    onClick={() => navigate(`/watch/${v.id}`)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showDownloadModal && (
                <DownloadModal video={video} onClose={() => setShowDownloadModal(false)} user={user} />
            )}
        </div>
    );
};

export default Watch;