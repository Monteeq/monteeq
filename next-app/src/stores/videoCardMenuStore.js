/** @type {string|null} */
let openMenuId = null;

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

    /** @param {() => void} listener */
    subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};
