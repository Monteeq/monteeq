import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVideos, getRecommendedFeed, likeVideo } from '../api';

export const useHomeFeed = (token, category = 'All') => {
    return useInfiniteQuery({
        queryKey: ['feed', 'home', category],
        queryFn: async ({ pageParam = 0 }) => {
            // For logged-in users, use the recommendation engine if available.
            // Simplified here to just use getVideos with skip logic.
            const data = await getVideos('home', token, pageParam, 12, category);
            return data;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 12 ? allPages.length * 12 : undefined;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useFlashFeed = (token) => {
    return useQuery({
        queryKey: ['feed', 'flash'],
        queryFn: () => getVideos('flash', token, 0, 18),
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
};

export const useVideoLike = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ videoId, token }) => likeVideo(videoId, token),
        onSuccess: (data, variables) => {
            // Optionally invalidate queries or update cache optimistically
            queryClient.invalidateQueries({ queryKey: ['feed'] });
        }
    });
};
