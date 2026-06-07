export const feedManager = {
    configure: (config) => {},
    onPrefetch: (callback) => {
        return () => {}; // Unsubscribe function
    },
    fetchFeed: async (limit, mood) => [],
    resetConsumption: () => {},
    recordConsumption: (remaining) => {},
    fetchWithStaleWhileRevalidate: (callback) => [],
    getNextBatch: async () => [],
    reset: () => {},
    recordView: () => {},
};
