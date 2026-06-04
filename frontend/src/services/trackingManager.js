/**
 * trackingManager.js  (Production-hardened)
 * ──────────────────────────────────────────
 * Recommendation-aware interaction tracker.
 *
 * Production features:
 *  ✓ Retry with exponential back-off (3 attempts)
 *  ✓ localStorage offline queue — survives crashes, tab closes, reboots
 *  ✓ Online/offline detection — batches held when offline, flushed on reconnect
 *  ✓ Deduplication — same (video_id + session_key) never sent twice
 *  ✓ Slow-network adaptation — fewer parallel requests on 2G/3G
 *  ✓ keepalive: true — reliable delivery on page unload (mobile)
 *  ✓ UI never blocks — every network call is fully async
 */

import { API_BASE_URL } from '../api';

// ── Constants ────────────────────────────────────────────────────────────────
const BATCH_INTERVAL_MS   = 8_000;    // flush every 8 seconds
const BATCH_SIZE_THRESHOLD = 5;       // or when queue has this many events
const SKIP_THRESHOLD_S    = 2.0;      // watch_time < 2 s = fast skip
const MAX_RETRIES         = 3;        // per-event retry attempts
const RETRY_BASE_MS       = 1_000;    // back-off: 1 s, 2 s, 4 s
const LS_KEY              = 'monteeq_track_queue'; // localStorage key
const MAX_LS_EVENTS       = 100;      // cap offline queue to avoid storage bloat
const REQUEST_TIMEOUT_MS  = 8_000;    // give up on a single POST after 8 s

class TrackingManager {
    constructor() {
        /** In-memory queue (active session) */
        this._queue = [];

        /** @type {string|null} */
        this._token = null;

        /** Tracks open watch sessions: videoId → { startTime, videoDuration, liked, replayed, sessionKey } */
        this._sessions = new Map();

        /** Set of session keys already enqueued (dedup guard) */
        this._sentKeys = new Set();

        /** setTimeout handle for batch flush */
        this._timer = null;

        /** Whether a flush is already in progress */
        this._flushing = false;

        this._loadOfflineQueue();
        this._setupNetworkListeners();
        this._setupUnloadListeners();
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    setToken(token) {
        this._token = token;
        // If we just got a token and have a queued offline backlog, attempt a flush
        if (token && navigator.onLine) this._flush();
    }

    // ── Network helpers ───────────────────────────────────────────────────────

    _isSlowNetwork() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return false;
        return ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
    }

    _setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.debug('[TrackingManager] Back online — flushing offline queue');
            this._loadOfflineQueue();
            this._flush();
        });
    }

    // ── localStorage offline queue ────────────────────────────────────────────

    _loadOfflineQueue() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (Array.isArray(saved) && saved.length > 0) {
                // Merge into in-memory queue, deduplicating by sessionKey
                const merged = [...saved, ...this._queue];
                const seen = new Set();
                this._queue = merged.filter(e => {
                    if (seen.has(e._sessionKey)) return false;
                    seen.add(e._sessionKey);
                    return true;
                });
                localStorage.removeItem(LS_KEY);
                console.debug('[TrackingManager] Restored', saved.length, 'events from localStorage');
            }
        } catch {
            // Storage unavailable or corrupt — start fresh
        }
    }

    _persistOfflineQueue() {
        try {
            const toSave = this._queue.slice(-MAX_LS_EVENTS);
            localStorage.setItem(LS_KEY, JSON.stringify(toSave));
        } catch {
            // Quota exceeded or private-browsing restriction — silently skip
        }
    }

    // ── Session lifecycle ─────────────────────────────────────────────────────

    /**
     * Call when a video becomes the active (visible) one.
     * @param {number} videoId
     * @param {number} videoDurationSeconds
     */
    startSession(videoId, videoDurationSeconds = 0) {
        // A unique key per session instance (video + start time)
        const sessionKey = `${videoId}_${Math.round(performance.now())}`;
        this._sessions.set(videoId, {
            startTime: performance.now(),
            videoDuration: videoDurationSeconds,
            liked: false,
            replayed: false,
            sessionKey,
        });
    }

    /**
     * Call when a video becomes inactive (user scrolled away / tab hidden).
     * @param {number} videoId
     */
    endSession(videoId) {
        const session = this._sessions.get(videoId);
        if (!session) return;
        this._sessions.delete(videoId);

        // Dedup: skip if this exact session was already enqueued
        if (this._sentKeys.has(session.sessionKey)) return;
        this._sentKeys.add(session.sessionKey);

        // Cap sentKeys size to avoid memory leak over long sessions
        if (this._sentKeys.size > 500) {
            const first = this._sentKeys.values().next().value;
            this._sentKeys.delete(first);
        }

        const watch_time_s = (performance.now() - session.startTime) / 1000;
        const skipped = watch_time_s < SKIP_THRESHOLD_S;

        this._enqueue({
            video_id: videoId,
            watch_time: parseFloat(watch_time_s.toFixed(3)),
            duration: parseFloat((session.videoDuration || 0).toFixed(3)),
            liked: session.liked,
            skipped,
            replayed: session.replayed,
            timestamp: new Date().toISOString(),
            _sessionKey: session.sessionKey, // internal dedup key, stripped before sending
        });
    }

    markLiked(videoId) {
        const s = this._sessions.get(videoId);
        if (s) s.liked = true;
    }

    markReplayed(videoId) {
        const s = this._sessions.get(videoId);
        if (s) s.replayed = true;
    }

    trackWatchTime(videoId, durationMs) {
        const watchTimeS = parseFloat((durationMs / 1000).toFixed(3));
        this._enqueue({
            video_id: videoId,
            watch_time: watchTimeS,
            timestamp: new Date().toISOString(),
            _sessionKey: `wt_${videoId}_${Math.round(performance.now())}`
        });
    }

    trackSkip(videoId) {
        this._enqueue({
            video_id: videoId,
            skipped: true,
            timestamp: new Date().toISOString(),
            _sessionKey: `skip_${videoId}_${Math.round(performance.now())}`
        });
    }

    // ── Queuing & Batching ────────────────────────────────────────────────────

    _enqueue(event) {
        this._queue.push(event);

        if (!navigator.onLine) {
            // Offline: persist to localStorage and wait for reconnect
            this._persistOfflineQueue();
            return;
        }

        if (this._queue.length >= BATCH_SIZE_THRESHOLD) {
            this._flush();
        } else {
            this._scheduleFlush();
        }
    }

    _scheduleFlush() {
        if (this._timer !== null) return;
        // Slow networks get a longer timer to allow batching more events
        const delay = this._isSlowNetwork() ? BATCH_INTERVAL_MS * 2 : BATCH_INTERVAL_MS;
        this._timer = setTimeout(() => this._flush(), delay);
    }

    async _flush() {
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (this._flushing || this._queue.length === 0 || !this._token) return;

        this._flushing = true;
        const batch = this._queue.splice(0); // drain atomically

        // On slow networks, serialize requests (1 at a time) to avoid congestion
        if (this._isSlowNetwork()) {
            for (const event of batch) {
                await this._sendWithRetry(event);
            }
        } else {
            // Fast network: fire all in parallel (non-blocking from UI perspective)
            await Promise.allSettled(batch.map(e => this._sendWithRetry(e)));
        }

        this._flushing = false;
    }

    // ── Network I/O with retry ────────────────────────────────────────────────

    /**
     * Send a single event with exponential back-off retry.
     * If all retries fail, re-persists to localStorage for next session.
     */
    async _sendWithRetry(event) {
        // Strip internal dedup key before sending to server
        const { _sessionKey, ...payload } = event;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                const res = await fetch(`${API_BASE_URL}/recommend/track`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this._token}`,
                    },
                    body: JSON.stringify(payload),
                    keepalive: true,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (res.ok || res.status === 422) {
                    // 422 = validation error — don't retry, data is bad
                    return;
                }

                // 5xx or unexpected — fall through to retry
                throw new Error(`HTTP ${res.status}`);
            } catch (err) {
                const isLastAttempt = attempt === MAX_RETRIES;
                if (isLastAttempt) {
                    console.debug('[TrackingManager] Gave up after', MAX_RETRIES, 'retries. Persisting to localStorage.');
                    // Re-queue with original event (including sessionKey for future dedup)
                    this._queue.push(event);
                    this._persistOfflineQueue();
                } else {
                    // Exponential back-off: 1 s, 2 s, 4 s
                    const delay = RETRY_BASE_MS * Math.pow(2, attempt);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
    }

    // ── Page lifecycle ────────────────────────────────────────────────────────

    _setupUnloadListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this._sessions.forEach((_, vid) => this.endSession(vid));
                this._flush();
            }
        });

        window.addEventListener('pagehide', () => {
            this._sessions.forEach((_, vid) => this.endSession(vid));
            // Synchronously persist — fetch() with keepalive handles the network delivery
            this._persistOfflineQueue();
            this._flush();
        });
    }
}

export const trackingManager = new TrackingManager();
