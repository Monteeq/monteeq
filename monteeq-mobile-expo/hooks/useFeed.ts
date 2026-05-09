import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { PaginatedResponse, Video } from '@/types/api';

export const useFeed = (type: 'home' | 'flash') => {
  return useInfiniteQuery({
    queryKey: ['feed', type],
    queryFn: async ({ pageParam = '' }) => {
      const endpoint = type === 'home' ? '/feed/home' : '/feed/flash';
      const { data } = await api.get<PaginatedResponse<Video>>(
        `${endpoint}?cursor=${pageParam}&limit=20`
      );
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    initialPageParam: '',
  });
};
