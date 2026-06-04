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
        onMutate: async ({ videoId }) => {
            await queryClient.cancelQueries({ queryKey: ['feed'] });
            const previousQueries = queryClient.getQueriesData({ queryKey: ['feed'] });

            previousQueries.forEach(([queryKey, oldData]) => {
                if (!oldData) return;
                queryClient.setQueryData(queryKey, (old) => {
                    if (!old) return old;

                    if (old.pages && Array.isArray(old.pages)) {
                        return {
                            ...old,
                            pages: old.pages.map(page => {
                                if (!Array.isArray(page)) return page;
                                return page.map(video => {
                                    if (video.id === videoId) {
                                        const isLiked = video.liked_by_user;
                                        return {
                                            ...video,
                                            liked_by_user: !isLiked,
                                            like_count: isLiked ? Math.max(0, (video.like_count || 0) - 1) : (video.like_count || 0) + 1,
                                            likes_count: isLiked ? Math.max(0, (video.likes_count || 0) - 1) : (video.likes_count || 0) + 1
                                        };
                                    }
                                    return video;
                                });
                            })
                        };
                    }

                    if (Array.isArray(old)) {
                        return old.map(video => {
                            if (video.id === videoId) {
                                const isLiked = video.liked_by_user;
                                return {
                                    ...video,
                                    liked_by_user: !isLiked,
                                    like_count: isLiked ? Math.max(0, (video.like_count || 0) - 1) : (video.like_count || 0) + 1,
                                    likes_count: isLiked ? Math.max(0, (video.likes_count || 0) - 1) : (video.likes_count || 0) + 1
                                };
                            }
                            return video;
                        });
                    }

                    return old;
                });
            });

            return { previousQueries };
        },
        onError: (err, variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, oldData]) => {
                    queryClient.setQueryData(queryKey, oldData);
                });
            }
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
