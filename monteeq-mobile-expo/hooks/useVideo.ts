import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api from '@/lib/axios';
import { Video } from '@/types/api';

export const useVideo = (videoId?: string) => {
  const queryClient = useQueryClient();

  const videoQuery = useQuery({
    queryKey: ['video', videoId],
    queryFn: async () => {
      const { data } = await api.get<Video>(`/videos/${videoId}`);
      return data;
    },
    enabled: !!videoId,
  });

  const likeMutation = useMutation({
    mutationFn: async ({ id, isLiked }: { id: string; isLiked: boolean }) => {
      if (isLiked) {
        await api.delete(`/videos/${id}/like`);
      } else {
        await api.post(`/videos/${id}/like`);
      }
    },
    onMutate: async ({ id, isLiked }) => {
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['video', id] });
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      // Snapshot the previous value
      const previousVideo = queryClient.getQueryData<Video>(['video', id]);

      // Optimistically update to the new value
      if (previousVideo) {
        queryClient.setQueryData<Video>(['video', id], {
          ...previousVideo,
          is_liked: !isLiked,
          likes_count: isLiked ? previousVideo.likes_count - 1 : previousVideo.likes_count + 1,
        });
      }

      return { previousVideo };
    },
    onError: (err, variables, context) => {
      if (context?.previousVideo) {
        queryClient.setQueryData(['video', variables.id], context.previousVideo);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['video', variables.id] });
    },
  });

  return {
    video: videoQuery.data,
    isLoading: videoQuery.isLoading,
    toggleLike: (isLiked: boolean) => {
      if (videoId) {
        likeMutation.mutate({ id: videoId, isLiked });
      }
    },
  };
};
