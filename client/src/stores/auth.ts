import { create } from 'zustand';
import {
  login as apiLogin,
  register as apiRegister,
  googleLogin as apiGoogleLogin,
  logout as apiLogout,
  getProfile,
  getToken,
  clearToken,
  type User,
} from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isAuthenticated: !!getToken(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await apiLogin({ email, password });
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Login failed' });
      throw err;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await apiRegister({ email, password });
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Registration failed' });
      throw err;
    }
  },

  googleLogin: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await apiGoogleLogin({ credential });
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Google login failed' });
      throw err;
    }
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = getToken();
    if (!token) { set({ isAuthenticated: false, user: null, token: null }); return; }
    set({ isLoading: true });
    try {
      const user = await getProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      clearToken();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
