export const TIERS = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
};

export const adaptiveEngine = {
    getTier: () => 0,
    startMonitoring: (callback) => {},
    stopMonitoring: () => {},
    recordScroll: () => {},
    recordInteraction: () => {},
};
