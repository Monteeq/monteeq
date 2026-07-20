/** Capture a JPEG frame from a video File at a given time (seconds). */

/**
 * @param {File} file
 * @param {number} timeSec
 * @returns {Promise<{ coverUrl: string, coverBlob: Blob, duration: number }>}
 */
export function captureCoverFrame(file, timeSec = 1) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      fn(value);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error('Timed out capturing cover frame'));
    }, 15000);

    video.onerror = () => finish(reject, new Error('Could not load video for cover'));

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const maxT = Math.max(0, duration - 0.05);
      const seekTo = Math.min(Math.max(0, timeSec), maxT || 0);

      const paint = () => {
        try {
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 360;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish(reject, new Error('Canvas unavailable'));
            return;
          }
          ctx.drawImage(video, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                finish(reject, new Error('Failed to encode cover'));
                return;
              }
              const coverUrl = URL.createObjectURL(blob);
              finish(resolve, { coverUrl, coverBlob: blob, duration });
            },
            'image/jpeg',
            0.85
          );
        } catch (err) {
          finish(reject, err);
        }
      };

      video.onseeked = () => {
        video.onseeked = null;
        paint();
      };

      try {
        if (Math.abs(video.currentTime - seekTo) < 0.01) {
          paint();
        } else {
          video.currentTime = seekTo;
        }
      } catch (err) {
        finish(reject, err);
      }
    };
  });
}

/**
 * @param {string} dataUrl
 * @returns {Blob|null}
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const [header, b64] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}
