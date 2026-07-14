'use client';

import React from 'react';
import { CheckCircle, MessageSquare, Share2, Eye, Heart } from 'lucide-react';
import StatCounter from './StatCounter';
import styles from '@/styles/pages/Profile.module.css';

export default function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  onFollow,
  onMessage,
  onShare,
  onShowFollowers,
  onShowFollowing,
}) {
  const stats = [
    { label: 'Followers', value: profile.followers_count, onClick: onShowFollowers },
    { label: 'Following', value: profile.following_count, onClick: onShowFollowing },
    { label: 'Likes', value: profile.total_likes, icon: <Heart size={12} /> },
    { label: 'Views', value: profile.total_views, icon: <Eye size={12} /> },
  ];

  return (
    <header className={`${styles.header} ${styles.glass}`}>
      <div className={styles.avatarWrapper}>
        <div className={`${styles.avatarRing} ${profile.is_verified ? styles.verified : ''}`}>
          <div className={styles.avatarInner}>
            {profile.profile_pic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profile_pic} alt={profile.username} className={styles.avatarImg} />
            ) : (
              <div className="avatar-placeholder" style={{ width: '100%', height: '100%', fontSize: '4rem' }}>
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {profile.is_verified && (
          <div className={styles.verifiedBadge} title="Verified Creator">
            <CheckCircle size={20} fill="white" color="#0084ff" />
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h1 className={styles.fullName}>{profile.full_name || `@${profile.username}`}</h1>
          <span className={styles.username}>@{profile.username}</span>
        </div>

        {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

        <div className={styles.statsGrid}>
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className={styles.statItem}
              onClick={stat.onClick}
              onKeyDown={stat.onClick ? (e) => e.key === 'Enter' && stat.onClick() : undefined}
              role={stat.onClick ? 'button' : undefined}
              tabIndex={stat.onClick ? 0 : undefined}
              style={{ cursor: stat.onClick ? 'pointer' : 'default' }}
            >
              <span className={styles.statValue}>
                <StatCounter value={stat.value} />
              </span>
              <span className={styles.statLabel}>
                {stat.icon} {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          {isOwnProfile ? (
            <>
              <button type="button" className={styles.btnSecondary} onClick={() => onMessage('settings')}>
                Edit Profile
              </button>
              <button type="button" className={styles.btnIcon} onClick={onShare}>
                <Share2 size={20} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={isFollowing ? styles.btnSecondary : styles.btnPrimary}
                onClick={onFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button type="button" className={styles.btnSecondary} onClick={onMessage}>
                <MessageSquare size={20} />
                <span>Message</span>
              </button>
              <button type="button" className={styles.btnIcon} onClick={onShare}>
                <Share2 size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
