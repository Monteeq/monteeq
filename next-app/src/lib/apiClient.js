/** Browser FastAPI client — port of frontend/src/api.js (Vite env ? NEXT_PUBLIC_*). */
export * from './browserApi';
export { API_BASE_URL, apiFetch, ApiError, isAbortOrNetworkError } from './browserApi';
