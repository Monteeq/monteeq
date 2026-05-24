import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVideos, getRecommendedFeed, likeVideo, getFollowingFeed } from '../api';

const HOME_PAGE_SIZE = 20;
const FLASH_PAGE_SIZE = 18;

export const useHomeFeed = (token, category = 'All') => {
    return useInfiniteQuery({
        queryKey: ['feed', 'home', category],
        queryFn: async ({ pageParam = 0 }) => {
            // If category is 'All', we don't want to filter by mood/tag.
            const mood = category === 'All' ? '' : category;
            const data = await getVideos('home', token, pageParam, HOME_PAGE_SIZE, mood);
            return data;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === HOME_PAGE_SIZE ? allPages.length * HOME_PAGE_SIZE : undefined;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useFlashFeed = (token) => {
    return useQuery({
        queryKey: ['feed', 'flash'],
        queryFn: () => getVideos('flash', token, 0, FLASH_PAGE_SIZE),
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

export const useFollowingFeed = (token, contentType = 'all') => {
    return useInfiniteQuery({
        queryKey: ['feed', 'following', contentType],
        queryFn: ({ pageParam = 0 }) => getFollowingFeed(token, pageParam, 3, contentType),
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 3 ? allPages.length * 3 : undefined;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
        enabled: !!token,
    });
};
