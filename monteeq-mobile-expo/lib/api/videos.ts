import api from '../axios';
import { Video, ProcessingStatus } from '../../types/api';

export const videoApi = {
  getVideos: async (params: { 
    video_type?: 'home' | 'flash', 
    status?: string, 
    skip?: number, 
    limit?: number 
  }): Promise<Video[]> => {
    const response = await api.get<Video[]>('/videos/', { params });
    return response.data;
  },

  getVideo: async (id: number): Promise<Video> => {
    const response = await api.get<Video>(`/videos/${id}`);
    return response.data;
  },

  likeVideo: async (id: number): Promise<{ liked: boolean, likes_count: number }> => {
    const response = await api.post(`/videos/${id}/like`);
    return response.data;
  },

  viewVideo: async (id: number): Promise<void> => {
    await api.post(`/videos/${id}/view`);
  },

  getStatus: async (processingKey: string): Promise<ProcessingStatus> => {
    const response = await api.get<ProcessingStatus>(`/videos/status/${processingKey}`);
    return response.data;
  },

  searchVideos: async (query: string): Promise<Video[]> => {
    const response = await api.get<Video[]>('/videos/search', { params: { q: query } });
    return response.data;
  },
};
