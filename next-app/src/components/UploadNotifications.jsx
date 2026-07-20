'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Loader2, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUploadStatus } from '@/hooks/useUploadStatus';
import { useUploadStore } from '@/stores/useUploadStore';
import styles from './UploadNotifications.module.css';

const TERMINAL = new Set(['completed', 'failed']);
const POLLABLE = new Set(['queued', 'processing']);
const COLLAPSE_THRESHOLD = 4;

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
  if (status === 'processing') return Math.max(progress || 0, 15);
  if (status === 'failed') return progress || 0;
  return Math.min(100, Math.max(0, progress || 0));
}

/** One poller per server job — lives in the global toast host, not the upload page. */
function UploadJobPoller({ jobId }) {
  useUploadStatus(jobId);
  return null;
}

function UploadCard({ upload }) {
  const router = useRouter();
  const removeUpload = useUploadStore((s) => s.removeUpload);
  const isTerminal = TERMINAL.has(upload.status);
  const pct = progressFor(upload.status, upload.progress);
  const label = statusLabel(upload.status, upload.error);

  const onClickCard = () => {
    if (upload.status === 'completed' && upload.videoId) {
      router.push(`/watch/${upload.videoId}`);
    }
  };

  const onCancelOrDismiss = (e) => {
    e.stopPropagation();
    // Hides the toast. In-flight server work may continue; X is always available.
    removeUpload(upload.jobId);
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
            {!isTerminal && typeof upload.progress === 'number' && upload.progress > 0 && (
              <span className={styles.pct}> {Math.round(pct)}%</span>
            )}
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

      <button
        type="button"
        className={styles.dismiss}
        aria-label={isTerminal ? 'Dismiss' : 'Cancel'}
        title={isTerminal ? 'Dismiss' : 'Cancel'}
        onClick={onCancelOrDismiss}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

function UploadSummary({ uploads, expanded, onToggle }) {
  const uploading = uploads.filter((u) => !TERMINAL.has(u.status)).length;
  const done = uploads.filter((u) => u.status === 'completed').length;
  const avg =
    uploads.length === 0
      ? 0
      : Math.round(
          uploads.reduce((sum, u) => sum + progressFor(u.status, u.progress), 0) /
            uploads.length
        );

  const uploadingLabel =
    uploading === 1 ? '1 video uploading' : `${uploading} videos uploading`;

  return (
    <motion.div
      layout
      className={styles.summary}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <button
        type="button"
        className={styles.summaryMain}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse upload list' : 'Expand upload list'}
      >
        <div className={styles.summaryMeta}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryTitle}>
              {uploadingLabel}, {done} done
            </span>
            {(uploading > 0) && <Loader2 className={styles.spin} size={14} />}
          </div>
          <div className={styles.progressTrack} aria-hidden>
            <div className={styles.progressFill} style={{ width: `${avg}%` }} />
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`${styles.summaryChevron} ${expanded ? styles.summaryChevronOpen : ''}`}
        />
      </button>
    </motion.div>
  );
}

export default function UploadNotifications() {
  const activeUploads = useUploadStore((s) => s.activeUploads);
  const [expanded, setExpanded] = useState(false);

  const count = activeUploads.length;
  const useSummary = count >= COLLAPSE_THRESHOLD;

  // Auto-collapse when the batch shrinks back to 3 or fewer
  useEffect(() => {
    if (count < COLLAPSE_THRESHOLD) {
      setExpanded(false);
    }
  }, [count]);

  const pollJobIds = activeUploads
    .filter(
      (u) =>
        u.jobId &&
        !String(u.jobId).startsWith('local-') &&
        POLLABLE.has(u.status)
    )
    .map((u) => u.jobId);

  const showIndividualCards = !useSummary || expanded;

  return (
    <>
      {pollJobIds.map((jobId) => (
        <UploadJobPoller key={jobId} jobId={jobId} />
      ))}

      {count > 0 && (
        <div className={styles.stack} aria-label="Upload progress">
          <AnimatePresence initial={false}>
            {useSummary && (
              <UploadSummary
                key="upload-summary"
                uploads={activeUploads}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
              />
            )}
            {showIndividualCards &&
              activeUploads.map((upload) => (
                <UploadCard key={upload.jobId} upload={upload} />
              ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
