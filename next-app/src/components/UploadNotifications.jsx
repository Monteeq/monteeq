'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getUploadJob } from '@/lib/browserApi';
import { useUploadStore } from '@/stores/useUploadStore';
import styles from './UploadNotifications.module.css';

const POLL_MS = 2500;
const MAX_NETWORK_RETRIES = 3;
const TERMINAL = new Set(['completed', 'failed']);
const POLLABLE = new Set(['queued', 'processing']);

function statusLabel(status, error) {
  switch (status) {
    case 'uploading':
      return 'Uploading...';
    case 'queued':
    case 'processing':
      return 'Processing...';
    case 'completed':
      return 'Ready!';
    case 'failed':
      return error || 'Upload failed';
    default:
      return 'Working...';
  }
}

function progressFor(status, progress) {
  if (status === 'completed') return 100;
  if (status === 'queued') return Math.max(progress || 0, 92);
  if (status === 'processing') return Math.max(progress || 0, 95);
  if (status === 'failed') return progress || 0;
  return Math.min(100, Math.max(0, progress || 0));
}

/** Polls server jobs so toast state survives leaving the upload page. */
function useGlobalUploadPoller() {
  const { token } = useAuth();
  const activeUploads = useUploadStore((s) => s.activeUploads);
  const updateUpload = useUploadStore((s) => s.updateUpload);
  const failsRef = useRef(/** @type {Record<string, number>} */ ({}));
  const inFlightRef = useRef(/** @type {Record<string, boolean>} */ ({}));

  const pollableIds = activeUploads
    .filter((u) => POLLABLE.has(u.status) && u.jobId && !String(u.jobId).startsWith('local-'))
    .map((u) => u.jobId)
    .sort()
    .join(',');

  useEffect(() => {
    if (!token || !pollableIds) return undefined;

    let cancelled = false;
    const ids = pollableIds.split(',').filter(Boolean);

    const tick = async () => {
      await Promise.all(
        ids.map(async (jobId) => {
          if (cancelled || inFlightRef.current[jobId]) return;
          inFlightRef.current[jobId] = true;
          try {
            const job = await getUploadJob(jobId, token);
            if (cancelled) return;
            failsRef.current[jobId] = 0;

            const nextStatus = (job?.status || '').toLowerCase();
            if (!nextStatus) return;

            const updates = {
              status: nextStatus,
              error: job?.error_message ?? null,
              videoId: job?.video_id ?? null,
            };
            if (nextStatus === 'completed') {
              updates.progress = 100;
              updates.error = null;
            } else if (nextStatus === 'processing') {
              updates.progress = Math.max(95, useUploadStore.getState().getUpload(jobId)?.progress ?? 0);
            } else if (nextStatus === 'queued') {
              updates.progress = Math.max(92, useUploadStore.getState().getUpload(jobId)?.progress ?? 0);
            }

            updateUpload(jobId, updates);
          } catch (err) {
            if (cancelled) return;
            failsRef.current[jobId] = (failsRef.current[jobId] || 0) + 1;
            if (failsRef.current[jobId] >= MAX_NETWORK_RETRIES) {
              updateUpload(jobId, {
                status: 'failed',
                error: err?.message || 'Lost connection while checking upload status',
              });
            }
          } finally {
            inFlightRef.current[jobId] = false;
          }
        })
      );
    };

    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, pollableIds, updateUpload]);
}

function UploadCard({ upload }) {
  const router = useRouter();
  const removeUpload = useUploadStore((s) => s.removeUpload);
  const canDismiss = TERMINAL.has(upload.status);
  const pct = progressFor(upload.status, upload.progress);
  const label = statusLabel(upload.status, upload.error);

  const onClickCard = () => {
    if (upload.status === 'completed' && upload.videoId) {
      router.push(`/watch/${upload.videoId}`);
    }
  };

  return (
    <motion.div
      layout
      className={styles.card}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className={styles.cardMain}
        onClick={onClickCard}
        disabled={upload.status !== 'completed' || !upload.videoId}
      >
        <div className={styles.thumb}>
          {upload.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={upload.thumbnailUrl} alt="" />
          ) : (
            <div className={styles.thumbFallback} />
          )}
          {upload.status === 'completed' && (
            <span className={styles.thumbBadge}>
              <CheckCircle2 size={14} />
            </span>
          )}
          {upload.status === 'failed' && (
            <span className={`${styles.thumbBadge} ${styles.thumbBadgeError}`}>
              <AlertCircle size={14} />
            </span>
          )}
        </div>

        <div className={styles.meta}>
          <div className={styles.row}>
            <span className={styles.fileName} title={upload.fileName}>
              {upload.fileName}
            </span>
            {(upload.status === 'uploading' ||
              upload.status === 'queued' ||
              upload.status === 'processing') && (
              <Loader2 className={styles.spin} size={14} />
            )}
          </div>
          <span
            className={`${styles.statusText} ${
              upload.status === 'failed'
                ? styles.statusError
                : upload.status === 'completed'
                  ? styles.statusReady
                  : ''
            }`}
          >
            {label}
          </span>
          <div className={styles.progressTrack} aria-hidden>
            <div
              className={`${styles.progressFill} ${
                upload.status === 'failed'
                  ? styles.progressFail
                  : upload.status === 'completed'
                    ? styles.progressDone
                    : ''
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {canDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss"
          onClick={() => removeUpload(upload.jobId)}
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  );
}

export default function UploadNotifications() {
  useGlobalUploadPoller();
  const activeUploads = useUploadStore((s) => s.activeUploads);

  if (!activeUploads.length) return null;

  return (
    <div className={styles.stack} aria-label="Upload progress">
      <AnimatePresence initial={false}>
        {activeUploads.map((upload) => (
          <UploadCard key={upload.jobId} upload={upload} />
        ))}
      </AnimatePresence>
    </div>
  );
}
