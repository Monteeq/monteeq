/**
 * Flash feed pagination — mirrors frontend feedManager, uses clientApi.
 */
import {
  fetchFlashVideosPage,
  fetchRecommendedFlash,
} from '@/lib/clientApi';

let currentToken = null;
let currentMood = '';
let currentFeedType = 'foryou';
let skip = 0;
let isFetching = false;
let listeners = [];

export const flashFeedManager = {
  configure: (config = {}) => {
    const tokenChanged = config.token !== undefined && config.token !== currentToken;
    const moodChanged = config.mood !== undefined && config.mood !== currentMood;
    const feedTypeChanged = config.feedType !== undefined && config.feedType !== currentFeedType;

    if (tokenChanged || moodChanged || feedTypeChanged) {
      if (config.token !== undefined) currentToken = config.token;
      if (config.mood !== undefined) currentMood = config.mood;
      if (config.feedType !== undefined) currentFeedType = config.feedType;
      skip = 0;
    }
  },

  onPrefetch: (callback) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  },

  fetchFeed: async (limit = 15, mood = currentMood) => {
    if (isFetching) return [];
    isFetching = true;
    try {
      const activeMood = mood || currentMood;
      let videos = [];

      if (currentFeedType === 'foryou') {
        const recommended = await fetchRecommendedFlash({
          limit,
          mood: activeMood,
          token: currentToken,
        });
        if (recommended && recommended.length > 0) {
          videos = recommended;
        } else {
          videos = await fetchFlashVideosPage({
            skip,
            limit,
            mood: activeMood,
            token: currentToken,
            feedMode: 'foryou',
          });
        }
      } else {
        videos = await fetchFlashVideosPage({
          skip,
          limit,
          mood: activeMood,
          token: currentToken,
          feedMode: currentFeedType,
        });
      }

      if (Array.isArray(videos) && videos.length > 0) {
        skip += videos.length;
      }
      return videos || [];
    } catch (error) {
      console.error('[flashFeedManager] fetchFeed failed:', error);
      return [];
    } finally {
      isFetching = false;
    }
  },

  recordConsumption: async (remaining) => {
    if (remaining < 5 && !isFetching) {
      const nextVideos = await flashFeedManager.fetchFeed(15, currentMood);
      if (nextVideos && nextVideos.length > 0) {
        listeners.forEach((cb) => cb(nextVideos));
      }
    }
  },

  reset: () => {
    skip = 0;
  },

  /** Advance pagination cursor after SSR-seeded first page. */
  seedSkip: (n) => {
    skip = Math.max(0, Number(n) || 0);
  },
};
