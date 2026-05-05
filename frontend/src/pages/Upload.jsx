import React, { useState, useEffect, useRef } from 'react';
import { Upload as UploadIcon, Video, Layout, CheckCircle, FileVideo, Plus, X, ArrowRight, Gauge } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, getUserInsights } from '../api';

import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import DashboardBannerAd from '../components/ads/DashboardBannerAd';
import AdSenseAd from '../components/ads/AdSenseAd';
import { Play, SkipForward, ShieldCheck } from 'lucide-react';

const Upload = () => {
    const { user, token, refreshUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Ad Gate State
    const [isAdGateActive, setIsAdGateActive] = useState(false);
    const [adTimeLeft, setAdTimeLeft] = useState(15);
    const [isAdFinished, setIsAdFinished] = useState(false);

    useEffect(() => {
        if (!isAdGateActive) return;

        const timer = setInterval(() => {
            setAdTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsAdFinished(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isAdGateActive]);

    useEffect(() => {
        if (token) refreshUser();
    }, []);

    const [quotas, setQuotas] = useState({
        flash: { used: 0, total: 50, icon: <FileVideo size={24} />, color: 'hsl(345, 100%, 55%)' },
        home: { used: 0, total: 20, icon: <Video size={24} />, color: 'hsl(210, 100%, 55%)' },
        posts: { used: 0, total: Infinity, icon: <Layout size={24} />, color: 'hsl(280, 100%, 65%)' }
    });

    useEffect(() => {
        if (user) {
            setQuotas(prev => ({
                ...prev,
                flash: {
                    ...prev.flash,
                    used: user.flash_uploads || 0,
                    total: user.flash_quota_limit || 50,
                },
                home: {
                    ...prev.home,
                    used: user.home_uploads || 0,
                    total: user.home_quota_limit || 20,
                }
            }));
        }
    }, [user]);

    useEffect(() => {
        const fetchInsights = async () => {
            if (token) {
                try {
                    const data = await getUserInsights(token);
                    setQuotas(prev => ({
                        ...prev,
                        posts: { ...prev.posts, used: data.posts_count || 0 }
                    }));
                } catch (err) {
                    console.error("Failed to fetch user insights:", err);
                }
            }
        };
        fetchInsights();
    }, [token]);

    const [showModal, setShowModal] = useState(false);
    const [currentType, setCurrentType] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [file, setFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (location.state?.title) {
            setTitle(location.state.title);
        }
        if (location.state?.type) {
            setCurrentType(location.state.type);
            setShowModal(true);
        }
    }, [location.state]);

    const { showNotification, updateNotification, removeNotification } = useNotification();

    const handleUpload = async () => {
        const isPost = currentType === 'posts';
        if ((!isPost && !file) || !title) {
            showNotification('error', isPost ? "Please provide post content." : "Please select a file and provide a title.");
            return;
        }

        // Ad Gate Check for Free Users
        if (!user?.is_premium && !isAdFinished) {
            setShowModal(false);
            setIsAdGateActive(true);
            return;
        }

        // Reset for next potential upload
        if (isAdFinished) {
            setIsAdFinished(false);
            setAdTimeLeft(15);
        }

        setShowModal(false);
        const notificationId = showNotification('loading', `Uploading "${title}"...`, { progress: 0 });

        try {
            const formData = new FormData();

            if (currentType === 'posts') {
                formData.append('content', title);
                if (tags) formData.append('tags', tags);
                if (file) {
                    formData.append('image', file);
                }
            } else {
                formData.append('title', title);
                formData.append('description', description);
                if (tags) formData.append('tags', tags);
                formData.append('video_type', currentType);
                formData.append('file', file);
                if (thumbnailFile) {
                    formData.append('thumbnail', thumbnailFile);
                }
            }

            const xhr = new XMLHttpRequest();
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        updateNotification(notificationId, { progress: percent, status: `Uploading "${title}"` });
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
                xhr.onerror = () => reject(new Error('Network error during upload'));

                const endpoint = currentType === 'posts' ? `${API_BASE_URL}/posts/create` : `${API_BASE_URL}/videos/upload`;
                xhr.open('POST', endpoint);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });

            const data = await uploadPromise;

            if (currentType === 'posts') {
                updateNotification(notificationId, {
                    type: 'success',
                    status: 'Post Published!',
                    message: 'Your post is now live in the community feed.',
                    progress: 100
                });
                setTimeout(() => removeNotification(notificationId), 3000);
                setTitle('');
                setTags('');
                setFile(null);
                return;
            }

            updateNotification(notificationId, {
                type: 'processing',
                status: 'Processing video...',
                progress: 0,
                message: currentType === 'flash' ? 'Optimizing instantly...' : 'Starting transcoding...'
            });

            const processingKey = data.processing_key;

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
                                    status: 'Upload Complete!',
                                    message: `"${title}" is now live.`,
                                    progress: 100
                                });
                                setTimeout(() => removeNotification(notificationId), 3000);

                                setQuotas(prev => ({
                                    ...prev,
                                    [currentType]: { ...prev[currentType], used: prev[currentType].used + 1 }
                                }));
                                setTitle('');
                                setFile(null);
                                setThumbnailFile(null);
                            } else if (statusData.status === 'error') {
                                clearInterval(pollInterval);
                                updateNotification(notificationId, {
                                    type: 'error',
                                    status: 'Processing Failed',
                                    message: statusData.message || 'Error occurred during processing.'
                                });
                            } else {
                                updateNotification(notificationId, {
                                    progress: statusData.progress,
                                    status: 'Optimizing Video',
                                    message: statusData.message
                                });
                            }
                        }
                    } catch (err) {
                        console.error("Polling error:", err);
                    }
                }, 2000);
            } else {
                updateNotification(notificationId, { type: 'success', status: 'Upload successful!' });
            }

        } catch (error) {
            updateNotification(notificationId, { type: 'error', status: 'Upload Error', message: error.message });
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('video/')) {
            setFile(droppedFile);
        }
    };

    return (
        <div className="upload-page" style={{
            minHeight: '100vh',
            padding: '2rem 1rem 8rem',
            background: 'radial-gradient(circle at top right, rgba(255, 62, 62, 0.05) 0%, transparent 40%)'
        }}>
            {/* Rewarded Ad Gate */}
            {isAdGateActive && !user?.is_premium && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: '#050505',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div className="glass" style={{
                        width: '100%',
                        maxWidth: '800px',
                        padding: '3rem',
                        borderRadius: '40px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.05)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, height: '4px',
                            background: 'rgba(255,255,255,0.1)'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${(adTimeLeft / 15) * 100}%`,
                                background: 'var(--accent-primary)',
                                transition: 'width 1s linear'
                            }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center', marginBottom: '2rem' }}>
                            <div className="pulse-slow" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '3px' }}>REWARDED AD ACTIVE</span>
                        </div>

                        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '1rem' }}>Support Monteeq</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.1rem' }}>
                            Watch this brief ad to unlock the **Editor Studio** for free.
                        </p>

                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '24px',
                            padding: '1rem',
                            marginBottom: '3rem',
                            minHeight: '280px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AdSenseAd
                                client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
                                slot={import.meta.env.VITE_ADSENSE_SLOT_ID}
                                style={{ minHeight: '250px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                            {adTimeLeft > 0 ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    color: 'white'
                                }}>
                                    <div className="glass" style={{ width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        {adTimeLeft}
                                    </div>
                                    <span>seconds until unlock</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setIsAdGateActive(false);
                                        handleUpload();
                                    }}
                                    className="btn-active"
                                    style={{
                                        padding: '1.5rem 4rem',
                                        borderRadius: '20px',
                                        background: 'white',
                                        color: 'black',
                                        border: 'none',
                                        fontWeight: 900,
                                        fontSize: '1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 0 40px rgba(255,255,255,0.2)'
                                    }}
                                >
                                    CONTINUE TO UPLOAD <SkipForward fill="black" />
                                </button>
                            )}

                            <button
                                onClick={() => navigate('/pro')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <ShieldCheck size={16} /> Remove ads permanently with Pro
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="page-header" style={{ maxWidth: '1200px', margin: '0 auto 4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px var(--accent-glow)'
                    }}>
                        <UploadIcon color="white" size={20} />
                    </div>
                    <span style={{ fontWeight: 800, letterSpacing: '2px', color: 'var(--accent-primary)', fontSize: '0.9rem' }}>EDITOR STUDIO</span>
                </div>
                <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1, marginBottom: '1rem' }}>
                    Publish <span style={{
                        background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.4))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>Your Vision</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px' }}>
                    Upload, track, and manage your content with premium tools designed for editors.
                </p>
            </div>

            <div className="quota-grid" style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '2rem'
            }}>
                {Object.entries(quotas).map(([type, data]) => (
                    <div key={type} className="glass hover-scale" style={{
                        padding: '2.5rem',
                        borderRadius: '32px',
                        border: '1px solid var(--border-glass)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-20px',
                            right: '-20px',
                            width: '100px',
                            height: '100px',
                            background: data.color,
                            opacity: 0.05,
                            filter: 'blur(40px)',
                            borderRadius: '50%'
                        }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: data.color
                            }}>
                                {data.icon}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {type} quota
                                </div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                                    {data.used} <span style={{ fontSize: '1rem', opacity: 0.4 }}>/ {data.total === Infinity ? '∞' : data.total}</span>
                                </div>
                            </div>
                        </div>

                        {data.total !== Infinity && (
                            <div style={{ marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.8rem', fontWeight: 600 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Used Capacity</span>
                                    <span>{Math.round((data.used / data.total) * 100)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(data.used / data.total) * 100}%`,
                                        height: '100%',
                                        background: data.color,
                                        boxShadow: `0 0 15px ${data.color}`,
                                        transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)'
                                    }} />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                setCurrentType(type);
                                setShowModal(true);
                            }}
                            className="btn-active"
                            style={{
                                width: '100%',
                                padding: '1.2rem',
                                background: 'white',
                                color: 'black',
                                border: 'none',
                                borderRadius: '16px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.8rem',
                                marginTop: '0.5rem'
                            }}
                        >
                            Upload {type.charAt(0).toUpperCase() + type.slice(1)} <Plus size={18} />
                        </button>
                    </div>
                ))}
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <DashboardBannerAd
                    title="Scale Your Brand with Monteeq"
                    subtitle="Unlock advanced analytics and priority support for your content."
                    cta="EXPLORE PRO"
                />
            </div>

            <div className="manage-content-section" style={{ maxWidth: '1200px', margin: '4rem auto 0' }}>
                <div className="glass hover-scale" style={{
                    padding: '2.5rem',
                    borderRadius: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)'
                }} onClick={() => navigate('/manage')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '20px',
                            background: 'rgba(255,158,11,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f59e0b',
                            boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)'
                        }}>
                            <Layout size={30} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Manage Your Workspace</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Organize your videos, posts, and track your content status.</p>
                        </div>
                    </div>
                    <div className="glass" style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)'
                    }}>
                        <ArrowRight size={20} />
                    </div>
                </div>
            </div>

            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(15px)',
                    padding: '1rem'
                }} onClick={() => setShowModal(false)}>
                    <div className="glass" style={{
                        width: '600px',
                        maxWidth: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '3rem',
                        borderRadius: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2.5rem',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>

                        <button
                            onClick={() => setShowModal(false)}
                            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', color: 'white', padding: '0.5rem', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: currentType ? quotas[currentType].color : 'var(--accent-primary)', marginBottom: '0.8rem', display: 'flex', justifyContent: 'center' }}>
                                {currentType && quotas[currentType].icon}
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Publish {currentType}</h2>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Fill in the details to share your creation.</p>
                        </div>

                        {/* Title/Content Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                                {currentType === 'posts' ? 'Post Content' : 'Content Title'}
                            </label>
                            {currentType === 'posts' ? (
                                <textarea
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="What's on your mind?..."
                                    style={{
                                        padding: '1.2rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        color: 'white',
                                        fontSize: '1rem',
                                        minHeight: '120px',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="A catchy name for your video..."
                                    style={{
                                        padding: '1.2rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        color: 'white',
                                        fontSize: '1rem'
                                    }}
                                />
                            )}
                        </div>

                        {/* Description Input (Videos ONLY) */}
                        {currentType !== 'posts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell viewers more about your video..."
                                    style={{
                                        padding: '1.2rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        color: 'white',
                                        fontSize: '1rem',
                                        minHeight: '100px',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        )}
                        {/* Tags Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Tags</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="e.g. cinematic, vlog, gaming (separate with commas)"
                                style={{
                                    padding: '1.2rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    color: 'white',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        {/* Drag & Drop Area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                                {currentType === 'posts' ? 'Attached Image (Optional)' : 'Video File'}
                            </label>
                            <div
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    border: `2px dashed ${isDragging ? (currentType ? quotas[currentType].color : 'var(--accent-primary)') : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '24px',
                                    padding: currentType === 'posts' ? '1.5rem' : '3rem',
                                    textAlign: 'center',
                                    background: isDragging ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'var(--transition-smooth)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept={currentType === 'posts' ? "image/*" : "video/*"}
                                    onChange={(e) => setFile(e.target.files[0])}
                                />
                                <div style={{
                                    width: currentType === 'posts' ? '40px' : '60px',
                                    height: currentType === 'posts' ? '40px' : '60px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: file ? '#4ade80' : 'var(--text-secondary)'
                                }}>
                                    {file ? <CheckCircle size={currentType === 'posts' ? 20 : 30} /> : <UploadIcon size={currentType === 'posts' ? 20 : 30} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: currentType === 'posts' ? '0.9rem' : '1.1rem' }}>
                                        {file ? file.name : (currentType === 'posts' ? 'Add image' : 'Drag & drop video')}
                                    </div>
                                    {!file && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                                            {currentType === 'posts' ? 'or click to browse images' : 'or click to browse from device'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Thumbnail (for Home only) */}
                        {currentType === 'home' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Cover Image (Optional)</label>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <label style={{
                                        flex: 1,
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.8rem',
                                        fontSize: '0.9rem'
                                    }}>
                                        <Plus size={18} />
                                        {thumbnailFile ? thumbnailFile.name : 'Select Thumbnail'}
                                        <input
                                            type="file"
                                            style={{ display: 'none' }}
                                            accept="image/*"
                                            onChange={(e) => setThumbnailFile(e.target.files[0])}
                                        />
                                    </label>
                                    {thumbnailFile && (
                                        <button
                                            onClick={() => setThumbnailFile(null)}
                                            style={{ background: 'rgba(255,62,62,0.1)', border: 'none', borderRadius: '12px', color: 'var(--accent-primary)', padding: '0.8rem' }}
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            className="btn-active"
                            disabled={(currentType === 'posts' ? !title : (!file || !title))}
                            style={{
                                width: '100%',
                                padding: '1.2rem',
                                background: currentType ? quotas[currentType].color : 'var(--accent-primary)',
                                border: 'none',
                                borderRadius: '16px',
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '1.1rem',
                                boxShadow: `0 10px 30px ${currentType ? quotas[currentType].color : 'var(--accent-primary)'}40`,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                opacity: (currentType === 'posts' ? !title : (!file || !title)) ? 0.5 : 1
                            }}
                        >
                            Start Publishing <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Upload;
