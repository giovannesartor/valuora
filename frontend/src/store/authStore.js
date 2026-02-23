import { create } from 'zustand';
import api from '../lib/api';

// Decode JWT payload (base64) without library
function _decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function _getAdminFromToken() {
  const token = localStorage.getItem('access_token');
  if (!token) return { isAdmin: false, isSuperAdmin: false, isPartner: false };
  const payload = _decodeJwtPayload(token);
  return {
    isAdmin: !!payload?.admin,
    isSuperAdmin: !!payload?.superadmin,
    isPartner: !!payload?.partner,
  };
}

const { isAdmin: initAdmin, isSuperAdmin: initSuperAdmin, isPartner: initPartner } = _getAdminFromToken();

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isAdmin: initAdmin,
  isSuperAdmin: initSuperAdmin,
  isPartner: initPartner,
  loading: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const adminState = _getAdminFromToken();
    set({
      isAuthenticated: true,
      isAdmin: adminState.isAdmin,
      isSuperAdmin: adminState.isSuperAdmin,
      isPartner: adminState.isPartner,
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
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
      isPartner: false,
    });
  },

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { data } = await api.get('/auth/me');
      const adminState = _getAdminFromToken();
      set({
        user: data,
        isAuthenticated: true,
        isAdmin: adminState.isAdmin,
        isSuperAdmin: adminState.isSuperAdmin,
        isPartner: adminState.isPartner,
        loading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isAdmin: false, isSuperAdmin: false, isPartner: false, loading: false });
    }
  },
}));

export default useAuthStore;
