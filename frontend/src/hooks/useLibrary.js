import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
export const useHistory = (filter = 'all') => {
    const { request, token } = useLibraryRequest();
    return useQuery({
        queryKey: ['history', filter],
        queryFn: () => request(`/history/?filter=${filter}`),
        placeholderData: keepPreviousData,
        enabled: !!token
    });
};

export const useUpdateHistory = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, progressSeconds }) => 
            request(`/history/${videoId}/progress`, {
                method: 'PATCH',
                body: JSON.stringify({ progress_seconds: progressSeconds })
            }),
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
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
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
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
        onSuccess: () => {
            queryClient.invalidateQueries(['watch-later']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};

export const useRemoveFromWatchLater = () => {
    const { request } = useLibraryRequest();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => request(`/watch-later/${videoId}`, { method: 'DELETE' }),
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
