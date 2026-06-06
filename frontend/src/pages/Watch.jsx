import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getVideoById, getComments, postComment, updateComment, deleteComment, likeVideo, shareVideo, getVideos, getRecommendedFeed, toggleFollow, getUserProfile, API_BASE_URL } from '../api';
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
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

const ShareModal = ({ video, onClose }) => {
    const { showNotification } = useNotification();
    const shareUrl = window.location.href;
    const shareTitle = `Watch ${video.title} on Monteeq!`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        showNotification('success', "Link copied to clipboard!");
    };

    const socialPlatforms = [
        {
            name: 'WhatsApp',
            color: '#25D366',
            url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`,
            icon: (
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.535 0 10.026-4.467 10.029-9.972.001-2.667-1.036-5.178-2.919-7.066C16.599 1.677 14.1 1.64 11.399 1.64c-5.54 0-10.03 4.469-10.033 9.975-.001 1.764.463 3.49 1.342 5.051l-.973 3.558 3.649-.957zm11.236-7.72c-.301-.15-1.782-.88-2.059-.98-.277-.101-.478-.15-.678.15-.2.3-.778.98-.954 1.18-.176.2-.352.226-.653.076-.301-.15-1.272-.469-2.422-1.494-.895-.797-1.498-1.782-1.674-2.082-.176-.3-.019-.462.132-.611.135-.134.301-.35.451-.525.15-.175.2-.3.301-.5.1-.2.05-.375-.025-.525-.075-.15-.678-1.63-.929-2.235-.245-.589-.494-.509-.678-.518-.176-.008-.377-.01-.577-.01-.2 0-.527.075-.803.374-.276.3-1.054 1.03-1.054 2.512s1.079 2.913 1.23 3.113c.15.2 2.122 3.24 5.14 4.545.717.31 1.277.495 1.712.633.72.229 1.375.197 1.892.12.576-.086 1.783-.728 2.034-1.431.25-.702.25-1.303.176-1.431-.075-.128-.276-.203-.577-.354z"/>
                </svg>
            )
        },
        {
            name: 'X (Twitter)',
            color: '#fff',
            url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
            icon: (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
            )
        },
        {
            name: 'Facebook',
            color: '#1877F2',
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
            icon: (
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
            )
        },
        {
            name: 'Telegram',
            color: '#0088cc',
            url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
            icon: (
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.98 4.582-1.385 6.75l-.013.072c-.115.58-.33 1.05-.623 1.05-.285 0-.498-.24-.876-.492l-2.137-1.428-1.077-.732-.23-.15c-.244-.162-.486-.324-.728-.485l-.57-.384c-.453-.3-.9-.606-1.353-.907l-.023-.016-.075-.052c-.645-.443-.604-.848-.075-1.228 1.02-.733 2.92-2.128 3.825-2.775l.135-.1-.01-.015c-.075.053-.165.112-.266.18l-3.21 2.16-1.41-.952-.075-.052c-.52-.35-.855-.576-.855-.838s.453-.615 1.357-.96l7.868-3.02c.866-.333 1.32.062 1.25.962l-.008.045z"/>
                </svg>
            )
        },
        {
            name: 'Reddit',
            color: '#FF4500',
            url: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
            icon: (
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.41-4.53 3.84.9c.08 1.07.97 1.91 2.05 1.91 1.15 0 2.09-.94 2.09-2.09S20.74 2 19.59 2c-.89 0-1.66.57-1.95 1.36l-4.14-.97c-.19-.04-.39.05-.47.23L11.53 7.03c-2.51.05-4.8.7-6.47 1.71C4.5 7.98 3.6 7.5 2.62 7.5c-1.65 0-3 1.35-3 3 0 1 .5 1.9 1.28 2.46C.3 14 .03 14.5.03 15c0 3.86 4.7 7 10.5 7s10.5-3.14 10.5-7c0-.5-.27-1-.87-1.54.78-.56 1.28-1.46 1.28-2.46zM7 13.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .83-.67 1.5-1.5 1.5S7 14.33 7 13.5zm11.23 4.23c-1.07 1.07-3.08 1.16-3.73 1.16-.65 0-2.66-.09-3.73-1.16-.15-.15-.15-.39 0-.54.15-.15.39-.15.54 0 .86.86 2.58.96 3.19.96.61 0 2.33-.1 3.19-.96.15-.15.39-.15.54 0 .15.15.15.39 0 .54zM15.5 15c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5c0 .83-.67 1.5-1.5 1.5z"/>
                </svg>
            )
        }
    ];

    return (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <div className="modal-content glass" style={{ background: '#111', padding: '2.5rem 2rem 2rem 2rem', borderRadius: '2rem', width: '90%', maxWidth: '460px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#666'}><X size={24} /></button>
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Share this video</h2>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>Choose a platform to share this content</p>
                </div>
                
                {/* Social grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.8rem', marginBottom: '2rem' }}>
                    {socialPlatforms.map(platform => (
                        <a
                            key={platform.name}
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: '#aaa',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = '#aaa';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: platform.color,
                                border: '1px solid rgba(255,255,255,0.05)',
                                transition: 'all 0.2s ease'
                            }}>
                                {platform.icon}
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{platform.name}</span>
                        </a>
                    ))}
                </div>

                {/* Input section with Copy Button */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '1.2rem',
                    padding: '0.4rem 0.4rem 0.4rem 1.2rem',
                    gap: '0.5rem'
                }}>
                    <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            color: '#ccc',
                            fontSize: '0.85rem',
                            outline: 'none',
                            textOverflow: 'ellipsis'
                        }}
                        onClick={e => e.target.select()}
                    />
                    <button
                        onClick={handleCopyLink}
                        style={{
                            background: '#ff3b30',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '0.9rem',
                            padding: '0.6rem 1.4rem',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(255, 59, 48, 0.2)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#e02d25';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 59, 48, 0.3)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = '#ff3b30';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 59, 48, 0.2)';
                        }}
                    >
                        Copy
                    </button>
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
    const prefetchedNextIdRef = useRef(null);
    const [newComment, setNewComment] = useState("");
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isCinematic, setIsCinematic] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [suggestedVideos, setSuggestedVideos] = useState([]);
    // Full unfiltered list used only for prev/next navigation index lookup
    const [navQueue, setNavQueue] = useState([]);
    // Whether we're doing a background refresh (prev/next nav) vs a cold load
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Find the current video inside the full nav queue (includes current video)
    const currentIndex = navQueue.findIndex(v => v.id.toString() === id.toString());
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
        const queueMatch = navQueue.find(v => v.id.toString() === id.toString());
        if (queueMatch && video !== null) {
            // Optimistic: show queue data instantly, no skeleton
            setVideo(queueMatch);
            setComments([]);
            setIsRefreshing(true);

            // Optimistically set the follow state from cached owner metadata
            if (queueMatch.owner) {
                setIsFollowing(queueMatch.owner.is_following ?? false);
                setFollowersCount(queueMatch.owner.followers_count ?? 0);
            }

            const refresh = async () => {
                try {
                    const [videoData, commentsData] = await Promise.all([
                        getVideoById(id, token),
                        getComments(id)
                    ]);
                    if (cancelled) return;
                    setVideo(videoData);
                    setComments(commentsData);

                    // Fetch creator's real profile stats to set real followers count & follow status
                    if (videoData.owner) {
                        try {
                            const profileData = await getUserProfile(videoData.owner.username, token);
                            if (!cancelled) {
                                setIsFollowing(profileData.is_following ?? false);
                                setFollowersCount(profileData.followers_count ?? 0);
                            }
                        } catch (err) {
                            console.error("Failed to refresh creator profile", err);
                        }
                    }

                    // Fetch fresh recommendations to refresh the sidebar and extend the queue
                    const videoType = videoData.video_type || 'home';
                    try {
                        const results = await getRecommendedFeed(videoType, token, 16);
                        if (cancelled) return;
                        if (Array.isArray(results) && results.length > 0) {
                            setNavQueue(prev => {
                                const curIdx = prev.findIndex(item => item.id.toString() === id.toString());
                                const history = curIdx >= 0 ? prev.slice(0, curIdx + 1) : [];
                                const newItems = results.filter(r => !history.some(h => h.id === r.id));
                                return [...history, ...newItems];
                            });
                            setSuggestedVideos(results.filter(v => v.id.toString() !== id.toString()));
                        }
                    } catch (_) {}
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
        setLoading(true);
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
                // Fetch creator's real profile stats to set real followers count & follow status
                if (videoData.owner) {
                    try {
                        const profileData = await getUserProfile(videoData.owner.username, token);
                        if (!cancelled) {
                            setIsFollowing(profileData.is_following ?? false);
                            setFollowersCount(profileData.followers_count ?? 0);
                        }
                    } catch (err) {
                        console.error("Failed to fetch creator profile info", err);
                        setIsFollowing(false);
                        setFollowersCount(0);
                    }
                } else {
                    setIsFollowing(false);
                    setFollowersCount(0);
                }

                // Fetch suggestions after main content renders
                const videoType = videoData.video_type || 'home';
                try {
                    const results = await getRecommendedFeed(videoType, token, 16);
                    if (cancelled) return;
                    if (Array.isArray(results) && results.length > 0) {
                        setNavQueue(results);                                          // full list for prev/next
                        setSuggestedVideos(results.filter(v => v.id.toString() !== id.toString())); // filtered for sidebar
                        return;
                    }
                } catch (_) { /* fall through to getVideos */ }

                // Fallback: plain video list
                try {
                    const fallback = await getVideos(videoType, token, 0, 16);
                    if (!cancelled) {
                        const list = fallback || [];
                        setNavQueue(list);                                          // full list for prev/next
                        setSuggestedVideos(list.filter(v => v.id.toString() !== id.toString())); // filtered for sidebar
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

    // Reset prefetch ref when video id changes
    useEffect(() => {
        prefetchedNextIdRef.current = null;
    }, [id]);

    useEffect(() => {
        if (!hasNext || !navQueue[currentIndex + 1]) return;
        const nextVideo = navQueue[currentIndex + 1];
        if (prefetchedNextIdRef.current === nextVideo.id) return; // already prefetched

        // Only prefetch when current video is > 70% done
        const videoEl = document.querySelector('video');
        if (!videoEl) return;

        const checkProgress = () => {
            if (videoEl.duration > 0 && videoEl.currentTime / videoEl.duration > 0.7) {
                prefetchedNextIdRef.current = nextVideo.id;
                // Silently fetch the next video's HLS manifest so the CDN/proxy warms up
                const nextStreamUrl = `${API_BASE_URL}/videos/${nextVideo.id}/stream/master.m3u8${token ? `?token=${token}` : ''}`;
                fetch(nextStreamUrl, {
                    method: 'GET',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                }).catch(() => {}); // fire and forget
            }
        };

        videoEl.addEventListener('timeupdate', checkProgress);
        return () => videoEl.removeEventListener('timeupdate', checkProgress);
    }, [hasNext, currentIndex, navQueue, token]);

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
        const wasFollowing = isFollowing;
        // Optimistic toggle
        setIsFollowing(!wasFollowing);
        setFollowersCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);
        try {
            const res = await toggleFollow(video.owner?.id, token);
            setIsFollowing(res.is_following);
            // Sync count with backend result
            if (res.is_following !== !wasFollowing) {
                setFollowersCount(c => res.is_following ? c + 1 : Math.max(0, c - 1));
            }
        } catch (err) {
            // Revert on failure
            setIsFollowing(wasFollowing);
            setFollowersCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
            showNotification('error', 'Failed to update follow status');
        } finally {
            setFollowLoading(false);
        }
    };

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
        <div className={`watchContainer ${isCinematic ? 'cinematic' : ''} ${isTheaterMode ? 'theaterMode' : ''}`}>
            <SEO 
                title={video.title}
                description={video.description || `Watch ${video.title} on Monteeq. The best video edits and creative content.`}
                video={video}
                ogImage={video.thumbnail_url}
            />
            <div className="dimOverlay" onClick={() => setIsCinematic(false)} />

            {/* Slim bar shown while background-refreshing data after prev/next nav */}
            {isRefreshing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, #ff3b30, #ff6b6b)',
                    zIndex: 9999,
                    animation: 'refreshBar 1.2s ease-in-out infinite'
                }} />
            )}

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

            <div className="mainColumn">

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
                    <button className="actionBtn" onClick={() => setShowShareModal(true)}>
                        <Share2 size={20} /> Share
                    </button>
                    <button className="actionBtn" onClick={() => setShowDownloadModal(true)}>
                        <Download size={20} /> Download
                    </button>
                </div>

                {renderCreatorCard(true)}

                <div style={{ marginTop: '3rem' }}>
                    <div className="descriptionBox">
                        <div className="videoMeta" style={{ marginBottom: '0.5rem', color: '#fff' }}>
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
                        <h3 className="commentsHeading" style={{ marginBottom: '2rem' }}>Comments ({comments.length})</h3>
                        <form onSubmit={handleCommentSubmit} className="commentForm">
                            <div className="avatar"></div>
                            <div className="inputRow">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                />
                                <button type="submit" disabled={!newComment.trim()}>
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
            {showShareModal && (
                <ShareModal video={video} onClose={() => setShowShareModal(false)} />
            )}
        </div>
    );
};

export default Watch;