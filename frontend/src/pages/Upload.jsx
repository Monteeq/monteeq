import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Upload as UploadIcon,
    Video,
    Layout,
    CheckCircle,
    FileVideo,
    Plus,
    X,
    ArrowRight,
    Info,
    Globe,
    Lock,
    Settings,
    Sparkles,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Type,
    AlignLeft,
    Tag,
    Image as ImageIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getUserInsights } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const Upload = () => {
    const { user, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // Workflow State: 'type' | 'select' | 'details' | 'success'
    const [step, setStep] = useState('type');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState(null); // 'uploading' | 'processing' | 'done'

    // Form Data
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [videoType, setVideoType] = useState('home');
    const [file, setFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [dbVideoId, setDbVideoId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Quotas
    const [quotas, setQuotas] = useState({
        flash: { used: 0, total: 50 },
        home: { used: 0, total: 20 }
    });

    useEffect(() => {
        if (user) {
            setQuotas({
                flash: { used: user.flash_uploads || 0, total: user.flash_quota_limit || 50 },
                home: { used: user.home_uploads || 0, total: user.home_quota_limit || 20 }
            });
        }
    }, [user]);

    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);

    // Handle File Selection
    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;
        if (!selectedFile.type.startsWith('video/')) {
            showNotification('error', "Only video files are supported.");
            return;
        }

        setFile(selectedFile);
        // Auto-fill title from filename (clean it up)
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
        setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));

        // Create a local preview URL
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);

        setStep('details');
    };

    // Actual Upload Logic
    const startUpload = async () => {
        if (uploading) return;
        setUploading(true);
        setProcessingStatus('uploading');

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('tags', tags);
        formData.append('video_type', videoType);
        formData.append('file', file);
        if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

        const xhr = new XMLHttpRequest();

        const uploadPromise = new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    setProgress(percent);
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

            xhr.open('POST', `${API_BASE_URL}/videos/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });

        try {
            const data = await uploadPromise;
            setDbVideoId(data.id);
            setProcessingStatus('processing');

            // Poll for processing status
            const processingKey = data.processing_key;
            if (processingKey) {
                const interval = setInterval(async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/videos/status/${processingKey}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const statusData = await res.json();

                        if (statusData.status === 'completed') {
                            clearInterval(interval);
                            setProcessingStatus('done');
                            setProgress(100);
                            showNotification('success', 'Video processed and ready!');
                            refreshUser();
                        } else if (statusData.status === 'error') {
                            clearInterval(interval);
                            setProcessingStatus('error');
                            showNotification('error', 'Video processing failed.');
                        } else {
                            // Update progress during processing (starts from 0 again)
                            // We combine it: 100 for upload + statusData.progress for processing
                            // But for UI simplicity, we can just show the message
                        }
                    } catch (e) { console.error(e); }
                }, 3000);
            }
        } catch (err) {
            setUploading(false);
            setProcessingStatus('error');
            showNotification('error', err.message);
        }
    };

    // Save metadata changes while processing
    const saveMetadata = async () => {
        if (!dbVideoId || isSaving) return;
        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/videos/${dbVideoId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    tags,
                    video_type: videoType
                })
            });
            if (response.ok) {
                showNotification('success', 'Changes saved');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="studio-upload-page" style={{
            minHeight: '100vh',
            background: '#050505',
            color: 'white',
            padding: '2rem',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header */}
            <div className="studio-header" style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'var(--accent-primary)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px var(--accent-glow)'
                    }}>
                        <Sparkles size={20} color="white" />
                    </div>
                    <div className="title-container">
                        <h1 style={{ fontWeight: 900, letterSpacing: '-0.5px' }}>Monteeq Studio</h1>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>CONTENT PUBLISHING ENGINE</p>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/manage')}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.8rem 1.5rem',
                        borderRadius: '12px',
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Layout size={18} /> <span className="manage-btn-text">Manage Content</span>
                </button>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {step === 'type' ? (
                    /* STEP 0: CHOOSE TYPE */
                    <div className="glass-morphism" style={{
                        padding: 'clamp(3rem, 10vw, 6rem) 1.5rem',
                        borderRadius: 'clamp(24px, 5vw, 40px)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3rem',
                        background: 'radial-gradient(circle at center, rgba(255,62,62,0.05) 0%, transparent 70%)'
                    }}>
                        <div>
                            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 900, marginBottom: '0.5rem' }}>What do you want to create?</h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)' }}>Select the type of content you want to publish</p>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                            <div 
                                onClick={() => setStep('select')}
                                className="type-card"
                                style={{
                                    flex: '1 1 250px',
                                    maxWidth: '350px',
                                    padding: '3rem 2rem',
                                    borderRadius: '24px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1.5rem'
                                }}
                            >
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,62,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255,62,62,0.2)' }}>
                                    <Video size={40} color="var(--accent-primary)" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Video</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>Upload a Home Video or Flash Clip</p>
                                </div>
                            </div>
                            
                            <div 
                                onClick={() => navigate('/create-post')}
                                className="type-card"
                                style={{
                                    flex: '1 1 250px',
                                    maxWidth: '350px',
                                    padding: '3rem 2rem',
                                    borderRadius: '24px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1.5rem'
                                }}
                            >
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Layout size={40} color="white" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Post</h3>
                                    <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>Share your thoughts and ideas</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : step === 'select' ? (
                    /* STEP 1: SELECT FILE */
                    <div className="glass-morphism" style={{
                        padding: 'clamp(3rem, 10vw, 6rem) 1.5rem',
                        borderRadius: 'clamp(24px, 5vw, 40px)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2rem',
                        background: 'radial-gradient(circle at center, rgba(255,62,62,0.05) 0%, transparent 70%)'
                    }}>
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0]); }}
                            onClick={() => fileInputRef.current.click()}
                            style={{
                                width: 'clamp(150px, 30vw, 200px)',
                                height: 'clamp(150px, 30vw, 200px)',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.02)',
                                border: '2px dashed rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <input type="file" ref={fileInputRef} hidden accept="video/*" onChange={(e) => handleFileSelect(e.target.files[0])} />
                            <div className="pulse-slow">
                                <UploadIcon size={window.innerWidth < 768 ? 40 : 60} color="var(--accent-primary)" />
                            </div>
                        </div>

                        <div>
                            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 900, marginBottom: '0.5rem' }}>Drop your video here</h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)' }}>Or click to browse files from your computer</p>
                        </div>

                        <div style={{ display: 'flex', gap: 'clamp(1rem, 5vw, 2rem)', marginTop: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: 'clamp(1rem, 3vw, 1.2rem)' }}>{quotas.home.total - quotas.home.used}</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Home Credits</div>
                            </div>
                            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, color: 'hsl(345, 100%, 55%)', fontSize: 'clamp(1rem, 3vw, 1.2rem)' }}>{quotas.flash.total - quotas.flash.used}</div>
                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Flash Credits</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* STEP 2: DETAILS & UPLOAD */
                    <div className="studio-grid" style={{ display: 'grid', gap: '2rem' }}>
                        {/* LEFT COLUMN: FORM */}
                        <div className="glass" style={{ padding: 'clamp(1.5rem, 5vw, 3rem)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', fontWeight: 800 }}>Video Details</h2>
                                {uploading && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                        <Loader2 className="spin" size={16} />
                                        {processingStatus === 'uploading' ? `Uploading ${progress}%` : 'Processing at edge...'}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
                                {/* Title */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>TITLE (REQUIRED)</label>
                                    <div style={{ position: 'relative' }}>
                                        <Type style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} size={18} />
                                        <input
                                            type="text"
                                            className="studio-input"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '16px',
                                                padding: '1.2rem 1.2rem 1.2rem 3.5rem',
                                                color: 'white',
                                                fontSize: '1rem',
                                                fontWeight: 600
                                            }}
                                            placeholder="Catchy title"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>DESCRIPTION</label>
                                    <div style={{ position: 'relative' }}>
                                        <AlignLeft style={{ position: 'absolute', left: '1.2rem', top: '1.5rem', opacity: 0.3 }} size={18} />
                                        <textarea
                                            className="studio-input"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '16px',
                                                padding: '1.2rem 1.2rem 1.2rem 3.5rem',
                                                color: 'white',
                                                fontSize: '1rem',
                                                minHeight: '120px',
                                                resize: 'vertical'
                                            }}
                                            placeholder="Tell viewers more..."
                                        />
                                    </div>
                                </div>

                                {/* Tags & Thumbnail Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>TAGS</label>
                                        <div style={{ position: 'relative' }}>
                                            <Tag style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} size={18} />
                                            <input
                                                type="text"
                                                className="studio-input"
                                                value={tags}
                                                onChange={(e) => setTags(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '16px',
                                                    padding: '1.2rem 1.2rem 1.2rem 3.5rem',
                                                    color: 'white',
                                                    fontSize: '1rem'
                                                }}
                                                placeholder="anime, amv..."
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>THUMBNAIL (OPTIONAL)</label>
                                        <button
                                            onClick={() => thumbnailInputRef.current.click()}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '16px',
                                                padding: '1.2rem',
                                                color: thumbnailFile ? 'var(--accent-primary)' : 'rgba(255,255,255,0.6)',
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <ImageIcon size={20} /> {thumbnailFile ? 'Selected' : 'Custom cover'}
                                            <input type="file" ref={thumbnailInputRef} hidden accept="image/*" onChange={(e) => setThumbnailFile(e.target.files[0])} />
                                        </button>
                                    </div>
                                </div>

                                {/* Video Type Selector */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px', color: 'rgba(255,255,255,0.4)' }}>PUBLISH AS</label>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div
                                            onClick={() => setVideoType('home')}
                                            style={{
                                                flex: 1,
                                                minWidth: '150px',
                                                padding: '1.2rem',
                                                borderRadius: '20px',
                                                background: videoType === 'home' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                                border: videoType === 'home' ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Video size={20} style={{ marginBottom: '0.5rem', opacity: videoType === 'home' ? 1 : 0.3 }} />
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Home Video</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>HD/4K Landscape</div>
                                        </div>
                                        <div
                                            onClick={() => setVideoType('flash')}
                                            style={{
                                                flex: 1,
                                                minWidth: '150px',
                                                padding: '1.2rem',
                                                borderRadius: '20px',
                                                background: videoType === 'flash' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                                border: videoType === 'flash' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <Sparkles size={20} color={videoType === 'flash' ? 'var(--accent-primary)' : 'white'} style={{ marginBottom: '0.5rem', opacity: videoType === 'flash' ? 1 : 0.3 }} />
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: videoType === 'flash' ? 'var(--accent-primary)' : 'white' }}>Flash</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>Vertical Shorts</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PREVIEW & STATUS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Preview Card */}
                            <div className="glass" style={{
                                borderRadius: '24px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.05)',
                                background: '#0a0a0a'
                            }}>
                                <div style={{
                                    width: '100%',
                                    aspectRatio: videoType === 'flash' ? '9/16' : '16/9',
                                    background: '#111',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {previewUrl ? (
                                        <video
                                            src={previewUrl}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }}
                                            muted
                                            autoPlay
                                            loop
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Video size={48} opacity={0.1} />
                                        </div>
                                    )}

                                    {uploading && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(0,0,0,0.4)',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            <div style={{
                                                width: '80px',
                                                height: '80px',
                                                borderRadius: '50%',
                                                border: '4px solid rgba(255,255,255,0.1)',
                                                borderTop: '4px solid var(--accent-primary)',
                                                animation: 'spin 1.5s linear infinite'
                                            }} />
                                            <div style={{ marginTop: '1rem', fontWeight: 900, fontSize: '1.2rem' }}>{progress}%</div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ padding: '1.5rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>File Name</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file?.name}
                                    </div>

                                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem' }}>
                                            <div className={processingStatus === 'uploading' ? 'active-pulse' : ''} style={{ width: '20px', height: '20px', borderRadius: '50%', background: progress > 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
                                                {progress === 100 ? <CheckCircle2 size={12} /> : <div style={{ fontSize: '10px' }}>1</div>}
                                            </div>
                                            <span style={{ opacity: progress > 0 ? 1 : 0.4, transition: 'all 0.3s ease' }}>Upload to Monteeq Cloud</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem' }}>
                                            <div className={processingStatus === 'processing' ? 'active-pulse' : ''} style={{ width: '20px', height: '20px', borderRadius: '50%', background: processingStatus === 'processing' || processingStatus === 'done' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
                                                {processingStatus === 'done' ? <CheckCircle2 size={12} /> : <div style={{ fontSize: '10px' }}>2</div>}
                                            </div>
                                            <span style={{ opacity: processingStatus === 'processing' || processingStatus === 'done' ? 1 : 0.4, transition: 'all 0.3s ease' }}>Edge Transcoding (HD/4K)</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: processingStatus === 'done' ? '#4ade80' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>
                                                {processingStatus === 'done' ? <CheckCircle2 size={12} /> : <div style={{ fontSize: '10px' }}>3</div>}
                                            </div>
                                            <span style={{ opacity: processingStatus === 'done' ? 1 : 0.4, transition: 'all 0.3s ease' }}>Publish & Distribution</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {processingStatus === 'done' ? (
                                    <button
                                        onClick={() => navigate('/manage')}
                                        style={{
                                            width: '100%',
                                            padding: '1.5rem',
                                            borderRadius: '20px',
                                            background: '#4ade80',
                                            color: 'black',
                                            fontWeight: 900,
                                            fontSize: '1.1rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 0 30px rgba(74, 222, 128, 0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '1rem'
                                        }}
                                    >
                                        GOTO DASHBOARD <ArrowRight size={20} />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            disabled={!title || uploading}
                                            onClick={startUpload}
                                            className="publish-btn"
                                            style={{
                                                width: '100%',
                                                padding: '1.5rem',
                                                borderRadius: '20px',
                                                fontWeight: 900,
                                                fontSize: '1.1rem',
                                                border: 'none',
                                                cursor: uploading ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '1rem'
                                            }}
                                        >
                                            {uploading ? (
                                                <><Loader2 className="spin" /> PUBLISHING...</>
                                            ) : (
                                                <><Plus size={20} /> PUBLISH VIDEO</>
                                            )}
                                        </button>

                                        {uploading && (
                                            <button
                                                onClick={saveMetadata}
                                                disabled={isSaving}
                                                style={{
                                                    width: '100%',
                                                    padding: '1.2rem',
                                                    borderRadius: '16px',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {isSaving ? 'Saving...' : 'Update Details'}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                if (window.confirm("Discard changes and cancel upload?")) {
                                                    setStep('select');
                                                    setUploading(false);
                                                    setProgress(0);
                                                    setFile(null);
                                                    setPreviewUrl(null);
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'none',
                                                border: 'none',
                                                color: 'rgba(255,255,255,0.3)',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Discard Draft
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .studio-upload-page {
                    animation: fadeIn 0.5s ease-out;
                    padding: 1rem;
                }
                .studio-header {
                    margin-bottom: 1.5rem;
                }
                .studio-grid {
                    grid-template-columns: 1fr;
                }
                
                /* Mobile-First Adjustments */
                .manage-btn-text { display: none; }
                .title-container h1 { font-size: 1.2rem !important; }
                .title-container p { font-size: 0.7rem !important; }
                
                .glass-morphism {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                }
                
                .studio-input {
                    transition: all 0.3s ease;
                }
                .studio-input:focus {
                    outline: none;
                    border-color: var(--accent-primary) !important;
                    box-shadow: 0 0 15px rgba(255, 62, 62, 0.2);
                    background: rgba(255,255,255,0.06) !important;
                }
                
                .publish-btn {
                    transition: all 0.3s ease;
                    background: linear-gradient(135deg, var(--accent-primary), hsl(345, 100%, 60%)) !important;
                    color: white !important;
                }
                .publish-btn:hover:not(:disabled) {
                    transform: scale(1.02);
                    box-shadow: 0 0 30px rgba(255, 62, 62, 0.4) !important;
                }
                .publish-btn:active:not(:disabled) {
                    transform: scale(0.98);
                }
                .publish-btn:disabled {
                    background: rgba(255,255,255,0.1) !important;
                    color: rgba(255,255,255,0.4) !important;
                    box-shadow: none !important;
                }
                
                .type-card {
                    transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
                }
                .type-card:hover {
                    transform: translateY(-5px);
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(255,255,255,0.2) !important;
                }

                @media (min-width: 768px) {
                    .studio-upload-page { padding: 2rem; }
                    .manage-btn-text { display: inline; }
                    .title-container h1 { font-size: 1.5rem !important; }
                    .title-container p { font-size: 0.8rem !important; }
                    .studio-header { margin-bottom: 2rem; }
                }

                @media (min-width: 1024px) {
                    .studio-grid {
                        grid-template-columns: 1fr 400px;
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .pulse-slow {
                    animation: pulse 2s ease-in-out infinite;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                .active-pulse {
                    animation: activePulse 1.5s ease-in-out infinite;
                }
                @keyframes activePulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 62, 62, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 62, 62, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 62, 62, 0); }
                }
                `}} />
        </div>
    );
};

export default Upload;
