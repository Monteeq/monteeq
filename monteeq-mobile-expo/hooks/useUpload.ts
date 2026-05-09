import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';

export const useUpload = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });
      return data;
    },
  });

  const pollStatus = async (videoId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/videos/${videoId}/status`);
        setProcessingStatus(data.status);
        
        if (data.status === 'ready' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling failed:', err);
        clearInterval(interval);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  };

  return {
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadProgress,
    processingStatus,
    pollStatus,
  };
};
