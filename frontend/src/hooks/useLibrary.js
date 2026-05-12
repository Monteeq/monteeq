import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { API_BASE_URL } from '../api';
import { useAuth } from '../context/AuthContext';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('monteeq_token');
    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('monteeq:session-expired'));
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Something went wrong');
    }

    return res.json();
};

// ── History Hooks ───────────────────────────────────────────────────────────
export const useHistory = (filter = 'all') => {
    return useQuery({
        queryKey: ['history', filter],
        queryFn: () => fetchWithAuth(`${API_BASE_URL}/history/?filter=${filter}`),
        placeholderData: keepPreviousData
    });

};

export const useUpdateHistory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, progressSeconds }) => 
            fetchWithAuth(`${API_BASE_URL}/history/${videoId}/progress`, {
                method: 'PATCH',
                body: JSON.stringify({ progress_seconds: progressSeconds })
            }),
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
        }
    });
};

export const useClearHistory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => fetchWithAuth(`${API_BASE_URL}/history/`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
        }
    });
};

export const useRemoveFromHistory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => fetchWithAuth(`${API_BASE_URL}/history/${videoId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['history']);
        }
    });
};

// ── Watch Later Hooks ───────────────────────────────────────────────────────
export const useWatchLater = () => {
    return useQuery({
        queryKey: ['watch-later'],
        queryFn: () => fetchWithAuth(`${API_BASE_URL}/watch-later/`)
    });
};

export const useAddToWatchLater = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => fetchWithAuth(`${API_BASE_URL}/watch-later/${videoId}`, { method: 'POST' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['watch-later']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};

export const useRemoveFromWatchLater = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (videoId) => fetchWithAuth(`${API_BASE_URL}/watch-later/${videoId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['watch-later']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};

// ── Liked Videos Hooks ──────────────────────────────────────────────────────
export const useLikedVideos = (category = 'all') => {
    return useQuery({
        queryKey: ['liked', category],
        queryFn: () => fetchWithAuth(`${API_BASE_URL}/liked/?category=${category}`),
        placeholderData: keepPreviousData
    });

};

export const useToggleLike = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, liked }) => {
            const method = liked ? 'DELETE' : 'POST';
            return fetchWithAuth(`${API_BASE_URL}/liked/${videoId}`, { method });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['liked']);
            queryClient.invalidateQueries(['library-stats']);
        }
    });
};
