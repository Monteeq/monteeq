'use client';

import React from 'react';
import { Eye, Heart, Play, Star, Pin } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import styles from '@/styles/pages/Profile.module.css';

export default function FeaturedVideo({ video, isPinned }) {
  if (!video) return null;

  return (
    <section className={styles.featuredSection}>
      <div className={styles.featuredHeader}>
        {isPinned ? (
          <Pin size={14} fill="#eb0000" color="#eb0000" />
        ) : (
          <Star size={14} fill="#FFD700" color="#FFD700" />
        )}
        {isPinned ? 'Pinned Spotlight' : 'Most Popular'}
      </div>

      <Link href={`/watch/${video.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <motion.div className={styles.featuredCard} whileTap={{ scale: 0.98 }}>
          <div className={styles.featuredPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail_url} alt="" className={styles.featuredMedia} />
            <div className={styles.featuredOverlay} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              <div
                className="vc-play-indicator"
                style={{ width: '60px', height: '60px', background: 'rgba(235, 0, 0, 0.9)' }}
              >
                <Play size={24} fill="white" />
              </div>
            </div>
          </div>

          <div className={styles.featuredInfo}>
            <div className={styles.featuredTag}>{isPinned ? 'FEATURED' : 'TRENDING'}</div>
            <h2 className={styles.featuredTitle}>{video.title || 'Untitled Masterpiece'}</h2>

            <div className={styles.featuredStats}>
              <div className={styles.featuredStat}>
                <Eye size={18} />
                <span>{(video.views || 0).toLocaleString()} Views</span>
              </div>
              <div className={styles.featuredStat}>
                <Heart size={18} />
                <span>{(video.likes_count || 0).toLocaleString()} Likes</span>
              </div>
            </div>

            <span className={styles.btnPrimary} style={{ width: 'fit-content', padding: '0.8rem 2rem', display: 'inline-block' }}>
              Watch Now
            </span>
          </div>
        </motion.div>
      </Link>
    </section>
  );
}
