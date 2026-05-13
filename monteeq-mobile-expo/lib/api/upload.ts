import api from '../axios';
import { Video, ProcessingStatus } from '../../types/api';

export const uploadApi = {
  uploadVideo: async (
    file: { uri: string; type: string; name: string },
    metadata: { title: string; description: string; tags: string; video_type: string },
    onProgress?: (progress: number) => void
  ): Promise<Video> => {
    const formData = new FormData();
    
    // @ts-ignore
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    });
    
    formData.append('title', metadata.title);
    formData.append('description', metadata.description);
    formData.append('tags', metadata.tags);
    formData.append('video_type', metadata.video_type);

    const response = await api.post<Video>('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    return response.data;
  },

  pollStatus: async (
    processingKey: string,
    onStatus: (status: ProcessingStatus) => void,
    interval = 3000
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const response = await api.get<ProcessingStatus>(`/videos/status/${processingKey}`);
          onStatus(response.data);
          
          if (response.data.status === 'completed') {
            resolve();
            return;
          }
          
          if (response.data.status === 'error' || response.data.status === 'failed') {
            reject(new Error(response.data.message || 'Processing failed'));
            return;
          }
          
          setTimeout(check, interval);
        } catch (err) {
          reject(err);
        }
      };
      
      check();
    });
  },
};
