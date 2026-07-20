'use client';

import { useEffect, useRef } from 'react';
import { getProcessingStatus, getUploadJob, isAbortOrNetworkError } from '@/lib/browserApi';
import { useAuth } from '@/context/AuthContext';
import { useUploadStore } from '@/stores/useUploadStore';

const DEFAULT_INTERVAL_MS = 2500;
const TERMINAL = new Set(['completed', 'failed']);
const POLLABLE = new Set(['queued', 'processing']);

/**
 * Poll upload/transcode job status and write results into useUploadStore.
 * Mount this from a global host (e.g. UploadNotifications) so polling survives
 * navigating away from the upload page.
 *
 * Network blips do NOT mark the upload as failed — only a server "failed"
 * status (or explicit job error) does.
 *
 * @param {string|null|undefined} jobId
 * @param {{ enabled?: boolean, intervalMs?: number, token?: string|null }} [options]
 */
export function useUploadStatus(jobId, options = {}) {
  const { token: authToken } = useAuth();
  const token = options.token ?? authToken;
  const enabled = options.enabled !== false;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const updateUpload = useUploadStore((s) => s.updateUpload);
  const entry = useUploadStore((s) =>
    jobId ? s.activeUploads.find((u) => u.jobId === jobId) || null : null
  );

  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const intervalRef = useRef(null);

  const isLocalId = typeof jobId === 'string' && jobId.startsWith('local-');
  const shouldPoll =
    Boolean(jobId) &&
    enabled &&
    Boolean(token) &&
    !isLocalId &&
    (!entry || POLLABLE.has(entry.status));

  useEffect(() => {
    cancelledRef.current = false;
    inFlightRef.current = false;

    const stop = () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!shouldPoll) {
      stop();
      return undefined;
    }

    const tick = async () => {
      if (cancelledRef.current || inFlightRef.current) return;

      const current = useUploadStore.getState().getUpload(jobId);
      if (current && TERMINAL.has(current.status)) {
        stop();
        return;
      }

      inFlightRef.current = true;
      try {
        const processingKey = current?.processingKey || null;
        let job = null;
        let live = null;

        try {
          job = await getUploadJob(jobId, token);
        } catch (err) {
          // Transient network / CORS / timeout — keep showing Processing, don't fail the toast
          if (!isAbortOrNetworkError(err) && err?.status && err.status >= 400 && err.status < 500 && err.status !== 408) {
            // Auth/not-found: surface once but still don't invent a server failure for 5xx
            if (err.status === 404 || err.status === 403) {
              updateUpload(jobId, {
                status: 'failed',
                error: err.message || 'Upload job not found',
              });
              stop();
              return;
            }
          }
          // Fall through — try processingKey status if we have it
        }

        if (processingKey) {
          try {
            live = await getProcessingStatus(processingKey, token);
          } catch {
            /* optional enrichment */
          }
        }

        if (cancelledRef.current) return;

        if (!job && !live) {
          // Both failed (likely offline) — stay in queued/processing
          return;
        }

        /** @type {Record<string, unknown>} */
        const updates = {};

        if (job) {
          const nextStatus = (job.status || '').toLowerCase() || null;
          if (nextStatus) {
            updates.status = nextStatus;
            updates.error = nextStatus === 'failed' ? (job.error_message ?? null) : null;
            if (job.video_id) updates.videoId = job.video_id;
            if (job.processing_key) updates.processingKey = job.processing_key;
            if (typeof job.progress === 'number') {
              updates.progress = Math.min(100, Math.max(0, job.progress));
            }
          }
        }

        if (live) {
          const liveStatus = (live.status || '').toLowerCase();
          const liveProgress =
            typeof live.progress === 'number' ? live.progress : null;

          if (liveProgress != null && updates.status !== 'completed') {
            // Map encode 0–100 into toast band above chunk upload
            updates.progress = Math.min(99, Math.max(updates.progress ?? 0, liveProgress));
          }

          // Prefer live Rust signal while job row may still say "queued"
          if (
            liveStatus === 'processing' &&
            (!updates.status || updates.status === 'queued')
          ) {
            updates.status = 'processing';
          }
          if (liveStatus === 'error' && updates.status !== 'completed') {
            updates.status = 'failed';
            updates.error = live.message || updates.error || 'Processing failed';
          }
        }

        if (updates.status === 'completed') {
          updates.progress = 100;
          updates.error = null;
        } else if (updates.status === 'processing' && updates.progress == null) {
          updates.progress = Math.max(95, current?.progress ?? 0);
        } else if (updates.status === 'queued' && updates.progress == null) {
          updates.progress = Math.max(92, current?.progress ?? 0);
        }

        if (Object.keys(updates).length) {
          updateUpload(jobId, updates);
        }

        const finalStatus = updates.status || current?.status;
        if (finalStatus && TERMINAL.has(finalStatus)) {
          stop();
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    tick();
    intervalRef.current = setInterval(tick, intervalMs);

    return () => {
      cancelledRef.current = true;
      stop();
    };
  }, [jobId, shouldPoll, token, intervalMs, updateUpload]);

  return {
    status: entry?.status ?? null,
    videoId: entry?.videoId ?? null,
    error: entry?.error ?? null,
    progress: entry?.progress ?? 0,
    isPolling: Boolean(shouldPoll && entry && POLLABLE.has(entry.status)),
  };
}
