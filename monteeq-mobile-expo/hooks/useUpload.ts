import { useState } from 'react';
import { uploadApi } from '@/lib/api/upload';
import { ProcessingStatus } from '@/types/api';

export const useUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus['status']>('unknown');
  const [statusMessage, setStatusMessage] = useState('');

  const upload = async (
    file: { uri: string; type: string; name: string },
    metadata: { title: string; description: string; tags: string; video_type: string }
  ) => {
    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStatus('queued');
    
    try {
      const video = await uploadApi.uploadVideo(file, metadata, (progress) => {
        setUploadProgress(progress);
      });
      return video;
    } catch (err) {
      setProcessingStatus('error');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const pollStatus = async (processingKey: string) => {
    try {
      await uploadApi.pollStatus(processingKey, (status) => {
        setProcessingStatus(status.status);
        setStatusMessage(status.message);
      });
    } catch (err) {
      setProcessingStatus('error');
    }
  };

  return {
    upload,
    isUploading,
    uploadProgress,
    processingStatus,
    statusMessage,
    pollStatus,
  };
};
