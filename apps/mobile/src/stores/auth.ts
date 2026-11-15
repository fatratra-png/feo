import { create } from 'zustand';
import { api, loadTokens, setTokens } from '../lib/api';
import type { Session, User } from '../lib/types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  /** Starts a session obtained elsewhere (Google/GitHub). */
  setSession: (session: Session) => Promise<void>;
  /** Reloads the profile (hasPassword, providers) after an account change. */
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  init: async () => {
    if (!(await loadTokens())) return set({ status: 'anonymous' });
    try {
      set({ user: await api.auth.me(), status: 'authenticated' });
    } catch {
      await setTokens(null, null);
      set({ user: null, status: 'anonymous' });
    }
  },
  login: async (email, password) => {
    const res = await api.auth.login(email, password);
    await setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, status: 'authenticated' });
  },
  register: async (email, password, displayName) => {
    const res = await api.auth.register(email, password, displayName);
    await setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, status: 'authenticated' });
  },
  logout: async () => {
    await api.auth.logout();
    await setTokens(null, null);
    set({ user: null, status: 'anonymous' });
  },
  expire: () => set({ user: null, status: 'anonymous' }),
  setSession: async ({ user, accessToken, refreshToken }) => {
    await setTokens(accessToken, refreshToken);
    set({ user, status: 'authenticated' });
  },
  refreshUser: async () => {
    set({ user: await api.auth.me() });
  },
}));
