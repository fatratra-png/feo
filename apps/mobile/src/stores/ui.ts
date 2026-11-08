import { create } from 'zustand';
import type { Song } from '../lib/types';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

export interface SongSheetOptions {
  song: Song;
  onRemove?: () => void;
  removeLabel?: string;
  move?: { up?: () => void; down?: () => void };
}

interface UiState {
  toasts: Toast[];
  toast: (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
  dismiss: (id: number) => void;
  /** Bottom sheet with the actions for one song. */
  songSheet: SongSheetOptions | null;
  openSongSheet: (o: SongSheetOptions) => void;
  closeSongSheet: () => void;
  /** Songs waiting to be added to a playlist. */
  addToPlaylist: Song[] | null;
  openAddToPlaylist: (songs: Song[]) => void;
  closeAddToPlaylist: () => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  toast: (message, opts = {}) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-1), { id, message, tone: opts.tone ?? 'info', action: opts.action }] });
    setTimeout(() => get().dismiss(id), opts.action ? 6000 : 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  songSheet: null,
  openSongSheet: (songSheet) => set({ songSheet }),
  closeSongSheet: () => set({ songSheet: null }),
  addToPlaylist: null,
  openAddToPlaylist: (songs) => set({ addToPlaylist: songs, songSheet: null }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),
}));

export const toast = (...args: Parameters<UiState['toast']>) => useUiStore.getState().toast(...args);
