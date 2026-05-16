import { API_BASE_URL } from '../api';

/**
 * Converts a direct CDN video URL to a backend proxy stream URL.
 * This is necessary because CloudFront/S3 may not have CORS headers configured,
 * and HLS.js makes XHR requests that are subject to CORS restrictions.
 * 
 * The backend proxy at /videos/{id}/stream/{sub_path} forwards requests server-side,
 * bypassing browser CORS. HLS.js relative URLs in the manifest automatically
 * resolve through the proxy.
 * 
 * @param {string} src - The original video source URL (CDN or local)
 * @param {number|string} videoId - The video's database ID
 * @returns {string} The proxy stream URL, or the original src if no videoId
 */
export function getStreamUrl(src, videoId) {
    if (videoId && src && src.startsWith('http')) {
        return `${API_BASE_URL}/videos/${videoId}/stream/master.m3u8`;
    }
    return src;
}
