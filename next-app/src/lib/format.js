/**
 * Formats a duration in seconds into a human-readable string.
 * e.g. 3661 -> "1:01:01", 125 -> "2:05"
 */
export const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
};

/**
 * Formats a date string into a relative time string.
 * e.g. "2 hours ago", "3 days ago", "just now"
 */
export const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) {
        const m = Math.floor(diffInSeconds / 60);
        return `${m} minute${m !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 86400) {
        const h = Math.floor(diffInSeconds / 3600);
        return `${h} hour${h !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 604800) {
        const d = Math.floor(diffInSeconds / 86400);
        return `${d} day${d !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 2592000) {
        const w = Math.floor(diffInSeconds / 604800);
        return `${w} week${w !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 31536000) {
        const mo = Math.floor(diffInSeconds / 2592000);
        return `${mo} month${mo !== 1 ? 's' : ''} ago`;
    }
    const y = Math.floor(diffInSeconds / 31536000);
    return `${y} year${y !== 1 ? 's' : ''} ago`;
};

/**
 * Formats a number into a compact string.
 * e.g. 1500 -> "1.5K", 1200000 -> "1.2M"
 */
export const formatCount = (num) => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
};

/**
 * Formats a file size in bytes into a human-readable string.
 * e.g. 1048576 -> "1.0 MB"
 */
export const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};
