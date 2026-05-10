import { useInfiniteQuery } from '@tanstack/react-query';
import { videoApi } from '@/lib/api/videos';

export const useFeed = (type: 'home' | 'flash') => {
  return useInfiniteQuery({
    queryKey: ['feed', type],
    queryFn: async ({ pageParam = 0 }) => {
      const data = await videoApi.getVideos({
        video_type: type,
        status: 'approved',
        skip: pageParam,
        limit: 10,
      });
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got 10 items, there might be more. 
      // Skip = total items loaded so far
      return lastPage.length === 10 ? allPages.length * 10 : undefined;
    },
    initialPageParam: 0,
  });
};
