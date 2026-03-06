import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  // NOTE: Do NOT set a default Content-Type here.
  // Axios 1.x auto-detects: plain objects → application/json,
  // FormData → multipart/form-data with correct boundary.
  // A default 'application/json' causes FormData uploads to be
  // serialized as JSON (formDataToJSON), breaking file uploads.
});

// Interceptor — add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shared refresh promise — prevents multiple simultaneous refresh calls
// when several requests 401 at the same time (race condition).
let _refreshPromise = null;

// Interceptor — handle 401 (token refresh)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        // If a refresh is already in-flight, reuse that promise instead of
        // firing a second /auth/refresh — this stops the race condition.
        if (!_refreshPromise) {
          _refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
            .then(({ data }) => {
              localStorage.setItem('access_token', data.access_token);
              localStorage.setItem('refresh_token', data.refresh_token);
              return data.access_token;
            })
            .catch(async (err) => {
              const { default: useAuthStore } = await import('../store/authStore');
              useAuthStore.getState().logout();
              window.location.href = '/login';
              throw err;
            })
            .finally(() => {
              _refreshPromise = null;
            });
        }
        try {
          const newToken = await _refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      } else {
        // No refresh token available — force logout & redirect
        const { default: useAuthStore } = await import('../store/authStore');
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
