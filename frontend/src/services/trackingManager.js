export const trackingManager = {
    setToken: (token) => {},
    trackView: () => {},
    trackEngagement: () => {},
    trackScroll: () => {},
    trackSkip: (id) => {},
    startSession: (videoId, duration) => {},
    trackWatchTime: (videoId, watchMs) => {},
    endSession: (videoId) => {},
    markReplayed: (videoId) => {},
    markLiked: (videoId) => {},
    flush: () => {},
};
