import { getVideos, getRecommendedFeed } from '../api';

let currentToken = null;
let currentVideoType = 'flash';
let currentMood = '';
let currentFeedType = 'foryou';

let skip = 0;
let isFetching = false;
let listeners = [];
let cache = [];

export const feedManager = {
    configure: (config) => {
        const tokenChanged = config.token !== undefined && config.token !== currentToken;
        const moodChanged = config.mood !== undefined && config.mood !== currentMood;
        const videoTypeChanged = config.videoType !== undefined && config.videoType !== currentVideoType;
        const feedTypeChanged = config.feedType !== undefined && config.feedType !== currentFeedType;

        if (tokenChanged || moodChanged || videoTypeChanged || feedTypeChanged) {
            if (config.token !== undefined) currentToken = config.token;
            if (config.mood !== undefined) currentMood = config.mood;
            if (config.videoType !== undefined) currentVideoType = config.videoType;
            if (config.feedType !== undefined) currentFeedType = config.feedType;

            // Reset pagination and cache on configuration change
            skip = 0;
            cache = [];
        }
    },

    onPrefetch: (callback) => {
        listeners.push(callback);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        };
    },

    fetchFeed: async (limit = 15, mood = currentMood) => {
        if (isFetching) return [];
        isFetching = true;
        try {
            let videos = [];
            const activeMood = mood || currentMood;
            if (currentFeedType === 'foryou') {
                const recommended = await getRecommendedFeed(currentVideoType, currentToken, limit, activeMood);
                if (recommended && recommended.length > 0) {
                    videos = recommended;
                } else {
                    videos = await getVideos(currentVideoType, currentToken, skip, limit, activeMood, 'foryou');
                }
            } else {
                videos = await getVideos(currentVideoType, currentToken, skip, limit, activeMood, currentFeedType);
            }

            if (Array.isArray(videos) && videos.length > 0) {
                skip += videos.length;
                if (skip === videos.length) {
                    cache = videos;
                }
            }
            return videos || [];
        } catch (error) {
            console.error('[feedManager] fetchFeed failed:', error);
            return [];
        } finally {
            isFetching = false;
        }
    },

    resetConsumption: () => {
        // Keeping current state, but resets can be done if needed
    },

    recordConsumption: async (remaining) => {
        if (remaining < 5 && !isFetching) {
            const nextVideos = await feedManager.fetchFeed(15, currentMood);
            if (nextVideos && nextVideos.length > 0) {
                listeners.forEach(cb => cb(nextVideos));
            }
        }
    },

    fetchWithStaleWhileRevalidate: (callback) => {
        const hasCache = cache && cache.length > 0;

        (async () => {
            skip = 0;
            const freshVideos = await feedManager.fetchFeed(15, currentMood);
            if (freshVideos && freshVideos.length > 0) {
                callback(freshVideos);
            }
        })();

        return hasCache ? cache : [];
    },

    getNextBatch: async () => {
        return feedManager.fetchFeed(15, currentMood);
    },

    reset: () => {
        skip = 0;
        cache = [];
    },

    recordView: () => {},
};
