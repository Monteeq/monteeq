'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileHeader from '@/components/profile/ProfileHeader';
import TrophyBar from '@/components/profile/TrophyBar';
import ProfileTabs from '@/components/profile/ProfileTabs';
import FeaturedVideo from '@/components/profile/FeaturedVideo';
import FollowListModal from '@/components/profile/FollowListModal';
import { useAuth } from '@/context/AuthContext';
import { toggleFollow, getFollowers, getFollowing } from '@/lib/clientApi';
import styles from '@/styles/pages/Profile.module.css';

function VideoGridCard({ video, href }) {
  return (
    <Link href={href} className={styles.videoGridItem} style={{ textDecoration: 'none', color: 'inherit' }}>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ height: '100%' }}>
        <div
          style={{
            aspectRatio: '16/9',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg-raised)',
            position: 'relative',
          }}
        >
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt={video.title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
        </div>
        <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
          {video.title}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {(video.views || 0).toLocaleString()} views
        </div>
      </motion.div>
    </Link>
  );
}

/**
 * Interactive Profile shell — initial profile data comes from the Server Component.
 * Follow, share, tabs, and social modals stay client-side.
 */
export default function ProfileView({ profile: initialProfile }) {
  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const [profile, setProfile] = useState(initialProfile);
  const [isFollowing, setIsFollowing] = useState(!!initialProfile.is_following);
  const [activeTab, setActiveTab] = useState('videos');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', users: [] });

  const isOwnProfile = useMemo(
    () => currentUser?.username === profile?.username,
    [currentUser, profile]
  );

  const handleFollow = async () => {
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const res = await toggleFollow(profile.id, token);
      setIsFollowing(res.is_following);
      setProfile((prev) => ({
        ...prev,
        followers_count: res.is_following
          ? prev.followers_count + 1
          : Math.max(0, prev.followers_count - 1),
        is_following: res.is_following,
      }));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile/${profile.username}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.full_name || profile.username} on Monteeq`,
          text: `Check out @${profile.username}'s profile on Monteeq`,
          url: profileUrl,
        });
      } else {
        await navigator.clipboard.writeText(profileUrl);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };

  const handleMessage = (type) => {
    if (type === 'settings') {
      router.push('/settings');
    } else {
      router.push(`/chat?start=${encodeURIComponent(profile.username)}`);
    }
  };

  const showSocialModal = async (type) => {
    setModalConfig({
      isOpen: true,
      title: type === 'followers' ? 'Followers' : 'Following',
      users: [],
    });
    try {
      const data =
        type === 'followers'
          ? await getFollowers(profile.username)
          : await getFollowing(profile.username);
      setModalConfig((prev) => ({ ...prev, users: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error('Social data error:', err);
    }
  };

  const videos = profile.videos || [];
  const flashVideos = profile.flash_videos || [];
  const posts = profile.posts || [];
  const likedVideos = profile.liked_videos || [];

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
                {videos.length > 0 ? (
                  videos.map((v) => (
                    <VideoGridCard key={v.id} video={v} href={`/watch/${v.id}`} />
                  ))
                ) : (
                  <div className={styles.emptyState}>No videos yet</div>
                )}
              </div>
            )}

            {activeTab === 'flash' && (
              <div className={styles.flashGrid}>
                {flashVideos.length > 0 ? (
                  flashVideos.map((v) => (
                    <Link key={v.id} href={`/flash/${v.id}`} style={{ textDecoration: 'none' }}>
                      <motion.div
                        whileHover={{ scale: 1.05, zIndex: 10 }}
                        whileTap={{ scale: 0.95 }}
                        className={styles.glass}
                        style={{
                          aspectRatio: '2/3',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'block',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            background: 'rgba(0,0,0,0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {v.views || 0} views
                        </div>
                      </motion.div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}>No Flash clips yet</div>
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  maxWidth: '600px',
                  margin: '0 auto',
                }}
              >
                {posts.length > 0 ? (
                  posts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/post/${p.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={styles.glass}
                        style={{
                          padding: '2rem',
                          borderRadius: '32px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                        }}
                      >
                        <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1.1rem' }}>{p.content}</p>
                        {p.image_url && (
                          <div style={{ marginTop: '1.5rem', borderRadius: '20px', overflow: 'hidden' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.image_url} alt="" style={{ width: '100%', height: 'auto' }} />
                          </div>
                        )}
                      </motion.div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}>No posts yet</div>
                )}
              </div>
            )}

            {activeTab === 'likes' && (
              <div className={styles.videoGrid}>
                {likedVideos.length > 0 ? (
                  <>
                    {likedVideos.slice(0, 18).map((v) => (
                      <VideoGridCard key={v.id} video={v} href={`/watch/${v.id}`} />
                    ))}
                    {likedVideos.length > 18 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem' }}>
                        <Link href="/liked" className={styles.btnSecondary}>
                          See all {likedVideos.length} liked videos
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.emptyState}>No liked videos yet</div>
                )}
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
}
