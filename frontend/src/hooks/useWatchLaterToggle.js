import { useCallback } from 'react';
import { useWatchLater, useAddToWatchLater, useRemoveFromWatchLater } from './useLibrary';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

/**
 * @param {string|number} videoId
 */
export function useWatchLaterToggle(videoId) {
    const { token } = useAuth();
    const { showNotification } = useNotification();
    const { data: watchLaterData } = useWatchLater();
    const addToWatchLater = useAddToWatchLater();
    const removeFromWatchLater = useRemoveFromWatchLater();

    const isSaved = watchLaterData?.items?.some(
        (item) => String(item.video.id) === String(videoId)
    ) ?? false;

    const isPending = addToWatchLater.isPending || removeFromWatchLater.isPending;

    const toggle = useCallback(async () => {
        if (!token) {
            showNotification('info', 'Sign in to save videos to Watch Later');
            return false;
        }
        try {
            if (isSaved) {
                await removeFromWatchLater.mutateAsync(videoId);
                showNotification('success', 'Removed from Watch Later');
            } else {
                await addToWatchLater.mutateAsync(videoId);
                showNotification('success', 'Saved to Watch Later');
            }
            return true;
        } catch (err) {
            showNotification('error', err?.message || 'Failed to update Watch Later');
            return false;
        }
    }, [
        token,
        isSaved,
        videoId,
        addToWatchLater,
        removeFromWatchLater,
        showNotification,
    ]);

    return { isSaved, isPending, toggle };
}
