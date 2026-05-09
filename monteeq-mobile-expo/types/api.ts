export type VideoType = 'home' | 'flash';
export type VideoStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface Video {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  video_type: VideoType;
  video_url: string;
  thumbnail_url: string;
  owner_id: string;
  owner_name: string;
  owner_avatar?: string;
  status: VideoStatus;
  views: number;
  likes_count: number;
  comments_count: number;
  shares: number;
  duration: number;
  created_at: string;
  is_liked?: boolean;
  is_verified?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  is_active: boolean;
  home_uploads: number;
  flash_uploads: number;
  followers_count: number;
  following_count: number;
  is_following?: boolean;
  is_verified?: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  total: number;
}
