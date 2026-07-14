'use client';

import React from 'react';
import { Trophy, Star } from 'lucide-react';
import styles from '@/styles/pages/Profile.module.css';

export default function TrophyBar({ trophies, onTrophyClick }) {
  if (!trophies || trophies.length === 0) return null;

  return (
    <section className={styles.trophySection}>
      <h2 className={styles.trophyTitle}>
        <Trophy size={18} color="#FFD700" />
        Trophy Room
      </h2>
      <div className={styles.trophyContainer}>
        {trophies.map((trophy, index) => (
          <div
            key={trophy.id || index}
            className={styles.trophyCard}
            onClick={() => onTrophyClick?.(trophy)}
            onKeyDown={(e) => e.key === 'Enter' && onTrophyClick?.(trophy)}
            role={onTrophyClick ? 'button' : undefined}
            tabIndex={onTrophyClick ? 0 : undefined}
          >
            <div className={styles.trophyIcon}>
              <Star size={32} fill="white" color="white" />
            </div>
            <span className={styles.trophyLabel}>{trophy.challenge?.title || 'Challenge Winner'}</span>
            <span className={styles.trophyMeta}>🥇 1st Place</span>
          </div>
        ))}
      </div>
    </section>
  );
}
