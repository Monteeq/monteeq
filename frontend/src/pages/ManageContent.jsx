import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Film, Zap, AlertTriangle, ArrowLeft, Layout, Clock, UploadCloud, Eye, Plus, Grid, List, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getUserProfile, deleteVideo, deletePost, API_BASE_URL } from '../api';
import { ManageSkeleton } from '../components/Skeleton';

const ManageContent = () => {
    const { user, token } = useAuth();
    const { showNotification, updateNotification, removeNotification } = useNotification();
    const [videos, setVideos] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'video'|'post', id: number }
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('videos');
    const [viewMode, setViewMode] = useState('grid'); // grid | list
    const navigate = useNavigate();
    
    const fileInputRef = useRef(null);
    const [reuploadTargetId, setReuploadTargetId] = useState(null);

    const handleReuploadSelection = async (e) => {
        const file = e.target.files[0];
        if (!file || !reuploadTargetId) return;
        
        const targetVideo = videos.find(v => v.id === reuploadTargetId);
        e.target.value = ''; // reset input
        
        const notificationId = showNotification('loading', `Reuploading "${targetVideo?.title}"...`, { progress: 0 });
        const currentTargetId = reuploadTargetId;
        setReuploadTargetId(null);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const xhr = new XMLHttpRequest();
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (ev) => {
                    if (ev.lengthComputable) {
                        const percent = Math.round((ev.loaded / ev.total) * 100);
                        updateNotification(notificationId, { progress: percent, status: `Uploading "${targetVideo?.title}" (${percent}%)` });
                    }
                });
                
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(JSON.parse(xhr.responseText));
                        } else {
                            const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : { detail: 'Upload failed' };
                            reject(new Error(errorData.detail || 'Upload failed'));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during reupload'));
                
                xhr.open('POST', `${API_BASE_URL}/videos/${currentTargetId}/reupload`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });
            
            const data = await uploadPromise;
            const processingKey = data.processing_key;
            
            updateNotification(notificationId, {
                type: 'processing',
                status: 'Processing video...',
                progress: 0,
                message: data.video_type === 'flash' ? 'Optimizing...' : 'Starting transcoding...'
            });
            
            setVideos(prev => prev.map(v => v.id === currentTargetId ? { ...v, status: 'pending', failed_at: null } : v));
            
            if (processingKey) {
                const pollInterval = setInterval(async () => {
                    try {
                        const statusResp = await fetch(`${API_BASE_URL}/videos/status/${encodeURIComponent(processingKey)}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const statusData = await statusResp.json();
                        
                        if (statusData) {
                            if (statusData.status === 'completed') {
                                clearInterval(pollInterval);
                                updateNotification(notificationId, {
                                    type: 'success',
                                    status: 'Reupload Complete!',
                                    message: `"${targetVideo?.title}" is now live.`,
                                    progress: 100
                                });
                                setTimeout(() => removeNotification(notificationId), 3000);
                                setVideos(prev => prev.map(v => v.id === currentTargetId ? { ...v, status: 'approved' } : v));
                            } else if (statusData.status === 'error') {
                                clearInterval(pollInterval);
                                updateNotification(notificationId, {
                                    type: 'error',
                                    status: 'Processing Failed',
                                    message: statusData.message || 'Error occurred.'
                                });
                                setVideos(prev => prev.map(v => v.id === currentTargetId ? { ...v, status: 'failed', failed_at: new Date().toISOString() } : v));
                            } else {
                                updateNotification(notificationId, {
                                    progress: statusData.progress,
                                    status: 'Processing...',
                                    message: statusData.message
                                });
                            }
                        }
                    } catch (err) {
                        console.error("Polling error:", err);
                    }
                }, 2000);
            }
        } catch (err) {
            updateNotification(notificationId, { type: 'error', status: 'Reupload Error', message: err.message });
            setVideos(prev => prev.map(v => v.id === currentTargetId ? { ...v, status: 'failed', failed_at: new Date().toISOString() } : v));
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const profile = await getUserProfile(user.username, token);

                // Process videos
                const allVideos = [
                    ...(profile.videos || []).map(v => ({ ...v, type: 'home' })),
                    ...(profile.flash_videos || []).map(v => ({ ...v, type: 'flash' }))
                ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                setVideos(allVideos);

                // Process posts
                setPosts(profile.posts || []);
            } catch (err) {
                console.error("Error fetching content:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, token]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            if (deleteTarget.type === 'video') {
                await deleteVideo(deleteTarget.id, token);
                setVideos(videos.filter(v => v.id !== deleteTarget.id));
            } else {
                await deletePost(deleteTarget.id, token);
                setPosts(posts.filter(p => p.id !== deleteTarget.id));
            }
            setDeleteTarget(null);
            showNotification('success', `${deleteTarget.type === 'video' ? 'Video' : 'Post'} deleted successfully`);
        } catch (err) {
            console.error("Error deleting content:", err);
            showNotification('error', err?.message || "Failed to delete content");
        } finally {
            setIsDeleting(false);
        }
    };

    const getTimeRemaining = (failedAt) => {
        if (!failedAt) return null;
        const failDate = new Date(failedAt);
        const expireDate = new Date(failDate.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();
        const diff = expireDate - now;

        if (diff <= 0) return "Expired";

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m left`;
    };

    if (loading) return <ManageSkeleton />;

    // Calculate stats
    const totalViews = videos.reduce((acc, curr) => acc + (curr.views || 0), 0);
    const videoCount = videos.length;
    const postCount = posts.length;

    return (
        <div className="manage-content-page page-container" style={{ padding: '2rem 1rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' }}>
            <div className="manage-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            <span>Studio</span>
                            <span>/</span>
                            <span style={{ color: 'var(--accent-primary)' }}>Content Manager</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #fff 0%, var(--text-muted) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Creator Hub
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        className="hero-btn"
                        style={{ 
                            padding: '0.8rem 1.5rem', 
                            borderRadius: '14px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            fontWeight: 700
                        }}
                        onClick={() => activeTab === 'videos' ? navigate('/upload') : navigate('/posts')}
                    >
                        <Plus size={18} />
                        {activeTab === 'videos' ? 'Upload Video' : 'Create Post'}
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1.25rem', 
                marginBottom: '2.5rem' 
            }}>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--accent-primary)', opacity: 0.15 }}>
                        <Film size={48} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Videos</span>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', color: '#fff' }}>{videoCount}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        <span>Flash & Long-form uploads</span>
                    </div>
                </div>

                <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--accent-primary)', opacity: 0.15 }}>
                        <Layout size={48} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Community Posts</span>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', color: '#fff' }}>{postCount}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        <span>Text & Image content</span>
                    </div>
                </div>

                <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--accent-primary)', opacity: 0.15 }}>
                        <TrendingUp size={48} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cumulative Views</span>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(255, 59, 48, 0.2)' }}>
                        {totalViews.toLocaleString()}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        <span>Across all published media</span>
                    </div>
                </div>
            </div>

            {/* Controls Bar (Tabs & Filters) */}
            <div className="glass" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0.75rem 1rem', 
                borderRadius: '20px', 
                marginBottom: '2rem', 
                flexWrap: 'wrap',
                gap: '1rem',
                border: '1px solid var(--border-glass)'
            }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '14px' }}>
                    <button
                        onClick={() => setActiveTab('videos')}
                        style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activeTab === 'videos' ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: activeTab === 'videos' ? '#fff' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Film size={16} />
                        Videos
                        <span style={{ 
                            fontSize: '0.75rem', 
                            background: activeTab === 'videos' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                            color: '#fff', 
                            padding: '1px 6px', 
                            borderRadius: '6px',
                            marginLeft: '4px'
                        }}>{videoCount}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('posts')}
                        style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activeTab === 'posts' ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: activeTab === 'posts' ? '#fff' : 'var(--text-muted)',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Layout size={16} />
                        Posts
                        <span style={{ 
                            fontSize: '0.75rem', 
                            background: activeTab === 'posts' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                            color: '#fff', 
                            padding: '1px 6px', 
                            borderRadius: '6px',
                            marginLeft: '4px'
                        }}>{postCount}</span>
                    </button>
                </div>

                {/* View Switchers (Grid/List) - Only for videos */}
                {activeTab === 'videos' && (
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
                        <button 
                            onClick={() => setViewMode('grid')}
                            style={{
                                background: viewMode === 'grid' ? 'rgba(255,255,255,0.08)' : 'transparent',
                                border: 'none',
                                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                                padding: '6px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Grid view"
                        >
                            <Grid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            style={{
                                background: viewMode === 'list' ? 'rgba(255,255,255,0.08)' : 'transparent',
                                border: 'none',
                                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                                padding: '6px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="List view"
                        >
                            <List size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content List Area */}
            <div className="content-container">
                {activeTab === 'videos' ? (
                    videos.length === 0 ? (
                        <div className="glass" style={{ padding: '6rem 2rem', textAlign: 'center', borderRadius: '32px', border: '1px solid var(--border-glass)' }}>
                            <div style={{ 
                                width: '80px', 
                                height: '80px', 
                                background: 'rgba(255, 59, 48, 0.05)', 
                                border: '1px solid var(--border-glass)', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: 'var(--accent-primary)'
                            }}>
                                <Film size={36} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>No videos found</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', marginInline: 'auto' }}>
                                Get started by uploading your first long-form video or short flash clip to share with the community.
                            </p>
                            <button className="hero-btn" style={{ marginInline: 'auto', padding: '0.8rem 2rem', borderRadius: '12px' }} onClick={() => navigate('/upload')}>
                                Upload Your First Video
                            </button>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* VIDEOS GRID VIEW */
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '1.5rem' 
                        }}>
                            {videos.map(video => (
                                <div key={video.id} className="management-card glass hover-scale"
                                    style={{
                                        borderRadius: '20px',
                                        overflow: 'hidden',
                                        border: video.status === 'failed' ? '1px solid rgba(255, 62, 62, 0.3)' : '1px solid var(--border-glass)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'all 0.3s ease',
                                        background: 'rgba(10,10,10,0.4)',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                >
                                    {/* Thumbnail container */}
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#000' }}>
                                        <img 
                                            src={video.thumbnail_url} 
                                            alt={video.title} 
                                            style={{ 
                                                width: '100%', 
                                                height: '100%', 
                                                objectFit: 'cover', 
                                                opacity: video.status === 'failed' ? 0.4 : 0.9,
                                                transition: 'opacity 0.3s ease'
                                            }} 
                                        />
                                        
                                        {/* Status Badge overlay */}
                                        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '0.5rem' }}>
                                            {video.status === 'failed' && (
                                                <span style={{ background: '#ff3b30', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <AlertTriangle size={10} /> FAILED
                                                </span>
                                            )}
                                            {video.status === 'pending' && (
                                                <span className="pulse-soft" style={{ background: '#f59e0b', color: '#000', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                                                    PROCESSING
                                                </span>
                                            )}
                                            {video.status === 'approved' && (
                                                <span style={{ background: '#34c759', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                                                    LIVE
                                                </span>
                                            )}
                                        </div>

                                        {/* Duration Overlay */}
                                        <div style={{
                                            position: 'absolute', bottom: '8px', right: '8px',
                                            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            {video.type === 'flash' ? <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-primary)' }}><Zap size={10} fill="currentColor" /> Flash</span> : video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'HD'}
                                        </div>
                                    </div>

                                    {/* Card Info */}
                                    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div style={{ marginBottom: '1.25rem' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }} title={video.title}>
                                                {video.title}
                                            </h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Eye size={12} /> {video.views.toLocaleString()}</span>
                                                <span>•</span>
                                                <span style={{ textTransform: 'capitalize' }}>{video.video_type} Feed</span>
                                            </div>
                                        </div>

                                        {/* Action buttons footer */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                {video.status === 'failed' && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <span style={{ color: '#ff3b30', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Clock size={10} /> {getTimeRemaining(video.failed_at)}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setReuploadTargetId(video.id);
                                                                setTimeout(() => {
                                                                    if (fileInputRef.current) fileInputRef.current.click();
                                                                }, 50);
                                                            }}
                                                            style={{
                                                                background: 'rgba(59, 130, 246, 0.1)',
                                                                color: '#3b82f6',
                                                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                                                padding: '0.5rem',
                                                                borderRadius: '10px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px',
                                                                fontWeight: 700,
                                                                fontSize: '0.75rem',
                                                                width: '100%',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = '#3b82f6'; }}
                                                        >
                                                            <UploadCloud size={14} /> Reupload
                                                        </button>
                                                    </div>
                                                )}
                                                {video.status !== 'failed' && (
                                                    <button
                                                        onClick={() => navigate(`/watch/${video.id}`)}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.04)',
                                                            color: '#fff',
                                                            border: '1px solid var(--border-glass)',
                                                            padding: '0.5rem',
                                                            borderRadius: '10px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 700,
                                                            fontSize: '0.75rem',
                                                            width: '100%',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                    >
                                                        Watch video
                                                    </button>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => setDeleteTarget({ type: 'video', id: video.id })}
                                                style={{
                                                    background: 'rgba(255, 59, 48, 0.08)',
                                                    color: 'var(--accent-primary)',
                                                    border: '1px solid rgba(255, 59, 48, 0.15)',
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease',
                                                    flexShrink: 0
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 59, 48, 0.08)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                                                title="Delete video"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* VIDEOS LIST VIEW */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Table Header for desktop */}
                            <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1.2fr', padding: '0.75rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <span>Preview</span>
                                <span>Title & Metadata</span>
                                <span>Views</span>
                                <span>Status</span>
                                <span style={{ textAlign: 'right' }}>Actions</span>
                            </div>

                            {videos.map(video => (
                                <div key={video.id} className="management-card glass hover-scale"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'window.innerWidth < 768 ? "1fr" : "1.2fr 2fr 1fr 1fr 1.2fr"',
                                        alignItems: 'center',
                                        padding: '1rem 1.5rem',
                                        borderRadius: '16px',
                                        border: video.status === 'failed' ? '1px solid rgba(255, 62, 62, 0.3)' : '1px solid var(--border-glass)',
                                        background: 'rgba(10,10,10,0.3)',
                                        gap: '1rem'
                                    }}
                                >
                                    {/* Column 1: Thumbnail */}
                                    <div style={{ width: '120px', height: '68px', borderRadius: '10px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                        <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: video.status === 'failed' ? 0.5 : 1 }} />
                                        <div style={{
                                            position: 'absolute', bottom: '4px', right: '4px',
                                            background: 'rgba(0,0,0,0.85)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600
                                        }}>
                                            {video.type === 'flash' ? <Zap size={10} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} /> : video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'HD'}
                                        </div>
                                    </div>

                                    {/* Column 2: Info */}
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem', color: '#fff' }}>{video.title}</h3>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{ textTransform: 'capitalize' }}>{video.video_type} Feed</span>
                                            <span>•</span>
                                            <span>Uploaded {new Date(video.created_at || Date.now()).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Column 3: Views */}
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                        {video.views.toLocaleString()} views
                                    </div>

                                    {/* Column 4: Status */}
                                    <div>
                                        {video.status === 'failed' && (
                                            <span style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255, 59, 48, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                <AlertTriangle size={10} /> Failed
                                            </span>
                                        )}
                                        {video.status === 'pending' && (
                                            <span className="pulse-soft" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                                Processing
                                            </span>
                                        )}
                                        {video.status === 'approved' && (
                                            <span style={{ background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                                                Live
                                            </span>
                                        )}
                                    </div>

                                    {/* Column 5: Actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        {video.status === 'failed' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                                <span style={{ color: '#ff3b30', fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px' }}>
                                                    <Clock size={10} /> {getTimeRemaining(video.failed_at)}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setReuploadTargetId(video.id);
                                                        setTimeout(() => {
                                                            if (fileInputRef.current) fileInputRef.current.click();
                                                        }, 50);
                                                    }}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)',
                                                        padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = '#3b82f6'; }}
                                                >
                                                    <UploadCloud size={14} /> Reupload
                                                </button>
                                            </div>
                                        )}
                                        
                                        {video.status !== 'failed' && (
                                            <button
                                                onClick={() => navigate(`/watch/${video.id}`)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid var(--border-glass)',
                                                    padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                                                    fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                            >
                                                Watch
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setDeleteTarget({ type: 'video', id: video.id })}
                                            style={{
                                                background: 'rgba(255, 59, 48, 0.08)', color: 'var(--accent-primary)', border: '1px solid rgba(255, 59, 48, 0.15)',
                                                width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 59, 48, 0.08)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* POSTS VIEW */
                    posts.length === 0 ? (
                        <div className="glass" style={{ padding: '6rem 2rem', textAlign: 'center', borderRadius: '32px', border: '1px solid var(--border-glass)' }}>
                            <div style={{ 
                                width: '80px', 
                                height: '80px', 
                                background: 'rgba(255, 59, 48, 0.05)', 
                                border: '1px solid var(--border-glass)', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: 'var(--accent-primary)'
                            }}>
                                <Layout size={36} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>No posts found</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px', marginInline: 'auto' }}>
                                Publish updates, photos, or quick text announcements to keep your followers engaged.
                            </p>
                            <button className="hero-btn" style={{ marginInline: 'auto', padding: '0.8rem 2rem', borderRadius: '12px' }} onClick={() => navigate('/posts')}>
                                View Feed & Create Post
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {posts.map(post => (
                                <div key={post.id} className="management-card glass hover-scale"
                                    style={{
                                        padding: '1.5rem',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-glass)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        background: 'rgba(10,10,10,0.3)',
                                        gap: '1.25rem'
                                    }}
                                >
                                    <div>
                                        {post.image_url && (
                                            <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', background: '#000' }}>
                                                <img src={post.image_url} alt="Post Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-secondary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {post.content}
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                                            <Calendar size={12} />
                                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <button
                                            onClick={() => setDeleteTarget({ type: 'post', id: post.id })}
                                            style={{
                                                background: 'rgba(255, 59, 48, 0.08)', color: 'var(--accent-primary)', border: '1px solid rgba(255, 59, 48, 0.15)',
                                                width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 59, 48, 0.08)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Delete Modal */}
            {deleteTarget && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="glass" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '24px', textAlign: 'center' }}>
                        <div style={{ width: '60px', height: '60px', background: 'rgba(255, 62, 62, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ff3e3e' }}>
                            <AlertTriangle size={30} />
                        </div>
                        <h2 style={{ marginBottom: '1rem' }}>Delete {deleteTarget.type === 'video' ? 'Video' : 'Post'}?</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                            This action cannot be undone. This {deleteTarget.type} will be permanently removed from Monteeq.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="glass" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', cursor: 'pointer' }} onClick={() => setDeleteTarget(null)}>Cancel</button>
                            <button
                                className="hero-btn"
                                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', background: '#ff3e3e', boxShadow: '0 8px 20px rgba(255, 62, 62, 0.3)' }}
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Hidden Input for Reupload */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="video/*"
                onChange={handleReuploadSelection}
            />
        </div>
    );
};

export default ManageContent;
