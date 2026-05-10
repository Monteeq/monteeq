import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { User } from '@/types/api';

export const useProfile = (username?: string) => {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;
      const response = await api.get<User>(`/users/profile/${username}`);
      return response.data;
    },
    enabled: !!username,
  });
};
