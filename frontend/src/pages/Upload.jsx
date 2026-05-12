import React, { useState, useEffect, useRef } from 'react';
import {
    Upload as UploadIcon,
    Video,
    Layout,
    CheckCircle,
    FileVideo,
    Plus,
    X,
    ArrowRight,
    Sparkles,
    Loader2,
    CheckCircle2,
    ImageIcon,
    Type,
    AlignLeft,
    Tag,
    ChevronLeft,
    Globe,
    Zap,
    MessageSquare,
    Image as PhotoIcon
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import s from './UploadV2.module.css';

const Upload = () => {
    const { user, token, refreshUser } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // Workflow State: 'select' | 'details'
    const [step, setStep] = useState('select');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [currentStatusMessage, setCurrentStatusMessage] = useState('');
    const [processingStatus, setProcessingStatus] = useState(null); // 'uploading' | 'processing' | 'completed' | 'error'

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
    
    // Post State
    const [uploadType, setUploadType] = useState('video'); // 'video' | 'post'
    const [postContent, setPostContent] = useState('');
    const [postImage, setPostImage] = useState(null);
    const [postPreview, setPostPreview] = useState(null);


    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);

    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;
        if (!selectedFile.type.startsWith('video/')) {
            showNotification('error', "Only video files are supported.");
            return;
        }
        setFile(selectedFile);
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ');
        setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setStep('details');
    };

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
                    setProgress(Math.round((e.loaded / e.total) * 100));
                }
            });
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
                    else reject(new Error('Upload failed'));
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
                            setProcessingStatus('completed');
                            setProgress(100);
                            setProcessingProgress(100);
                            showNotification('success', 'Video is now live!');
                            refreshUser();
                        } else if (statusData.status === 'error') {
                            clearInterval(interval);
                            setProcessingStatus('error');
                            showNotification('error', 'Processing failed.');
                        } else {
                            setProcessingProgress(statusData.progress || 0);
                            setCurrentStatusMessage(statusData.message || 'Transcoding...');
                        }
                    } catch (e) { console.error("Poll error:", e); }
                }, 3000);
            }
        } catch (err) {
            setUploading(false);
            setProcessingStatus('error');
            showNotification('error', err.message);
        }
    };

    const saveMetadata = async () => {
        if (!dbVideoId || isSaving) return;
        setIsSaving(true);
        try {
            await fetch(`${API_BASE_URL}/videos/${dbVideoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, description, tags, video_type: videoType })
            });
            showNotification('success', 'Metadata updated');
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    const handlePostSubmit = async () => {
        if (!postContent || uploading) return;
        setUploading(true);
        
        const formData = new FormData();
        formData.append('content', postContent);
        formData.append('tags', tags);
        if (postImage) formData.append('image', postImage);

        try {
            const res = await fetch(`${API_BASE_URL}/posts/create`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error("Failed to create post");
            showNotification('success', "Post published to community!");
            navigate('/posts');
        } catch (err) {
            showNotification('error', err.message);
        } finally {
            setUploading(false);
        }
    };


    return (
        <div className={s.uploadPage}>
            <header className={s.header}>
                <div className={s.brand}>
                    <div className={s.logoIcon}><Sparkles size={20} color="white" /></div>
                    <div className={s.brandInfo}>
                        <h1>Monteeq Studio</h1>
                        <p>Creation Hub</p>
                    </div>
                </div>
                <button className="btn-secondary desktop-only" onClick={() => navigate('/manage')}>
                    <Layout size={18} /> Manage Content
                </button>
            </header>

            <div className={s.modeSwitcher}>
                <button 
                    className={`${s.modeTab} ${uploadType === 'video' ? s.activeMode : ''}`}
                    onClick={() => { setUploadType('video'); setStep('select'); }}
                >
                    <Video size={20} /> Video Master
                </button>
                <button 
                    className={`${s.modeTab} ${uploadType === 'post' ? s.activeMode : ''}`}
                    onClick={() => { setUploadType('post'); setStep('details'); }}
                >
                    <MessageSquare size={20} /> Community Post
                </button>
            </div>



            {uploadType === 'video' && step === 'select' ? (
                <div className={s.dropzoneContainer} style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>

                    <div 
                        className={s.dropzone}
                        onClick={() => fileInputRef.current.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0]); }}
                    >
                        <input type="file" ref={fileInputRef} hidden accept="video/*" onChange={(e) => handleFileSelect(e.target.files[0])} />
                        <div className={s.pulse} style={{ marginBottom: '2rem' }}>
                            <UploadIcon size={64} color="var(--accent-primary)" />
                        </div>
                        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Upload Video</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Drag and drop or click to select a file</p>
                        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{user?.home_quota_limit - user?.home_uploads}</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HOME CREDITS</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>{user?.flash_quota_limit - user?.flash_uploads}</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>FLASH CREDITS</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={s.stepperContainer}>

                    {/* Form Column */}
                    <div className={s.card}>
                        <div style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Details</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fill in the metadata for your masterpiece</p>
                        </div>

                        {uploadType === 'video' ? (
                            <>
                                <div className={s.formGroup}>
                                    <label className={s.label}>Title</label>
                                    <div className={s.inputWrapper}>
                                        <Type className={s.inputIcon} size={18} />
                                        <input className={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="A name for your video" />
                                    </div>
                                </div>

                                <div className={s.formGroup}>
                                    <label className={s.label}>Description</label>
                                    <div className={s.inputWrapper}>
                                        <AlignLeft className={s.inputIcon} style={{ top: '1.5rem' }} size={18} />
                                        <textarea className={`${s.input} ${s.textarea}`} value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this video about?" />
                                    </div>
                                </div>

                                <div className={s.formGroup}>
                                    <label className={s.label}>Format</label>
                                    <div className={s.typeGrid}>
                                        <div className={`${s.typeCard} ${videoType === 'home' ? s.active : ''}`} onClick={() => setVideoType('home')}>
                                            <Video size={24} style={{ marginBottom: '0.5rem', opacity: videoType === 'home' ? 1 : 0.3 }} />
                                            <div style={{ fontWeight: 800 }}>Home</div>
                                        </div>
                                        <div className={`${s.typeCard} ${videoType === 'flash' ? s.active : ''}`} onClick={() => setVideoType('flash')}>
                                            <Zap size={24} style={{ marginBottom: '0.5rem', opacity: videoType === 'flash' ? 1 : 0.3 }} />
                                            <div style={{ fontWeight: 800 }}>Flash</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={s.formGroup}>
                                    <label className={s.label}>Post Content</label>
                                    <div className={s.inputWrapper}>
                                        <AlignLeft className={s.inputIcon} style={{ top: '1.5rem' }} size={18} />
                                        <textarea 
                                            className={`${s.input} ${s.textarea}`} 
                                            value={postContent} 
                                            onChange={e => setPostContent(e.target.value)} 
                                            placeholder="What's on your mind? Share an update with your followers..." 
                                        />
                                    </div>
                                </div>

                                <div className={s.formGroup}>
                                    <label className={s.label}>Attach Image (Optional)</label>
                                    <div 
                                        className={s.imageDropzone}
                                        onClick={() => thumbnailInputRef.current.click()}
                                    >
                                        <input 
                                            type="file" 
                                            ref={thumbnailInputRef} 
                                            hidden 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const f = e.target.files[0];
                                                if (f) {
                                                    setPostImage(f);
                                                    setPostPreview(URL.createObjectURL(f));
                                                }
                                            }} 
                                        />
                                        {postPreview ? (
                                            <img src={postPreview} alt="Preview" className={s.postImagePreview} />
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                <PhotoIcon size={32} />
                                                <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Add a photo</span>
                                            </div>
                                        )}
                                        {postPreview && (
                                            <button 
                                                className={s.removeImage}
                                                onClick={(e) => { e.stopPropagation(); setPostPreview(null); setPostImage(null); }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}


                        <div className={s.formGroup}>
                            <label className={s.label}>Tags</label>
                            <div className={s.inputWrapper}>
                                <Tag className={s.inputIcon} size={18} />
                                <input className={s.input} value={tags} onChange={e => setTags(e.target.value)} placeholder="anime, gaming, etc." />
                            </div>
                        </div>

                        <div className="mobile-only" style={{ marginTop: '2rem' }}>
                            <button 
                                className={uploading ? "btn-loading" : "btn-primary"} 
                                disabled={(uploadType === 'video' ? !title : !postContent) || uploading} 
                                onClick={uploadType === 'video' ? startUpload : handlePostSubmit} 
                                style={{ width: '100%' }}
                            >
                                {uploading ? <><Loader2 className={s.spin} size={20} /> PUBLISHING...</> : 'PUBLISH NOW'}
                            </button>
                        </div>

                    </div>

                    {/* Status Column */}
                    <div className={s.card} style={{ position: 'sticky', top: '100px' }}>
                        <div className={s.previewCard}>
                            <div className={`${s.videoWrapper} ${videoType === 'home' ? s.landscape : s.portrait}`}>
                                {previewUrl && <video src={previewUrl} muted autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />}
                                {uploading && (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                        <div style={{ marginTop: '1rem', fontWeight: 900, fontSize: '1.25rem' }}>{progress}%</div>
                                    </div>
                                )}
                            </div>
                            
                            <div className={s.statusList}>
                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${progress > 0 ? s.active : ''} ${progress === 100 ? s.completed : ''}`}>
                                        {progress === 100 ? <CheckCircle size={14} /> : 1}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Upload to Cloud</div>
                                        {processingStatus === 'uploading' && <div className={s.statusSub}>{progress}% uploaded</div>}
                                    </div>
                                </div>

                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${processingStatus === 'processing' ? s.active : ''} ${processingStatus === 'completed' ? s.completed : ''}`}>
                                        {processingStatus === 'completed' ? <CheckCircle size={14} /> : 2}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Edge Transcoding</div>
                                        {processingStatus === 'processing' && <div className={s.statusSub}>{currentStatusMessage} ({processingProgress}%)</div>}
                                    </div>
                                </div>

                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${processingStatus === 'completed' ? s.completed : ''}`}>
                                        {processingStatus === 'completed' ? <CheckCircle size={14} /> : 3}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Global Distribution</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="desktop-only" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button 
                                className={uploading ? "btn-loading" : "btn-primary"} 
                                disabled={(uploadType === 'video' ? !title : !postContent) || uploading} 
                                onClick={uploadType === 'video' ? startUpload : handlePostSubmit} 
                                style={{ width: '100%' }}
                            >
                                {uploading ? <><Loader2 className={s.spin} size={20} /> PUBLISHING...</> : 'PUBLISH NOW'}
                            </button>

                            
                            {uploading && processingStatus !== 'completed' && (
                                <button className="btn-secondary" style={{ width: '100%' }} onClick={saveMetadata} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Update Metadata'}
                                </button>
                            )}
                        </div>

                        {processingStatus === 'completed' && (
                            <button className="btn-primary" style={{ marginTop: '1rem', background: '#4ade80', color: 'black', width: '100%' }} onClick={() => navigate('/manage')}>
                                GO TO DASHBOARD
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Upload;
