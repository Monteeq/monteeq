import api from '../axios';
import { AuthResponse, User, VerificationResponse } from '../../types/api';

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post<AuthResponse>('/auth/token', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  register: async (userData: any): Promise<VerificationResponse> => {
    const response = await api.post<VerificationResponse>('/auth/register', userData);
    return response.data;
  },

  googleAuth: async (credential: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google', { credential });
    return response.data;
  },

  verifyEmail: async (email: string, code: string): Promise<VerificationResponse> => {
    const response = await api.post<VerificationResponse>('/auth/verify-email', { email, code });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },
};
