import React, { useState, useRef } from 'react';
import {
    Layout,
    Image as ImageIcon,
    X,
    Send,
    Sparkles,
    Tag,
    AlignLeft,
    User,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const CreatePost = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const imageInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showNotification('error', "Only images are supported for posts.");
                return;
            }
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handlePublish = async () => {
        if (!content.trim()) {
            showNotification('error', "Post content cannot be empty.");
            return;
        }

        setIsPublishing(true);
        const notificationId = showNotification('loading', 'Publishing your post...');

        try {
            const formData = new FormData();
            formData.append('content', content);
            if (tags) formData.append('tags', tags);
            if (image) formData.append('image', image);

            const response = await fetch(`${API_BASE_URL}/posts/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                showNotification('success', 'Post published successfully!');
                navigate('/'); // Redirect to feed
            } else {
                const error = await response.json();
                showNotification('error', error.detail || "Failed to publish post.");
            }
        } catch (err) {
            console.error(err);
            showNotification('error', "Network error while publishing.");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#050505',
            color: 'white',
            padding: '2rem 1rem 8rem',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header */}
            <div style={{ maxWidth: '800px', margin: '0 auto 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        background: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Layout size={18} color="white" />
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 900 }}>Create Post</h1>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                    Cancel
                </button>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Composer Area */}
                <div className="glass" style={{
                    padding: 'clamp(1.5rem, 5vw, 2.5rem)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                }}>
                    {/* User Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {user?.profile_pic ? (
                                <img src={user.profile_pic} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User size={20} color="rgba(255,255,255,0.2)" />
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{user?.full_name || user?.username}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: '1px' }}>SHARING TO FEED</div>
                        </div>
                    </div>

                    {/* Content Input */}
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's happening?..."
                        style={{
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                            fontWeight: 500,
                            minHeight: '180px',
                            resize: 'none',
                            outline: 'none',
                            lineHeight: 1.5,
                            fontFamily: 'inherit',
                            padding: '0'
                        }}
                    />

                    {/* Image Preview */}
                    {imagePreview && (
                        <div style={{ position: 'relative', marginTop: '1.5rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
                            <button
                                onClick={() => { setImage(null); setImagePreview(null); }}
                                style={{
                                    position: 'absolute',
                                    top: '0.8rem',
                                    right: '0.8rem',
                                    background: 'rgba(0,0,0,0.6)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div style={{
                        marginTop: '2rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => imageInputRef.current.click()}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '44px',
                                    height: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: image ? 'var(--accent-primary)' : 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <ImageIcon size={20} />
                                <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={handleImageSelect} />
                            </button>
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '30px',
                                padding: '0 1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem'
                            }}>
                                <Tag size={16} opacity={0.3} />
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="Add tags..."
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        width: 'clamp(80px, 20vw, 150px)'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            disabled={!content.trim() || isPublishing}
                            onClick={handlePublish}
                            style={{
                                padding: '1rem 2.5rem',
                                borderRadius: '100px',
                                background: content.trim() ? 'white' : 'rgba(255,255,255,0.05)',
                                color: content.trim() ? 'black' : 'rgba(255,255,255,0.2)',
                                border: 'none',
                                fontWeight: 900,
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                cursor: content.trim() ? 'pointer' : 'default',
                                transition: 'all 0.3s ease',
                                flex: window.innerWidth < 600 ? 1 : 'none',
                                justifyContent: 'center'
                            }}
                        >
                            {isPublishing ? <Loader2 className="spin" size={18} /> : 'PUBLISH'} <Send size={18} />
                        </button>
                    </div>
                </div>

                {/* Guidelines Card */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem'
                }}>
                    <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}><Sparkles size={18} /></div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Be Creative</div>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Share updates about your latest edits or upcoming collaborations.</p>
                    </div>
                    <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ color: '#4ade80', marginBottom: '0.5rem' }}><CheckCircle2 size={18} /></div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.3rem' }}>Community First</div>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Keep it respectful and supportive of other creators.</p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .glass {
                    background: rgba(255, 255, 255, 0.02);
                    backdrop-filter: blur(10px);
                }
            `}} />
        </div>
    );
};

export default CreatePost;
