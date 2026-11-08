import { create } from 'zustand';
import { api, hasSession, setTokens } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: hasSession() ? 'loading' : 'anonymous',

  init: async () => {
    if (!hasSession()) return set({ status: 'anonymous' });
    try {
      set({ user: await api.auth.me(), status: 'authenticated' });
    } catch {
      setTokens(null, null);
      set({ user: null, status: 'anonymous' });
    }
  },

  login: async (email, password) => {
    const res = await api.auth.login(email, password);
    setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, status: 'authenticated' });
  },

  register: async (email, password, displayName) => {
    const res = await api.auth.register(email, password, displayName);
    setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, status: 'authenticated' });
  },

  logout: async () => {
    await api.auth.logout();
    setTokens(null, null);
    set({ user: null, status: 'anonymous' });
  },

  expire: () => set({ user: null, status: 'anonymous' }),
}));
