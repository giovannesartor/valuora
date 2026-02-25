import { create } from 'zustand';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

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

const { isAdmin: initAdmin, isSuperAdmin: initSuperAdmin, isPartner: initPartner
  } = _getAdminFromToken();                                                      
                                                        
let sessionWarningShown = false;
let refreshPromise = null;

const useAuthStore = create((set, get) => ({
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
    // Call backend to blacklist token (fire & forget)
    const token = localStorage.getItem('access_token');
    if (token) {
      api.post('/auth/logout').catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionWarningShown = false;
    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
      isPartner: false,
    });
  },

  refreshToken: async () => {
    // If a refresh is already in progress, return that promise
    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      get().logout();
      return null;
    }

    refreshPromise = (async () => {
      try {
        const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
        const adminState = _getAdminFromToken();
        set({
          isAuthenticated: true,
          isAdmin: adminState.isAdmin,
          isSuperAdmin: adminState.isSuperAdmin,
          isPartner: adminState.isPartner,
        });
        return data.access_token;
      } catch (error) {
        // Refresh failed, logout user
        get().logout();
        toast.error('Sessão expirada. Faça login novamente.');
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  checkSessionExpiry: () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const payload = _decodeJwtPayload(token);
    if (!payload || !payload.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    const fiveMinutes = 300; // 5 minutes in seconds

    // Show warning if session expires in less than 5 minutes and we haven't shown it yet
    if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0 && !sessionWarningShown) {
      sessionWarningShown = true;
      toast('Sua sessão expirará em ' + Math.ceil(timeUntilExpiry / 60) + ' minuto(s)', {
        duration: 10000,
        icon: '⏰',
      });

      // Try to refresh token
      setTimeout(() => {
        get().refreshToken();
      }, 1000);
    }

    // Auto-refresh if expiring soon
    if (timeUntilExpiry < fiveMinutes && !refreshPromise) {
      get().refreshToken();
    }
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
      set({ user: null, isAuthenticated: false, isAdmin: false, isSuperAdmin: false, isPartner: false, loading: false });                                           }
  },
}));

export default useAuthStore;
