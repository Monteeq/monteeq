export const adaptiveDiscovery = {
    reRankBatch: (videos, layerResponse) => videos,
    recordImpression: () => {},
    recordEngagement: () => {},
    recordSkip: (id, category) => ({ tier: 0 }),
};
