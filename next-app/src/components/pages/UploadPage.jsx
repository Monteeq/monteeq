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
import { useUploadStore } from '@/stores/useUploadStore';
import {
    buildVideoSelectionItem,
    formatDuration,
    MAX_VIDEO_BYTES,
} from '@/utils/videoSelect';
import { dataUrlToBlob } from '@/utils/coverFrame';
import VideoBatchDetails from '@/components/upload/VideoBatchDetails';
import s from '@/styles/pages/UploadV2.module.css';

const Upload = () => {
    const { user, token, refreshUser } = useAuth();
    const router = useRouter();
    const { showNotification } = useNotification();
    const addUpload = useUploadStore((s) => s.addUpload);
    const updateUpload = useUploadStore((s) => s.updateUpload);
    const removeUpload = useUploadStore((s) => s.removeUpload);

    // Wake up the video engine to mitigate cold starts
    useEffect(() => {
        const rustOrigin = (process.env.NEXT_PUBLIC_RUST_API_URL || '').replace(/\/$/, '');
        if (!rustOrigin) return;
        fetch(`${rustOrigin}/health`, { mode: 'no-cors' }).catch(() => {});
    }, []);

    // Workflow State: 'select' | 'batch-details' | 'details'
    const [step, setStep] = useState('select');
    /** Local only for in-flight chunk loop / post publish — progress & job status live in the store. */
    const [uploading, setUploading] = useState(false);
    const [postingBatch, setPostingBatch] = useState(false);

    // Form Data
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [videoType, setVideoType] = useState('home');
    const [file, setFile] = useState(null);
    const [selectedVideos, setSelectedVideos] = useState([]);
    const [isPickingFiles, setIsPickingFiles] = useState(false);
    /** Valid videos carried into the per-item details step */
    const [batchVideos, setBatchVideos] = useState([]);
    /** @type {[Record<string, { caption: string, tags: string, coverTime: number, coverUrl: string|null, coverBlob: Blob|null }>, Function]} */
    const [videoDrafts, setVideoDrafts] = useState({});
    const [activeVideoId, setActiveVideoId] = useState(null);
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

    const uploadIdRef = useRef(null);
    const isPausedRef = useRef(false);
    const handledTerminalJobRef = useRef(null);
    /** Tracks the store entry id (local-* until finalize, then server job_id). */
    const [trackingJobId, setTrackingJobId] = useState(null);
    const trackingJobIdRef = useRef(null);

    const storeEntry = useUploadStore((s) => {
        const id = trackingJobIdRef.current || trackingJobId;
        return id ? s.activeUploads.find((u) => u.jobId === id) || null : null;
    });

    const jobStatus = storeEntry?.status ?? null;
    const jobVideoId = storeEntry?.videoId ?? null;
    const jobError = storeEntry?.error ?? null;
    const progress = storeEntry?.progress ?? 0;
    const isPolling = jobStatus === 'queued' || jobStatus === 'processing';
    // Map store statuses onto the page's existing UI labels
    const processingStatus =
        jobStatus === 'failed'
            ? 'error'
            : jobStatus === 'queued' || jobStatus === 'processing'
              ? 'processing'
              : jobStatus;

    // Sync refs
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        uploadIdRef.current = uploadId;
    }, [uploadId]);

    useEffect(() => {
        trackingJobIdRef.current = trackingJobId;
    }, [trackingJobId]);

    // One-shot page notifications when the global poller marks terminal
    useEffect(() => {
        if (!storeEntry) return;
        const { jobId: id, status, videoId, error } = storeEntry;
        if (handledTerminalJobRef.current === id) return;

        if (status === 'completed') {
            handledTerminalJobRef.current = id;
            if (videoId) setDbVideoId(videoId);
            setUploading(false);
            showNotification('success', 'Video is now live!');
            refreshUser();
        } else if (status === 'failed') {
            handledTerminalJobRef.current = id;
            setUploading(false);
            setIsPaused(true);
            showNotification('error', error || 'Processing failed.');
        }
    }, [storeEntry, showNotification, refreshUser]);

    // Warn on tab close while a tracked upload is still active
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (storeEntry && !['completed', 'failed'].includes(storeEntry.status)) {
                e.preventDefault();
                e.returnValue = 'Upload is in progress. Are you sure you want to close this page?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [storeEntry]);

    const fileInputRef = useRef(null);
    const thumbnailInputRef = useRef(null);
    const postImageInputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (!previewUrl) return;
            const stillUsed = useUploadStore
                .getState()
                .activeUploads.some((u) => u.thumbnailUrl === previewUrl);
            if (!stillUsed && !String(previewUrl).startsWith('data:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (!thumbnailPreview) return;
            const stillUsed = useUploadStore
                .getState()
                .activeUploads.some((u) => u.thumbnailUrl === thumbnailPreview);
            if (!stillUsed) URL.revokeObjectURL(thumbnailPreview);
        };
    }, [thumbnailPreview]);

    useEffect(() => {
        return () => {
            if (postPreview) URL.revokeObjectURL(postPreview);
        };
    }, [postPreview]);

    const validSelectedCount = selectedVideos.filter((v) => v.isValid).length;

    const addFilesToSelection = async (fileList) => {
        const incoming = Array.from(fileList || []).filter(Boolean);
        if (!incoming.length) return;

        setIsPickingFiles(true);
        try {
            const built = await Promise.all(incoming.map((f) => buildVideoSelectionItem(f)));
            setSelectedVideos((prev) => {
                const existingKeys = new Set(
                    prev.map((v) => `${v.name}:${v.size}`)
                );
                const next = [...prev];
                for (const item of built) {
                    const key = `${item.name}:${item.size}`;
                    if (existingKeys.has(key)) continue;
                    existingKeys.add(key);
                    next.push(item);
                }
                return next;
            });
        } finally {
            setIsPickingFiles(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeSelectedVideo = (id) => {
        setSelectedVideos((prev) => prev.filter((v) => v.id !== id));
    };

    const handleNextFromSelection = () => {
        const valid = selectedVideos.filter((v) => v.isValid);
        if (!valid.length) return;

        const drafts = {};
        for (const v of valid) {
            const coverTime = v.duration && v.duration > 2 ? 1 : 0;
            drafts[v.id] = {
                caption: '',
                tags: '',
                coverTime,
                coverUrl: v.thumbnailUrl,
                coverBlob: null,
            };
        }
        setBatchVideos(valid);
        setVideoDrafts(drafts);
        setActiveVideoId(valid[0].id);
        setStep('batch-details');
    };

    const updateVideoDraft = (id, patch) => {
        setVideoDrafts((prev) => ({
            ...prev,
            [id]: { ...prev[id], ...patch },
        }));
    };

    const CHUNK_SIZE_BATCH = 5 * 1024 * 1024;

    /** Upload one prepared video; progress tracked in the global toast store. */
    const uploadVideoItem = async ({ file: videoFile, caption, tags: itemTags, coverBlob, coverUrl }) => {
        const toastId = `local-${crypto.randomUUID()}`;
        addUpload({
            jobId: toastId,
            fileName: videoFile.name || caption || 'Video',
            thumbnailUrl: coverUrl || null,
            progress: 0,
            status: 'uploading',
            error: null,
        });

        const initFormData = new FormData();
        initFormData.append('title', caption);
        initFormData.append('description', caption);
        initFormData.append('tags', itemTags || '');
        initFormData.append('video_type', videoType);
        initFormData.append('filename', videoFile.name);
        if (coverBlob) {
            initFormData.append('thumbnail', coverBlob, 'cover.jpg');
        }

        const initRes = await fetch(`${API_BASE_URL}/videos/upload/initiate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: initFormData,
        });
        if (!initRes.ok) {
            const errData = await initRes.json().catch(() => ({}));
            const msg = errData.detail || 'Failed to initiate upload';
            updateUpload(toastId, { status: 'failed', error: msg });
            throw new Error(msg);
        }

        const { upload_id: currentUploadId } = await initRes.json();
        const totalChunks = Math.ceil(videoFile.size / CHUNK_SIZE_BATCH);
        const completedSet = new Set();

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE_BATCH;
            const end = Math.min(videoFile.size, start + CHUNK_SIZE_BATCH);
            const chunkBlob = videoFile.slice(start, end);
            const formData = new FormData();
            formData.append('upload_id', currentUploadId);
            formData.append('chunk_index', i);
            formData.append('file', chunkBlob, videoFile.name);

            let retries = 3;
            let ok = false;
            while (!ok && retries > 0) {
                try {
                    const res = await fetch(`${API_BASE_URL}/videos/upload/chunk`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    });
                    if (!res.ok) throw new Error(`Chunk ${i} failed`);
                    completedSet.add(i);
                    updateUpload(toastId, {
                        progress: Math.round((completedSet.size / totalChunks) * 100),
                        status: 'uploading',
                    });
                    ok = true;
                } catch (err) {
                    retries -= 1;
                    if (retries === 0) {
                        updateUpload(toastId, {
                            status: 'failed',
                            error: err.message || 'Upload failed',
                        });
                        throw err;
                    }
                    await new Promise((r) => setTimeout(r, (3 - retries) * 2000));
                }
            }
        }

        updateUpload(toastId, { progress: 100, status: 'queued' });

        const finalizeFormData = new FormData();
        finalizeFormData.append('upload_id', currentUploadId);
        finalizeFormData.append('total_chunks', totalChunks);
        finalizeFormData.append('filename', videoFile.name);

        const finalizeRes = await fetch(`${API_BASE_URL}/videos/upload/finalize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: finalizeFormData,
        });
        if (!finalizeRes.ok) {
            const errorData = await finalizeRes.json().catch(() => ({}));
            const msg = errorData.detail || 'Finalization failed';
            updateUpload(toastId, { status: 'failed', error: msg });
            throw new Error(msg);
        }

        const data = await finalizeRes.json();
        if (!data.job_id) {
            updateUpload(toastId, { status: 'failed', error: 'No job id returned' });
            throw new Error('Server did not return a job id');
        }

        updateUpload(toastId, {
            jobId: data.job_id,
            status: 'queued',
            progress: 100,
            processingKey: currentUploadId,
            videoId: null,
            error: null,
        });
    };

    const handlePostAll = async () => {
        if (postingBatch) return;
        const ready = batchVideos.every((v) => (videoDrafts[v.id]?.caption || '').trim().length > 0);
        if (!ready) return;

        setPostingBatch(true);
        try {
            for (const v of batchVideos) {
                const d = videoDrafts[v.id];
                const caption = d.caption.trim();
                let coverBlob = d.coverBlob;
                if (!coverBlob && d.coverUrl) {
                    coverBlob = dataUrlToBlob(d.coverUrl);
                }
                await uploadVideoItem({
                    file: v.file,
                    caption,
                    tags: d.tags || '',
                    coverBlob,
                    coverUrl: d.coverUrl || v.thumbnailUrl,
                });
            }
            showNotification('success', `${batchVideos.length} upload${batchVideos.length > 1 ? 's' : ''} started`);
            // Revoke blob covers we created
            Object.values(videoDrafts).forEach((d) => {
                if (d.coverUrl && d.coverUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(d.coverUrl);
                }
            });
            setSelectedVideos([]);
            setBatchVideos([]);
            setVideoDrafts({});
            setActiveVideoId(null);
            setStep('select');
            refreshUser();
        } catch (err) {
            showNotification('error', err.message || 'Batch upload failed');
        } finally {
            setPostingBatch(false);
        }
    };

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    const resetForRetry = () => {
        if (trackingJobId) removeUpload(trackingJobId);
        handledTerminalJobRef.current = null;
        trackingJobIdRef.current = null;
        setTrackingJobId(null);
        setUploadId(null);
        uploadIdRef.current = null;
        setIsPaused(false);
        setUploading(false);
        setDbVideoId(null);
    };

    const handleRetryAfterFailure = () => {
        resetForRetry();
        setTimeout(() => startUpload(), 0);
    };

    const uploadLoop = async (currentUploadId, completedSet, toastId) => {
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
                    if (toastId) {
                        updateUpload(toastId, { progress: overallProgress, status: 'uploading' });
                    }
                    chunkSuccess = true;
                } catch (err) {
                    console.error(`Chunk ${i} upload error, retries left: ${retries - 1}`, err);
                    retries--;
                    if (retries === 0) {
                        setIsPaused(true);
                        setUploading(false);
                        if (toastId) {
                            updateUpload(toastId, {
                                status: 'failed',
                                error: 'Network issue detected. Upload paused.',
                            });
                        }
                        showNotification("error", "Network issue detected. Upload paused. Click Resume to retry.");
                        return;
                    }
                    // Wait before retrying (exponential backoff: 2s, 4s)
                    const backoff = (3 - retries) * 2000;
                    await new Promise(resolve => setTimeout(resolve, backoff));
                }
            }
        }

        // Finalize: server saves to S3, enqueues Celery, returns job_id immediately.
        // Global useUploadStatus (via UploadNotifications) owns polling after this.
        if (toastId) {
            updateUpload(toastId, { progress: 100, status: 'queued' });
        }

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
            if (data.video_id) setDbVideoId(data.video_id);

            if (!data.job_id) {
                throw new Error('Server did not return a job id');
            }

            handledTerminalJobRef.current = null;
            trackingJobIdRef.current = data.job_id;
            // upload_id === Video.processing_key — used for live Redis/Rust progress polling
            const processingKey = currentUploadId;
            if (toastId) {
                updateUpload(toastId, {
                    jobId: data.job_id,
                    status: 'queued',
                    progress: 100,
                    videoId: null,
                    processingKey,
                    error: null,
                });
            } else {
                addUpload({
                    jobId: data.job_id,
                    fileName: file?.name || title || 'Video',
                    thumbnailUrl: thumbnailPreview || previewUrl,
                    progress: 100,
                    status: 'queued',
                    processingKey,
                    videoId: null,
                });
            }
            setTrackingJobId(data.job_id);
            setUploading(false);
        } catch (err) {
            console.error("Finalization error:", err);
            setUploading(false);
            setIsPaused(true);
            if (toastId) {
                updateUpload(toastId, {
                    status: 'failed',
                    error: err.message || 'Failed to finalize video upload.',
                });
            }
            showNotification("error", err.message || "Failed to finalize video upload.");
        }
    };

    const startUpload = async () => {
        if (uploading) return;
        setUploading(true);
        setIsPaused(false);

        let currentUploadId = uploadIdRef.current;
        let completedSet = new Set();

        // Progress lives in the store from the first byte — toast survives navigation
        let toastId = trackingJobId;
        if (!toastId) {
            toastId = `local-${crypto.randomUUID()}`;
            addUpload({
                jobId: toastId,
                fileName: file?.name || title || 'Video',
                thumbnailUrl: thumbnailPreview || previewUrl,
                progress: 0,
                status: 'uploading',
                error: null,
            });
            trackingJobIdRef.current = toastId;
            setTrackingJobId(toastId);
        } else {
            updateUpload(toastId, {
                status: 'uploading',
                error: null,
                progress: storeEntry?.progress || 0,
            });
        }

        if (!currentUploadId) {
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
                updateUpload(toastId, { status: 'failed', error: err.message });
                showNotification('error', err.message);
                return;
            }
        } else {
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
                showNotification('error', 'Failed to resume upload session. Retrying...');
                return;
            }
        }

        await uploadLoop(currentUploadId, completedSet, toastId);
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

        // Video uploads — idle only when nothing is tracked in the store
        if (!storeEntry && !uploading) {
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

        if (processingStatus === 'uploading' && !isPaused) {
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

        if (isPaused && (processingStatus === 'uploading' || processingStatus === 'error') && uploadId && jobStatus !== 'failed') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    <button
                        className="btn-primary"
                        onClick={startUpload}
                        style={{ width: '100%' }}
                    >
                        RESUME UPLOAD
                    </button>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Upload paused at {progress}%
                    </div>
                </div>
            );
        }

        if (processingStatus === 'processing' || isPolling) {
            return (
                <div className="btn-loading" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Loader2 className={s.spin} size={20} /> Processing your video…
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.75 }}>
                        {jobStatus === 'queued' ? 'Queued' : 'Transcoding'}
                    </span>
                </div>
            );
        }

        if (processingStatus === 'error' || jobStatus === 'failed') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    <div style={{ fontSize: '0.85rem', color: '#f87171', textAlign: 'center' }}>
                        {jobError || 'Processing failed'}
                    </div>
                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleRetryAfterFailure}>
                        RETRY UPLOAD
                    </button>
                </div>
            );
        }

        if (processingStatus === 'completed') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    <button
                        className="btn-primary"
                        style={{ width: '100%', background: '#4ade80', color: 'black' }}
                        onClick={() => router.push(jobVideoId || dbVideoId ? `/watch/${jobVideoId || dbVideoId}` : '/manage')}
                    >
                        WATCH VIDEO
                    </button>
                    <button className="btn-secondary" style={{ width: '100%' }} onClick={() => router.push('/manage')}>
                        GO TO DASHBOARD
                    </button>
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
                <div className={s.selectStage}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        hidden
                        multiple
                        accept="video/*,.mp4,.webm,.mov,.mkv,.m4v"
                        onChange={(e) => addFilesToSelection(e.target.files)}
                    />

                    {selectedVideos.length === 0 ? (
                        <div
                            className={s.dropzone}
                            onClick={() => !isPickingFiles && fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                addFilesToSelection(e.dataTransfer.files);
                            }}
                        >
                            <div className={s.pulse} style={{ marginBottom: '2rem' }}>
                                <UploadIcon size={64} color="var(--accent-primary)" />
                            </div>
                            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Upload Videos</h2>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Drag and drop or click to select one or more files
                            </p>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                                MP4, WebM, MOV up to {Math.round(MAX_VIDEO_BYTES / (1024 * 1024 * 1024))} GB each
                            </p>
                            <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-primary)' }}>
                                        {(user?.home_quota_limit ?? 0) - (user?.home_uploads ?? 0)}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HOME CREDITS</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                                        {(user?.flash_quota_limit ?? 0) - (user?.flash_uploads ?? 0)}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>FLASH CREDITS</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={s.selectPanel}>
                            <div className={s.selectHeader}>
                                <div>
                                    <h2 className={s.selectTitle}>Selected videos</h2>
                                    <p className={s.selectSub}>
                                        {validSelectedCount} ready
                                        {selectedVideos.length - validSelectedCount > 0
                                            ? ` · ${selectedVideos.length - validSelectedCount} with errors`
                                            : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className={`btn-primary ${s.selectHeaderNext}`}
                                    disabled={validSelectedCount < 1 || isPickingFiles}
                                    onClick={handleNextFromSelection}
                                >
                                    Next <ArrowRight size={18} style={{ marginLeft: 6 }} />
                                </button>
                            </div>

                            <div className={s.videoPickGrid}>
                                {selectedVideos.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`${s.videoPickCard} ${item.error ? s.videoPickCardError : ''}`}
                                    >
                                        <div className={s.videoPickThumb}>
                                            {item.thumbnailUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.thumbnailUrl} alt="" />
                                            ) : (
                                                <div className={s.videoPickFallback}>
                                                    <FileVideo size={28} />
                                                </div>
                                            )}
                                            {item.isValid && item.duration != null && (
                                                <span className={s.videoPickDuration}>
                                                    {formatDuration(item.duration)}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                className={s.videoPickRemove}
                                                aria-label={`Remove ${item.name}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeSelectedVideo(item.id);
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className={s.videoPickMeta}>
                                            <span className={s.videoPickName} title={item.name}>
                                                {item.name}
                                            </span>
                                            {item.error ? (
                                                <span className={s.videoPickError}>{item.error}</span>
                                            ) : (
                                                <span className={s.videoPickOk}>Ready</span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    className={s.videoPickAdd}
                                    disabled={isPickingFiles}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {isPickingFiles ? (
                                        <Loader2 className={s.spin} size={28} />
                                    ) : (
                                        <Plus size={28} />
                                    )}
                                    <span>{isPickingFiles ? 'Adding…' : 'Add more'}</span>
                                </button>
                            </div>

                            <div className={s.selectFooter}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setSelectedVideos([])}
                                >
                                    Clear all
                                </button>
                                <button
                                    type="button"
                                    className={`btn-primary ${s.selectFooterNext}`}
                                    disabled={validSelectedCount < 1 || isPickingFiles}
                                    onClick={handleNextFromSelection}
                                >
                                    Next <ArrowRight size={18} style={{ marginLeft: 6 }} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : uploadType === 'video' && step === 'batch-details' ? (
                <VideoBatchDetails
                    videos={batchVideos}
                    drafts={videoDrafts}
                    activeId={activeVideoId}
                    onActiveChange={setActiveVideoId}
                    onDraftChange={updateVideoDraft}
                    onBack={() => setStep('select')}
                    onPostAll={handlePostAll}
                    posting={postingBatch}
                    videoType={videoType}
                    onVideoTypeChange={setVideoType}
                />
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
                                {(processingStatus === 'uploading' || processingStatus === 'processing') && (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                        <div style={{ marginTop: '1rem', fontWeight: 900, fontSize: '1.25rem' }}>
                                            {processingStatus === 'uploading' ? `${progress}%` : 'Processing your video…'}
                                        </div>
                                        {processingStatus === 'processing' && jobStatus && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '0 1rem', textTransform: 'capitalize' }}>
                                                {jobStatus}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {processingStatus === 'completed' && (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}>
                                        <CheckCircle size={48} color="#4ade80" />
                                        <div style={{ marginTop: '0.75rem', fontWeight: 800 }}>Done</div>
                                    </div>
                                )}
                                {processingStatus === 'error' && (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: '1rem', textAlign: 'center' }}>
                                        <X size={40} color="#f87171" />
                                        <div style={{ marginTop: '0.75rem', fontWeight: 700, color: '#f87171' }}>Failed</div>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                            {jobError || 'Something went wrong'}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className={s.statusList}>
                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${progress > 0 || processingStatus === 'uploading' ? s.active : ''} ${progress === 100 || processingStatus === 'processing' || processingStatus === 'completed' ? s.completed : ''}`}>
                                        {progress === 100 || processingStatus === 'processing' || processingStatus === 'completed' ? <CheckCircle size={14} /> : 1}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Upload to Cloud</div>
                                        {processingStatus === 'uploading' && <div className={s.statusSub}>{progress}% uploaded</div>}
                                        {(processingStatus === 'processing' || processingStatus === 'completed') && <div className={s.statusSub}>Uploaded</div>}
                                    </div>
                                </div>

                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${processingStatus === 'processing' ? s.active : ''} ${processingStatus === 'completed' ? s.completed : ''} ${processingStatus === 'error' ? s.active : ''}`}>
                                        {processingStatus === 'completed' ? <CheckCircle size={14} /> : processingStatus === 'processing' ? <Loader2 className={s.spin} size={14} /> : 2}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Edge Transcoding</div>
                                        {processingStatus === 'processing' && (
                                            <div className={s.statusSub}>Processing your video…</div>
                                        )}
                                        {processingStatus === 'error' && (
                                            <div className={s.statusSub}>{jobError || 'Failed'}</div>
                                        )}
                                    </div>
                                </div>

                                <div className={s.statusItem}>
                                    <div className={`${s.statusDot} ${processingStatus === 'completed' ? s.completed : ''}`}>
                                        {processingStatus === 'completed' ? <CheckCircle size={14} /> : 3}
                                    </div>
                                    <div className={s.statusText}>
                                        <div className={s.statusTitle}>Global Distribution</div>
                                        {processingStatus === 'completed' && <div className={s.statusSub}>Live</div>}
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

                        {(processingStatus === 'completed' || processingStatus === 'error' || processingStatus === 'processing') && (
                            <div className="mobile-only" style={{ marginTop: '1rem' }}>
                                {renderActionButtons()}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Upload;
