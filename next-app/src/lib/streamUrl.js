/**
 * Builds the browser-facing HLS proxy URL for a video.
 * Client components should use NEXT_PUBLIC_API_BASE_URL (see getClientApiBaseUrl).
 */

export function getClientApiBaseUrl() {
  const origin = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  return origin ? `${origin}/api/v1` : '/api/v1';
}

/**
 * @param {string} src - Original CDN/local video URL
 * @param {number|string} videoId
 * @returns {string}
 */
export function getStreamUrl(src, videoId) {
  if (videoId && src && typeof src === 'string' && src.startsWith('http')) {
    return `${getClientApiBaseUrl()}/videos/${videoId}/stream/master.m3u8`;
  }
  return src;
}
