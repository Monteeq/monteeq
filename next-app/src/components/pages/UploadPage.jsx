'use client';

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

import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/browserApi';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import s from '@/styles/pages/UploadV2.module.css';

const Upload = () => {
    const { user, token, refreshUser } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();

    // Wake up the video engine on Render to mitigate cold starts
    useEffect(() => {
        fetch('https://engine.monteeq.com/health', { mode: 'no-cors' }).catch(() => {});
    }, []);

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
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [dbVideoId, setDbVideoId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Post State
    const [uploadType, setUploadType] = useState('video'); // 'video' | 'post'
    const [postContent, setPostContent] = useState('');
    const [postImage, setPostImage] = useState(null);
    const [postPreview, setPostPreview] = useState(null);

    // Chunked Upload State
    const [uploadId, setUploadId] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const [isUploadError, setIsUploadError] = useState(false);

    const uploadIdRef = useRef(null);
    const isPausedRef = useRef(false);

    // Sync refs
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        uploadIdRef.current = uploadId;
    }, [uploadId]);

    // Unload prevention
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (uploading && processingStatus !== 'completed') {
                e.preventDefault();
                e.returnValue = 'Upload is in progress. Are you sure you want to close this page?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [uploading, processingStatus]);

    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
    const postImageInputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
        };
    }, [thumbnailPreview]);

    useEffect(() => {
        return () => {
            if (postPreview) URL.revokeObjectURL(postPreview);
        };
    }, [postPreview]);

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

    const pollProcessingStatus = (processingKey) => {
        setProcessingStatus('processing');
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/videos/status/${processingKey}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const statusData = await res.json();

                if (statusData.status === 'completed') {
                    clearInterval(interval);
                    setProcessingStatus('completed');
                    setUploading(false);
                    setProgress(100);
                    setProcessingProgress(100);
                    showNotification('success', 'Video is now live!');
                    refreshUser();
                } else if (statusData.status === 'error') {
                    clearInterval(interval);
                    setProcessingStatus('error');
                    setUploading(false);
                    showNotification('error', 'Processing failed.');
                } else {
                    setProcessingProgress(statusData.progress || 0);
                    setCurrentStatusMessage(statusData.message || 'Transcoding...');
                }
            } catch (e) { console.error("Poll error:", e); }
        }, 3000);
    };

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    const uploadLoop = async (currentUploadId, completedSet) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
            if (isPausedRef.current) {
                console.log("Upload paused");
                return;
            }

            if (completedSet.has(i)) {
                continue;
            }

            // Upload chunk i
            const start = i * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const chunkBlob = file.slice(start, end);

            const formData = new FormData();
            formData.append("upload_id", currentUploadId);
            formData.append("chunk_index", i);
            formData.append("file", chunkBlob, file.name);

            let chunkSuccess = false;
            let retries = 3;

            while (!chunkSuccess && retries > 0) {
                if (isPausedRef.current) {
                    console.log("Upload paused during retry");
                    return;
                }

                try {
                    const res = await fetch(`${API_BASE_URL}/videos/upload/chunk`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` },
                        body: formData
                    });

                    if (!res.ok) {
                        throw new Error(`Failed to upload chunk ${i}`);
                    }

                    completedSet.add(i);
                    const overallProgress = Math.round((completedSet.size / totalChunks) * 100);
                    setProgress(overallProgress);
                    chunkSuccess = true;
                } catch (err) {
                    console.error(`Chunk ${i} upload error, retries left: ${retries - 1}`, err);
                    retries--;
                    if (retries === 0) {
                        setIsUploadError(true);
                        setIsPaused(true);
                        setUploading(false);
                        showNotification("error", "Network issue detected. Upload paused. Click Resume to retry.");
                        return;
                    }
                    // Wait before retrying (exponential backoff: 2s, 4s)
                    const backoff = (3 - retries) * 2000;
                    await new Promise(resolve => setTimeout(resolve, backoff));
                }
            }
        }

        // Finalize upload
        setProcessingStatus('processing');
        setCurrentStatusMessage("Finalizing upload on server...");
        
        const finalizeFormData = new FormData();
        finalizeFormData.append("upload_id", currentUploadId);
        finalizeFormData.append("total_chunks", totalChunks);
        finalizeFormData.append("filename", file.name);

        try {
            const finalizeRes = await fetch(`${API_BASE_URL}/videos/upload/finalize`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: finalizeFormData
            });

            if (!finalizeRes.ok) {
                const errorData = await finalizeRes.json();
                throw new Error(errorData.detail || "Finalization failed");
            }

            const data = await finalizeRes.json();
            setDbVideoId(data.video_id);
            pollProcessingStatus(currentUploadId);
        } catch (err) {
            console.error("Finalization error:", err);
            setIsUploadError(true);
            setUploading(false);
            showNotification("error", err.message || "Failed to finalize video upload.");
        }
    };

    const startUpload = async () => {
        if (uploading) return;
        setUploading(true);
        setIsPaused(false);
        setIsUploadError(false);
        setProcessingStatus('uploading');

        let currentUploadId = uploadIdRef.current;
        let completedSet = new Set();

        if (!currentUploadId) {
            // First time initiating upload
            const initFormData = new FormData();
            initFormData.append('title', title);
            initFormData.append('description', description);
            initFormData.append('tags', tags);
            initFormData.append('video_type', videoType);
            initFormData.append('filename', file.name);
            if (thumbnailFile) {
                initFormData.append('thumbnail', thumbnailFile);
            }

            try {
                const initRes = await fetch(`${API_BASE_URL}/videos/upload/initiate`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: initFormData
                });

                if (!initRes.ok) {
                    const errData = await initRes.json();
                    throw new Error(errData.detail || 'Failed to initiate upload session');
                }

                const initData = await initRes.json();
                currentUploadId = initData.upload_id;
                setUploadId(currentUploadId);
                uploadIdRef.current = currentUploadId;
            } catch (err) {
                setUploading(false);
                setIsPaused(true);
                setIsUploadError(true);
                showNotification('error', err.message);
                return;
            }
        } else {
            // Resume upload - check completed chunks status
            try {
                const statusRes = await fetch(`${API_BASE_URL}/videos/upload/status/${currentUploadId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!statusRes.ok) {
                    throw new Error('Failed to fetch upload status');
                }
                const statusData = await statusRes.json();
                completedSet = new Set(statusData.completed_chunks || []);
            } catch (err) {
                setUploading(false);
                setIsPaused(true);
                setIsUploadError(true);
                showNotification('error', 'Failed to resume upload session. Retrying...');
                return;
            }
        }

        // Run chunked upload loop
        await uploadLoop(currentUploadId, completedSet);
    };

    const pauseUpload = () => {
        setIsPaused(true);
        setUploading(false);
        showNotification('info', 'Upload paused');
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
            router.push('/posts');
        } catch (err) {
            showNotification('error', err.message);
        } finally {
            setUploading(false);
        }
    };

    const renderActionButtons = () => {
        if (uploadType === 'post') {
            return (
                <button 
                    className={uploading ? "btn-loading" : "btn-primary"} 
                    disabled={!postContent || uploading} 
                    onClick={handlePostSubmit} 
                    style={{ width: '100%' }}
                >
                    {uploading ? <><Loader2 className={s.spin} size={20} /> PUBLISHING...</> : 'PUBLISH NOW'}
                </button>
            );
        }

        // Video uploads
        if (!uploadId && !uploading) {
            return (
                <button
                    className="btn-primary"
                    disabled={!title || !file}
                    onClick={startUpload}
                    style={{ width: '100%' }}
                >
                    PUBLISH NOW
                </button>
            );
        }

        if (uploading && processingStatus === 'uploading') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    <div className="btn-loading" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className={s.spin} size={20} /> UPLOADING ({progress}%)
                    </div>
                    <button
                        className="btn-secondary"
                        onClick={pauseUpload}
                        style={{ width: '100%' }}
                    >
                        PAUSE UPLOAD
                    </button>
                </div>
            );
        }

        if (isPaused && processingStatus === 'uploading') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    <button
                        className="btn-primary"
                        onClick={startUpload}
                        style={{ width: '100%' }}
                    >
                        RESUME UPLOAD
                    </button>
                    {uploadId && (
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Upload paused at {progress}%
                        </div>
                    )}
                </div>
            );
        }

        if (processingStatus === 'processing') {
            return (
                <div className="btn-loading" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 className={s.spin} size={20} /> PROCESSING ({processingProgress}%)
                </div>
            );
        }

        return null;
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
                <button className="btn-secondary desktop-only" onClick={() => router.push('/manage')}>
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

                                <div className={s.formGroup}>
                                    <label className={s.label}>Video Thumbnail (Optional)</label>
                                    <div 
                                        className={s.imageDropzone || s.dropzone}
                                        onClick={() => thumbnailInputRef.current.click()}
                                        style={{ 
                                            cursor: 'pointer', 
                                            border: '2px dashed rgba(255,255,255,0.1)', 
                                            padding: '1.5rem', 
                                            borderRadius: '12px', 
                                            textAlign: 'center', 
                                            position: 'relative',
                                            background: 'rgba(255, 255, 255, 0.02)'
                                        }}
                                    >
                                        <input 
                                            type="file" 
                                            ref={thumbnailInputRef} 
                                            hidden 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const f = e.target.files[0];
                                                if (f) {
                                                    setThumbnailFile(f);
                                                    setThumbnailPreview(URL.createObjectURL(f));
                                                }
                                            }} 
                                        />
                                        {thumbnailPreview ? (
                                            <div style={{ position: 'relative', width: '100%', maxHeight: '180px', overflow: 'hidden', borderRadius: '8px' }}>
                                                <img src={thumbnailPreview} alt="Thumbnail Preview" style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
                                                <button 
                                                    className={s.removeImage}
                                                    style={{ 
                                                        position: 'absolute', 
                                                        top: '5px', 
                                                        right: '5px', 
                                                        background: 'rgba(0,0,0,0.6)', 
                                                        border: 'none', 
                                                        borderRadius: '50%', 
                                                        color: 'white', 
                                                        padding: '4px', 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setThumbnailPreview(null); 
                                                        setThumbnailFile(null); 
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                <PhotoIcon size={32} />
                                                <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Upload thumbnail photo</span>
                                            </div>
                                        )}
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
                                        onClick={() => postImageInputRef.current.click()}
                                    >
                                        <input 
                                            type="file" 
                                            ref={postImageInputRef} 
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
                            {renderActionButtons()}
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
                            {renderActionButtons()}

                            {dbVideoId && processingStatus !== 'completed' && (
                                <button className="btn-secondary" style={{ width: '100%' }} onClick={saveMetadata} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Update Metadata'}
                                </button>
                            )}
                        </div>

                        {processingStatus === 'completed' && (
                            <button className="btn-primary" style={{ marginTop: '1rem', background: '#4ade80', color: 'black', width: '100%' }} onClick={() => router.push('/manage')}>
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
