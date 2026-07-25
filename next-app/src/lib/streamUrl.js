/**
 * Stream URL helpers for Monteeq video playback.
 * Client components should use NEXT_PUBLIC_API_BASE_URL (see getClientApiBaseUrl).
 */

export function getClientApiBaseUrl() {
  const origin = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  return origin ? `${origin}/api/v1` : '/api/v1';
}

/**
 * Legacy: builds the backend proxy URL for HLS streaming.
 * @deprecated Use fetchStreamSignedUrl() for direct CDN access.
 */
export function getStreamUrl(src, videoId) {
  if (videoId && src && typeof src === 'string' && src.startsWith('http')) {
    return `${getClientApiBaseUrl()}/videos/${videoId}/stream/master.m3u8`;
  }
  return src;
}

/**
 * Fetch a CloudFront signed URL for the video's HLS manifest.
 * Returns { url, expires_at, signed } — client loads manifest + segments
 * directly from CDN using the returned URL.
 *
 * @param {number|string} videoId
 * @param {string|null} quality - e.g. "720p", "1080p" (triggers premium check server-side)
 * @param {string|null} token - JWT auth token
 * @returns {Promise<{url: string, expires_at: number, signed: boolean}>}
 */
export async function fetchStreamSignedUrl(videoId, quality = null, token = null) {
  const base = getClientApiBaseUrl();
  const params = new URLSearchParams();
  if (quality) params.set('quality', quality);

  const url = `${base}/videos/${videoId}/stream-url?${params}`;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to get stream URL: ${res.status}`);
  }
  return res.json();
}
