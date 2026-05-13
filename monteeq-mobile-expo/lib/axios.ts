import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { EXPO_PUBLIC_API_URL } from '@/constants/env';

const api = axios.create({
  baseURL: EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error reading token from SecureStore', error);
  }
  return config;
});

// Response Interceptor: Handle Token Expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Note: Backend currently doesn't have a dedicated /refresh endpoint in auth.py
      // but we prepare the logic here. For now, 401 will just trigger logout.
      // If a refresh flow is added, it would be called here.
      
      // await SecureStore.deleteItemAsync('access_token');
      // Redirect to login or handle via store
    }
    return Promise.reject(error);
  }
);

export default api;
