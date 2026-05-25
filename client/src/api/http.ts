import axios from 'axios';
import { captureFrontendException } from '../monitoring/sentry';

const http = axios.create({
  baseURL: '/api',
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const isServerError = status !== undefined && status >= 500;
      const isNetworkError = !error.response && Boolean(error.request);

      if (isServerError || isNetworkError) {
        // Build a sanitized error — no auth headers, tokens, or request body
        const method = (error.config?.method ?? 'unknown').toUpperCase();
        const rawUrl = error.config?.url ?? 'unknown';
        const url = rawUrl.split('?')[0]; // strip query params in case they carry data

        const message = isNetworkError
          ? `Network error — ${method} ${url}`
          : `HTTP ${status} — ${method} ${url}`;

        captureFrontendException(Object.assign(new Error(message), { name: 'ApiError' }));
      }
    }
    return Promise.reject(error);
  }
);

export default http;
