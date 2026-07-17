/** @type {string|null} */
let openMenuId = null;

/** Ignore scroll-close until this timestamp (ms since epoch). */
let suppressScrollUntil = 0;

/** @type {Set<() => void>} */
const listeners = new Set();

export const videoCardMenuStore = {
    getOpenMenuId: () => openMenuId,

    openMenu: (videoId) => {
        openMenuId = String(videoId);
        listeners.forEach((listener) => listener());
    },

    closeMenu: () => {
        if (openMenuId === null) return;
        openMenuId = null;
        listeners.forEach((listener) => listener());
    },

    toggleMenu: (videoId) => {
        const id = String(videoId);
        if (openMenuId === id) {
            videoCardMenuStore.closeMenu();
        } else {
            videoCardMenuStore.openMenu(id);
        }
    },

    /**
     * Briefly ignore scroll-to-close (e.g. after focus moves into the menu).
     * @param {number} ms
     */
    suppressScrollClose: (ms = 200) => {
        suppressScrollUntil = Date.now() + ms;
    },

    shouldIgnoreScrollClose: () => Date.now() < suppressScrollUntil,

    /** @param {() => void} listener */
    subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};
