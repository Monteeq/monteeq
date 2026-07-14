export const adaptiveDiscovery = {
  reRankBatch: (videos) => videos,
  recordImpression: () => {},
  recordEngagement: () => {},
  recordSkip: () => ({ tier: 0 }),
  recordWatch: () => {},
};
