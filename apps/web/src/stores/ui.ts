import { create } from 'zustand';
import type { Song } from '../lib/types';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

interface UiState {
  toasts: Toast[];
  toast: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
  dismiss: (id: number) => void;
  /** Songs waiting to be added to a playlist (opens the picker dialog). */
  addToPlaylist: Song[] | null;
  openAddToPlaylist: (songs: Song[]) => void;
  closeAddToPlaylist: () => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  toast: (message, opts = {}) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone: opts.tone ?? 'info', action: opts.action }] });
    setTimeout(() => get().dismiss(id), opts.action ? 6000 : 3800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  addToPlaylist: null,
  openAddToPlaylist: (songs) => set({ addToPlaylist: songs }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),
}));

export const toast = (...args: Parameters<UiState['toast']>) => useUiStore.getState().toast(...args);
