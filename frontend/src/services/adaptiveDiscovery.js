export const adaptiveDiscovery = {
    reRankBatch: (videos, layerResponse) => videos,
    recordImpression: () => {},
    recordEngagement: () => {},
    recordSkip: (id, category) => ({ tier: 0 }),
    recordWatch: (videoId, watchMs, durationMs, mood) => {},
};
