/** Client-side video pick helpers: validate, duration, canvas thumbnail. */

export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const ACCEPTED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/3gpp',
]);

const ACCEPTED_EXT = /\.(mp4|webm|mov|avi|mkv|mpeg|mpg|m4v|3gp)$/i;

/**
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateVideoFile(file) {
  if (!file) return { ok: false, error: 'No file' };

  const typeOk =
    (file.type && (file.type.startsWith('video/') || ACCEPTED_VIDEO_TYPES.has(file.type))) ||
    ACCEPTED_EXT.test(file.name);

  if (!typeOk) {
    return { ok: false, error: 'Unsupported format' };
  }

  if (file.size <= 0) {
    return { ok: false, error: 'Empty file' };
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: 'Over 2 GB limit' };
  }

  return { ok: true };
}

/**
 * @param {number} seconds
 */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Square tolerance band for aspect ratio (width/height). */
export const ASPECT_SQUARE_MIN = 0.9;
export const ASPECT_SQUARE_MAX = 1.1;

/**
 * @param {number|null|undefined} width
 * @param {number|null|undefined} height
 * @returns {{ aspectRatio: number|null, orientation: 'landscape'|'portrait'|'square'|null }}
 */
export function classifyAspect(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return { aspectRatio: null, orientation: null };
  }
  const aspectRatio = width / height;
  if (aspectRatio >= ASPECT_SQUARE_MIN && aspectRatio <= ASPECT_SQUARE_MAX) {
    return { aspectRatio, orientation: 'square' };
  }
  if (aspectRatio > ASPECT_SQUARE_MAX) {
    return { aspectRatio, orientation: 'landscape' };
  }
  return { aspectRatio, orientation: 'portrait' };
}

/**
 * Default Home/Flash from orientation. Square defaults to home but stays unlocked.
 * @param {'landscape'|'portrait'|'square'|null} orientation
 * @returns {'home'|'flash'}
 */
export function defaultVideoTypeForOrientation(orientation) {
  if (orientation === 'portrait') return 'flash';
  return 'home';
}

/**
 * Seek ~1s (or mid-frame for short clips) and capture a JPEG data URL.
 * Also reads videoWidth/videoHeight from metadata.
 * @param {File} file
 * @returns {Promise<{ thumbnailUrl: string|null, duration: number|null, width: number|null, height: number|null }>}
 */
export function extractVideoPreview(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ thumbnailUrl: null, duration: null, width: null, height: null });
    }, 12000);

    video.onerror = () => {
      clearTimeout(timeout);
      finish({ thumbnailUrl: null, duration: null, width: null, height: null });
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      const width = video.videoWidth > 0 ? video.videoWidth : null;
      const height = video.videoHeight > 0 ? video.videoHeight : null;
      const seekTo =
        duration && duration > 2 ? 1 : duration && duration > 0.2 ? duration * 0.25 : 0;

      const capture = () => {
        try {
          const w = video.videoWidth || 320;
          const h = video.videoHeight || 180;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeout);
            finish({ thumbnailUrl: null, duration, width, height });
            return;
          }
          ctx.drawImage(video, 0, 0, w, h);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.82);
          clearTimeout(timeout);
          finish({
            thumbnailUrl,
            duration,
            width: video.videoWidth > 0 ? video.videoWidth : width,
            height: video.videoHeight > 0 ? video.videoHeight : height,
          });
        } catch {
          clearTimeout(timeout);
          finish({ thumbnailUrl: null, duration, width, height });
        }
      };

      if (seekTo <= 0) {
        // Some browsers fire seeked only after an actual seek
        video.currentTime = 0;
        requestAnimationFrame(capture);
        return;
      }

      video.onseeked = () => {
        video.onseeked = null;
        capture();
      };
      try {
        video.currentTime = seekTo;
      } catch {
        clearTimeout(timeout);
        finish({ thumbnailUrl: null, duration, width, height });
      }
    };
  });
}

/**
 * Read width/height via a hidden video element (metadata only).
 * @param {File} file
 * @returns {Promise<{ width: number|null, height: number|null, aspectRatio: number|null, orientation: 'landscape'|'portrait'|'square'|null }>}
 */
export function readVideoAspect(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let settled = false;
    const finish = (width, height) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      const { aspectRatio, orientation } = classifyAspect(width, height);
      resolve({ width, height, aspectRatio, orientation });
    };

    const timeout = setTimeout(() => finish(null, null), 8000);
    video.onerror = () => {
      clearTimeout(timeout);
      finish(null, null);
    };
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      finish(
        video.videoWidth > 0 ? video.videoWidth : null,
        video.videoHeight > 0 ? video.videoHeight : null
      );
    };
  });
}

/**
 * Build a selection entry for the upload grid.
 * @param {File} file
 */
export async function buildVideoSelectionItem(file) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const validation = validateVideoFile(file);
  if (!validation.ok) {
    return {
      id,
      file,
      name: file.name,
      size: file.size,
      thumbnailUrl: null,
      duration: null,
      width: null,
      height: null,
      aspectRatio: null,
      orientation: null,
      error: validation.error,
      isValid: false,
    };
  }

  const { thumbnailUrl, duration, width, height } = await extractVideoPreview(file);
  const { aspectRatio, orientation } = classifyAspect(width, height);
  return {
    id,
    file,
    name: file.name,
    size: file.size,
    thumbnailUrl,
    duration,
    width,
    height,
    aspectRatio,
    orientation,
    error: null,
    isValid: true,
  };
}
