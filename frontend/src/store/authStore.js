import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isAdmin: localStorage.getItem('is_admin') === 'true',
  isSuperAdmin: localStorage.getItem('is_superadmin') === 'true',
  loading: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('is_admin', data.is_admin ? 'true' : 'false');
    localStorage.setItem('is_superadmin', data.is_superadmin ? 'true' : 'false');
    set({
      isAuthenticated: true,
      isAdmin: !!data.is_admin,
      isSuperAdmin: !!data.is_superadmin,
    });
    // Fetch user
    const userRes = await api.get('/auth/me');
    set({ user: userRes.data });
  },

  register: async (formData) => {
    await api.post('/auth/register', formData);
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('is_superadmin');
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
    });
  },

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { data } = await api.get('/auth/me');
      set({
        user: data,
        isAuthenticated: true,
        isAdmin: !!data.is_admin,
        isSuperAdmin: !!data.is_superadmin,
        loading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isAdmin: false, isSuperAdmin: false, loading: false });
    }
  },
}));

export default useAuthStore;
