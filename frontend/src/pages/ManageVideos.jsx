import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Film, Zap, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, deleteVideo } from '../api';
import { useNotification } from '../context/NotificationContext';
import { ManageSkeleton } from '../components/Skeleton';

const ManageVideos = () => {
    const { user, token } = useAuth();
    const { showNotification } = useNotification();
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchVideos = async () => {
            if (!user) return;
            try {
                const profile = await getUserProfile(user.username, token);
                // Combine home and flash videos
                const allVideos = [
                    ...(profile.videos || []).map(v => ({ ...v, type: 'home' })),
                    ...(profile.flash_videos || []).map(v => ({ ...v, type: 'flash' }))
                ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                setVideos(allVideos);
            } catch (err) {
                console.error("Error fetching videos:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchVideos();
    }, [user, token]);

    const handleDelete = async () => {
        if (!showDeleteConfirm) return;
        setIsDeleting(true);
        try {
            await deleteVideo(showDeleteConfirm, token);
            setVideos(videos.filter(v => v.id !== showDeleteConfirm));
            setShowDeleteConfirm(null);
            showNotification('success', 'Video deleted successfully');
        } catch (err) {
            console.error("Error deleting video:", err);
            showNotification('error', "Failed to delete video");
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <ManageSkeleton />;

    return (
        <div className="manage-videos-page page-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="manage-header" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
                <button
                    onClick={() => navigate('/upload')}
                    className="glass"
                    style={{
                        width: '45px', height: '45px', borderRadius: '50%', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Manage Content</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>View and manage your uploaded videos</p>
                </div>
            </div>

            <div className="videos-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {videos.length === 0 ? (
                    <div className="glass" style={{ padding: '4rem', textAlign: 'center', borderRadius: '24px' }}>
                        <Film size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <h3>No videos found</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>You haven't uploaded any content yet.</p>
                        <button
                            className="hero-btn"
                            style={{ marginTop: '2rem', marginInline: 'auto' }}
                            onClick={() => navigate('/upload')}
                        >
                            Upload Now
                        </button>
                    </div>
                ) : (
                    videos.map(video => (
                        <div key={video.id} className="video-management-card glass hover-scale"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem',
                                borderRadius: '16px', transition: 'var(--transition-smooth)'
                            }}
                        >
                            <div className="card-thumb" style={{ width: '120px', height: '68px', borderRadius: '12px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{
                                    position: 'absolute', top: '5px', right: '5px',
                                    background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem'
                                }}>
                                    {video.type === 'flash' ? <Zap size={10} fill="#ff3e3e" /> : video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'HD'}
                                </div>
                            </div>
                            <div className="card-info" style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>{video.title}</h3>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>{video.views} views</span>
                                    <span>•</span>
                                    <span style={{ textTransform: 'capitalize' }}>{video.video_type} Video</span>
                                </div>
                            </div>
                            <button
                                className="delete-btn"
                                onClick={() => setShowDeleteConfirm(video.id)}
                                style={{
                                    background: 'rgba(255, 62, 62, 0.1)', color: '#ff3e3e', border: 'none',
                                    width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ff3e3e'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 62, 62, 0.1)'; e.currentTarget.style.color = '#ff3e3e'; }}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div className="glass" style={{
                        maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '24px', textAlign: 'center'
                    }}>
                        <div style={{
                            width: '60px', height: '60px', background: 'rgba(255, 62, 62, 0.1)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem', color: '#ff3e3e'
                        }}>
                            <AlertTriangle size={30} />
                        </div>
                        <h2 style={{ marginBottom: '1rem' }}>Delete Video?</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                            This action cannot be undone. This video will be permanently removed from Monteeq.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="glass" style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', cursor: 'pointer' }} onClick={() => setShowDeleteConfirm(null)}>
                                Cancel
                            </button>
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
        </div>
    );
};

export default ManageVideos;
