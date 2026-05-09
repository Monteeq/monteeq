import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.monteeq.com/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  owner: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  followers_count: number;
  following_count: number;
}

export const videoService = {
  // Fetch videos by type (flash, trending, etc.)
  getVideosByType: async (type: string, skip: number = 0, limit: number = 20) => {
    try {
      const response = await apiClient.get<Video[] | { data: Video[] }>('/videos/', {
        params: { type, skip, limit },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error('Error fetching videos:', error);
      return [];
    }
  },

  // Fetch single video by ID
  getVideoById: async (id: string) => {
    try {
      const response = await apiClient.get<Video>(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching video:', error);
      return null;
    }
  },

  // Like a video
  likeVideo: async (videoId: string) => {
    try {
      const response = await apiClient.post(`/videos/${videoId}/like`);
      return response.data;
    } catch (error) {
      console.error('Error liking video:', error);
      return null;
    }
  },

  // Unlike a video
  unlikeVideo: async (videoId: string) => {
    try {
      const response = await apiClient.post(`/videos/${videoId}/unlike`);
      return response.data;
    } catch (error) {
      console.error('Error unliking video:', error);
      return null;
    }
  },

  // Share a video
  shareVideo: async (videoId: string) => {
    try {
      const response = await apiClient.post(`/videos/${videoId}/share`);
      return response.data;
    } catch (error) {
      console.error('Error sharing video:', error);
      return null;
    }
  },
};

export const userService = {
  // Get current user profile
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get<User>('/users/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  },

  // Get user by ID or username
  getUser: async (userIdOrUsername: string) => {
    try {
      const response = await apiClient.get<User>(`/users/${userIdOrUsername}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  // Follow a user
  followUser: async (userId: string) => {
    try {
      const response = await apiClient.post(`/users/${userId}/follow`);
      return response.data;
    } catch (error) {
      console.error('Error following user:', error);
      return null;
    }
  },

  // Unfollow a user
  unfollowUser: async (userId: string) => {
    try {
      const response = await apiClient.post(`/users/${userId}/unfollow`);
      return response.data;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return null;
    }
  },
};

export default apiClient;
