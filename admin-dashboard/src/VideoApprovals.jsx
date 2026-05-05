import React, { useEffect, useState } from 'react';
import { getPendingVideos, updateVideoStatus, API_BASE_URL } from './api';
import { ShieldCheck, LogOut, CheckCircle, XCircle, ChevronLeft, Play, X, Info, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from './context/NotificationContext';
import AdminVideoPlayer from './AdminVideoPlayer';

const VideoApprovals = ({ token, setToken, theme, toggleTheme }) => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [previewVideo, setPreviewVideo] = useState(null);
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const data = await getPendingVideos(token);
                setVideos(data);
            } catch (err) {
                console.error("Failed to fetch videos", err);
                if (err.response && err.response.status === 401) {
                    handleLogout();
                } else {
                    showNotification('error', 'Failed to fetch pending videos');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchVideos();
    }, [token]);

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('adminToken');
        navigate('/');
    };

    const handleStatusUpdate = async (videoId, status) => {
        try {
            await updateVideoStatus(videoId, status, token);
            setVideos(videos.filter(v => v.id !== videoId));
            showNotification('success', `Video ${status} successfully`);
        } catch (err) {
            console.error("Failed to update video status", err);
            showNotification('error', 'Failed to update video status');
        }
    };




    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)', transition: 'background-color 0.3s ease' }}>
            <header style={{ 
                height: '72px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100
            }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--accent-soft)', padding: '8px', borderRadius: '12px' }}>
                            <ShieldCheck size={24} color="var(--accent)" />
                        </div>
                        <span className="jakarta" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Queue Manager</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                         {/* Theme Toggle */}
                         <button onClick={toggleTheme} className="btn btn-ghost" style={{ padding: '8px' }}>
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }}></div>

                        <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px' }}>
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <button onClick={() => navigate('/dashboard')} className="btn btn-outline">
                        <ChevronLeft size={16} /> Back to Dashboard
                    </button>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        PENDING: {loading ? "..." : videos.length}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                        <ShieldCheck size={48} className="animate-pulse" color="var(--accent)" />
                    </div>
                ) : videos.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', borderStyle: 'dashed', padding: '80px 24px', background: 'transparent' }}>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.1rem' }}>The submission queue is empty</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
                        {videos.map(video => (
                            <div key={video.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ height: '200px', background: 'black', position: 'relative', cursor: 'pointer' }} onClick={() => setPreviewVideo(video)}>
                                    {video.thumbnail_url ? (
                                        <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>— No Preview —</div>
                                    )}
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%', backdropFilter: 'blur(8px)', color: 'white' }}>
                                            <Play size={24} fill="currentColor" />
                                        </div>
                                    </div>
                                    <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.05em', color: 'white' }}>
                                        {video.video_type}
                                    </span>
                                </div>
                                <div style={{ padding: '24px' }}>
                                    <h3 className="jakarta" style={{ margin: '0 0 6px 0', fontSize: '1.125rem', fontWeight: 700 }}>{video.title}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>By <span style={{ color: 'var(--accent)', fontWeight: 700 }}>@{video.owner?.username || 'unknown'}</span></p>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={() => handleStatusUpdate(video.id, 'approved')} className="btn btn-primary" style={{ flex: 1, background: 'var(--success)' }}>
                                            <CheckCircle size={16} /> Pass
                                        </button>
                                        <button onClick={() => handleStatusUpdate(video.id, 'rejected')} className="btn btn-outline" style={{ flex: 1, color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                            <XCircle size={16} /> Fail
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {previewVideo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }} onClick={() => setPreviewVideo(null)}>
                    <div style={{ width: '100%', maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div>
                                <h1 className="jakarta" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: 0 }}>{previewVideo.title}</h1>
                                <p style={{ fontSize: '14px', color: '#b0b0b0' }}>Verifying submission from <span style={{ color: 'var(--accent)', fontWeight: 700 }}>@{previewVideo.owner?.username}</span></p>
                             </div>
                             <button onClick={() => setPreviewVideo(null)} className="btn btn-ghost" style={{ padding: '8px', color: 'white' }}><X size={24} /></button>
                        </div>
                        <div style={{ background: 'black', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {previewVideo.video_url ? (
                                <AdminVideoPlayer 
                                    src={previewVideo.video_url.startsWith('http') 
                                        ? `${API_BASE_URL}/videos/${previewVideo.id}/stream${previewVideo.video_url.endsWith('.m3u8') ? '/master.m3u8' : ''}` 
                                        : previewVideo.video_url
                                    }
                                    title={previewVideo.title}
                                    creator={previewVideo.owner?.username}
                                    poster={previewVideo.thumbnail_url}
                                    autoPlay={true}
                                />
                            ) : (
                                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <p>Video is still processing. Check back later.</p>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', marginRight: 'auto', alignItems: 'center', color: '#666' }}>
                                <Info size={18} />
                                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Verification System</span>
                            </div>
                            <button onClick={() => { handleStatusUpdate(previewVideo.id, 'rejected'); setPreviewVideo(null); }} className="btn btn-outline" style={{ color: 'var(--danger)', height: '44px', padding: '0 24px' }}>REJECT SUBMISSION</button>
                            <button onClick={() => { handleStatusUpdate(previewVideo.id, 'approved'); setPreviewVideo(null); }} className="btn btn-primary" style={{ background: 'var(--success)', height: '44px', padding: '0 24px' }}>APPROVE CONTENT</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoApprovals;
