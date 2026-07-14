'use client';

import React from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import styles from '@/styles/pages/Profile.module.css';

export default function FollowListModal({ title, users, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modal} ${styles.glass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button type="button" className={styles.btnIcon} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalContent}>
          {users.length > 0 ? (
            users.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className={styles.userCard}
                onClick={onClose}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className={styles.userAvatar}>
                  {user.profile_pic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.profile_pic}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={styles.userMeta}>
                  <div className={styles.userName}>{user.full_name || user.username}</div>
                  <div className={styles.userHandle}>@{user.username}</div>
                </div>
                <span className={styles.btnSecondary} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                  View
                </span>
              </Link>
            ))
          ) : (
            <div className={styles.emptyState}>No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
