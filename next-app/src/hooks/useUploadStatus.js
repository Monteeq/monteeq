'use client';

import { useEffect, useRef, useState } from 'react';
import { getUploadJob } from '@/lib/browserApi';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_INTERVAL_MS = 2500;
const MAX_NETWORK_RETRIES = 3;
const TERMINAL = new Set(['completed', 'failed']);

/**
 * Poll upload/transcode job status until completed or failed.
 *
 * Uses GET /api/v1/videos/upload/jobs/{job_id}.
 *
 * @param {string|null|undefined} jobId
 * @param {{ enabled?: boolean, intervalMs?: number, token?: string|null }} [options]
 * @returns {{ status: string|null, videoId: string|null, error: string|null, isPolling: boolean }}
 */
export function useUploadStatus(jobId, options = {}) {
  const { token: authToken } = useAuth();
  const token = options.token ?? authToken;
  const enabled = options.enabled !== false;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const [status, setStatus] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const networkFailsRef = useRef(0);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    cancelledRef.current = false;
    networkFailsRef.current = 0;
    inFlightRef.current = false;

    const stop = () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };

    if (!jobId || !enabled || !token) {
      stop();
      return undefined;
    }

    setStatus(null);
    setVideoId(null);
    setError(null);
    setIsPolling(true);

    const tick = async () => {
      if (cancelledRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const job = await getUploadJob(jobId, token);
        if (cancelledRef.current) return;

        networkFailsRef.current = 0;
        const nextStatus = (job?.status || '').toLowerCase() || null;
        setStatus(nextStatus);
        setVideoId(job?.video_id ?? null);
        setError(job?.error_message ?? null);

        if (nextStatus && TERMINAL.has(nextStatus)) {
          stop();
        }
      } catch (err) {
        if (cancelledRef.current) return;
        networkFailsRef.current += 1;
        if (networkFailsRef.current >= MAX_NETWORK_RETRIES) {
          setStatus('failed');
          setError(err?.message || 'Lost connection while checking upload status');
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
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, enabled, token, intervalMs]);

  return { status, videoId, error, isPolling };
}
