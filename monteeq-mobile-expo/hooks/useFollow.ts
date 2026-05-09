import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api from '@/lib/axios';

export const useFollow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await api.delete(`/users/${userId}/follow`);
      } else {
        await api.post(`/users/${userId}/follow`);
      }
    },
    onMutate: async ({ userId, isFollowing }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await queryClient.cancelQueries({ queryKey: ['user', userId] });
      const previousUser = queryClient.getQueryData<any>(['user', userId]);

      if (previousUser) {
        queryClient.setQueryData(['user', userId], {
          ...previousUser,
          is_following: !isFollowing,
          followers_count: isFollowing 
            ? previousUser.followers_count - 1 
            : previousUser.followers_count + 1,
        });
      }

      return { previousUser };
    },
    onError: (err, variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(['user', variables.userId], context.previousUser);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
};
