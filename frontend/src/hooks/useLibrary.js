import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { useAuth } from '../context/AuthContext';

const useLibraryRequest = () => {
    const { token } = useAuth();
    
    const request = async (path, options = {}) => {
        if (!token) throw new Error('Authentication required');
        
        return apiFetch(path, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });
    };
    
    return { request, token };
};

// ── History Hooks ───────────────────────────────────────────────────────────
export const useHistory = (filter = 'all', limit = 20) => {
    const { request, token } = useLibraryRequest();
    return useInfiniteQuery({
        queryKey: ['history', filter],
        queryFn: ({ pageParam = 1 }) => request(`/history/?filter=${filter}&page=${pageParam}&limit=${limit}`),
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        initialPageParam: 1,
        placeholderData: keepPreviousData,
        enabled: !!token
    });
};

export const useTrackHistory = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload) => request('/history/track', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['library-stats'] });
        }
    });
};

export const useUpdateHistory = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, progressSeconds, durationSeconds, isCompleted }) => 
            request(`/history/${videoId}/progress`, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    progress_seconds: progressSeconds,
                    duration_seconds: durationSeconds,
                    is_completed: isCompleted
                })
            }),
        onSuccess: () => {
            // Not invalidating history here to avoid jank during playback, 
            // but updating stats if needed
            queryClient.invalidateQueries({ queryKey: ['library-stats'] });
        }
    });
};

export const useClearHistory = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => request('/history/', { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
        }
    });
};

export const useRemoveFromHistory = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => request(`/history/${videoId}`, { method: 'DELETE' }),
        onMutate: async (videoId) => {
            await queryClient.cancelQueries({ queryKey: ['history'] });
            const previousHistory = queryClient.getQueryData(['history']);
            queryClient.setQueryData(['history'], (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        items: page.items.filter(item => item.video.id !== videoId),
                        total: page.total - 1
                    }))
                };
            });
            return { previousHistory };
        },
        onError: (err, videoId, context) => {
            queryClient.setQueryData(['history'], context.previousHistory);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['library-stats'] });
        }
    });
};

// ── Watch Later Hooks ───────────────────────────────────────────────────────
export const useWatchLater = () => {
    const { request, token } = useLibraryRequest();
    return useQuery({
        queryKey: ['watch-later'],
        queryFn: () => request('/watch-later/'),
        enabled: !!token
    });
};

export const useAddToWatchLater = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => request(`/watch-later/${videoId}`, { method: 'POST' }),
        onMutate: async (videoId) => {
            await queryClient.cancelQueries({ queryKey: ['watch-later'] });
            const previousWatchLater = queryClient.getQueryData(['watch-later']);
            queryClient.setQueryData(['watch-later'], (old) => {
                const items = old?.items ? [...old.items] : [];
                if (!items.some(item => String(item.video.id) === String(videoId))) {
                    items.push({
                        id: 'temp-' + Date.now(),
                        saved_at: new Date().toISOString(),
                        video: { id: Number(videoId) }
                    });
                }
                return {
                    ...old,
                    items,
                    stats: {
                        ...(old?.stats || {}),
                        total_videos: items.length
                    }
                };
            });
            return { previousWatchLater };
        },
        onError: (err, videoId, context) => {
            if (context?.previousWatchLater) {
                queryClient.setQueryData(['watch-later'], context.previousWatchLater);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['watch-later'] });
            queryClient.invalidateQueries({ queryKey: ['library-stats'] });
        }
    });
};

export const useRemoveFromWatchLater = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => request(`/watch-later/${videoId}`, { method: 'DELETE' }),
        onMutate: async (videoId) => {
            await queryClient.cancelQueries({ queryKey: ['watch-later'] });
            const previousWatchLater = queryClient.getQueryData(['watch-later']);
            queryClient.setQueryData(['watch-later'], (old) => {
                const items = old?.items ? old.items.filter(item => String(item.video.id) !== String(videoId)) : [];
                return {
                    ...old,
                    items,
                    stats: {
                        ...(old?.stats || {}),
                        total_videos: items.length
                    }
                };
            });
            return { previousWatchLater };
        },
        onError: (err, videoId, context) => {
            if (context?.previousWatchLater) {
                queryClient.setQueryData(['watch-later'], context.previousWatchLater);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['watch-later'] });
            queryClient.invalidateQueries({ queryKey: ['library-stats'] });
        }
    });
};

export const useClearWatchLater = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => request('/watch-later/', { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['watch-later']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};

// ── Liked Videos Hooks ──────────────────────────────────────────────────────
export const useLikedVideos = (category = 'all') => {
    const { request, token } = useLibraryRequest();
    return useQuery({
        queryKey: ['liked', category],
        queryFn: () => request(`/liked/?category=${category}`),
        placeholderData: keepPreviousData,
        enabled: !!token
    });
};

export const useToggleLike = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, liked }) => {
            const method = liked ? 'DELETE' : 'POST';
            return request(`/liked/${videoId}`, { method });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['liked']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};

// ── Stats Hooks ─────────────────────────────────────────────────────────────
export const useLibraryStats = () => {
    const { request, token } = useLibraryRequest();
    return useQuery({
        queryKey: ['library-stats'],
        queryFn: () => request('/library/stats'),
        enabled: !!token
    });
};
