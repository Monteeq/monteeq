import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserProfile, toggleFollow, getFollowers, getFollowing } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ProfileHeaderSkeleton, VideoSkeleton, TabsSkeleton, FeaturedSkeleton } from '../components/Skeleton';
import VideoPreviewCard from '../components/VideoPreviewCard';

// Modular Components
import ProfileHeader from '../components/profile/ProfileHeader';
import TrophyBar from '../components/profile/TrophyBar';
import ProfileTabs from '../components/profile/ProfileTabs';
import FeaturedVideo from '../components/profile/FeaturedVideo';
import FollowListModal from '../components/profile/FollowListModal';
import Footer from '../components/Footer';

import styles from './Profile.module.css';

const Profile = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const { token, user: currentUser } = useAuth();
    const { showNotification } = useNotification();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('videos');
    const [isFollowing, setIsFollowing] = useState(false);
    
    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', users: [] });
    const [loadingSocial, setLoadingSocial] = useState(false);

    // ──────────────────────────────────────────────────────────────────────────
    // Data Fetching
    // ──────────────────────────────────────────────────────────────────────────
    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getUserProfile(username, token);
            setProfile(data);
            setIsFollowing(data.is_following);
        } catch (err) {
            console.error("Profile error:", err);
            showNotification('error', err?.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [username, token, showNotification]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    // ──────────────────────────────────────────────────────────────────────────
    // Handlers
    // ──────────────────────────────────────────────────────────────────────────
    const handleFollow = async () => {
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const res = await toggleFollow(profile.id, token);
            setIsFollowing(res.is_following);
            setProfile(prev => ({
                ...prev,
                followers_count: res.is_following ? prev.followers_count + 1 : prev.followers_count - 1
            }));
        } catch (err) {
            console.error("Follow error:", err);
            showNotification('error', err?.message || 'Follow action failed');
        }
    };

    const handleShare = async () => {
        const profileUrl = `${window.location.origin}/profile/${username}`;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `${profile?.full_name || username} on Monteeq`,
                    text: `Check out @${username}'s profile on Monteeq`,
                    url: profileUrl
                });
            } else {
                await navigator.clipboard.writeText(profileUrl);
                showNotification('success', 'Profile link copied!');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                showNotification('error', err?.message || 'Failed to share profile');
            }
        }
    };

    const handleMessage = (type) => {
        if (type === 'settings') {
            navigate('/settings');
        } else {
            navigate('/chat', { state: { startChatWith: profile.username } });
        }
    };

    const showSocialModal = async (type) => {
        setLoadingSocial(true);
        setModalConfig({ isOpen: true, title: type === 'followers' ? 'Followers' : 'Following', users: [] });
        try {
            const data = type === 'followers' ? await getFollowers(username) : await getFollowing(username);
            setModalConfig(prev => ({ ...prev, users: data }));
        } catch (err) {
            console.error("Social data error:", err);
        } finally {
            setLoadingSocial(false);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // Render Helpers
    // ──────────────────────────────────────────────────────────────────────────
    const isOwnProfile = useMemo(() => currentUser?.username === profile?.username, [currentUser, profile]);

    if (loading) return (
        <div className={styles.profilePage}>
            <ProfileHeaderSkeleton />
            <FeaturedSkeleton />
            <TabsSkeleton />
            <div className={styles.videoGrid} style={{ marginTop: '2rem' }}>
                {[...Array(6)].map((_, i) => <VideoSkeleton key={i} />)}
            </div>
        </div>
    );

    if (!profile) return (
        <div className={styles.emptyState}>
            <h2>User not found</h2>
            <button className={styles.btnSecondary} onClick={() => navigate('/home')}>Return Home</button>
        </div>
    );

    return (
        <div className={styles.profilePage}>
            <ProfileHeader 
                profile={profile}
                isOwnProfile={isOwnProfile}
                isFollowing={isFollowing}
                onFollow={handleFollow}
                onMessage={handleMessage}
                onShare={handleShare}
                onShowFollowers={() => showSocialModal('followers')}
                onShowFollowing={() => showSocialModal('following')}
            />

            <TrophyBar trophies={profile.trophies} />

            {profile.featured_video && (
                <FeaturedVideo 
                    video={profile.featured_video} 
                    isPinned={profile.featured_video.id === profile.pinned_video_id}
                    onClick={() => navigate(`/watch/${profile.featured_video.id}`)}
                />
            )}

            <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className={styles.contentArea}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.35, ease: 'circOut' }}
                    >
                        {activeTab === 'videos' && (
                            <div className={styles.videoGrid}>
                                {profile.videos.length > 0 ? profile.videos.map(v => (
                                    <motion.div 
                                        key={v.id} 
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={styles.videoGridItem}
                                    >
                                        <VideoPreviewCard
                                            video={{...v, owner: profile}}
                                            onClick={() => navigate(`/watch/${v.id}`)}
                                        />
                                    </motion.div>
                                )) : <div className={styles.emptyState}>No videos yet</div>}
                            </div>
                        )}

                        {activeTab === 'flash' && (
                            <div className={styles.flashGrid}>
                                {profile.flash_videos.length > 0 ? profile.flash_videos.map(v => (
                                    <motion.div 
                                        key={v.id} 
                                        whileHover={{ scale: 1.05, zIndex: 10 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={styles.glass} 
                                        style={{ aspectRatio: '2/3', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                                        onClick={() => navigate('/flash')}
                                    >
                                        <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '10px',
                                            left: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'white',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                            {v.views || 0}
                                        </div>
                                    </motion.div>
                                )) : <div className={styles.emptyState}>No Flash clips yet</div>}
                            </div>
                        )}

                        {activeTab === 'posts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
                                {profile.posts.length > 0 ? profile.posts.map(p => (
                                    <motion.div 
                                        key={p.id} 
                                        whileHover={{ scale: 1.02 }}
                                        className={styles.glass} 
                                        style={{ padding: '2rem', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.08)' }}
                                    >
                                        <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1.1rem' }}>{p.content}</p>
                                        {p.image_url && (
                                            <div style={{ marginTop: '1.5rem', borderRadius: '20px', overflow: 'hidden' }}>
                                                <img src={p.image_url} alt="" style={{ width: '100%', height: 'auto' }} />
                                            </div>
                                        )}
                                    </motion.div>
                                )) : <div className={styles.emptyState}>No posts yet</div>}
                            </div>
                        )}

                        {activeTab === 'likes' && (
                            <div className={styles.videoGrid}>
                                {profile.liked_videos && profile.liked_videos.length > 0 ? profile.liked_videos.map(v => (
                                    <motion.div 
                                        key={v.id} 
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={styles.videoGridItem}
                                    >
                                        <VideoPreviewCard
                                            video={v}
                                            onClick={() => navigate(`/watch/${v.id}`)}
                                        />
                                    </motion.div>
                                )) : <div className={styles.emptyState}>No liked videos yet</div>}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {modalConfig.isOpen && (
                <FollowListModal 
                    title={modalConfig.title}
                    users={modalConfig.users}
                    onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                />
            )}
        </div>
    );
};

export default Profile;
