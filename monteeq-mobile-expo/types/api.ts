export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  profile_pic: string | null;
  bio: string | null;
  is_premium: boolean;
  is_verified: boolean;
  is_onboarded: boolean;
  role: 'admin' | 'user';
  flash_uploads: number;
  home_uploads: number;
  flash_quota_limit: number;
  home_quota_limit: number;
  created_at: string;
}

export interface Video {
  id: number;
  title: string;
  description: string | null;
  video_url: string;
  url_480p?: string | null;
  url_720p?: string | null;
  url_1080p?: string | null;
  thumbnail_url: string;
  video_type: 'home' | 'flash';
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  owner_id: number;
  owner?: Partial<User>;
  views: number;
  likes_count: number;
  comments_count: number;
  liked_by_user?: boolean;
  owner_followed?: boolean;
  duration: number;
  processing_key: string | null;
  processing_message: string | null;
  tags: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export interface VerificationResponse {
  message: string;
  email?: string;
  username?: string;
}

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error' | 'queued' | 'unknown';
  progress: number;
  message: string;
  url?: string;
}
