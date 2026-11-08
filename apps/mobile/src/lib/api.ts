import { Platform } from 'react-native';
import { storage } from './storage';
import type { GeneratedPlaylist, HomeData, Playlist, PlaylistSummary, RadioResult, SmartSearchResult, Song, User } from './types';

/**
 * On a phone, "localhost" is the phone itself: set EXPO_PUBLIC_API_URL to the
 * computer's LAN address, e.g. http://192.168.1.20:3001/api
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api')).replace(/\/$/, '');

const ACCESS = 'feo_access_token';
const REFRESH = 'feo_refresh_token';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export async function loadTokens() {
  [accessToken, refreshToken] = await Promise.all([storage.get(ACCESS), storage.get(REFRESH)]);
  return Boolean(accessToken || refreshToken);
}

export async function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  await Promise.all([
    access ? storage.set(ACCESS, access) : storage.remove(ACCESS),
    refresh ? storage.set(REFRESH, refresh) : storage.remove(REFRESH),
  ]);
}

export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const build = (): RequestInit => ({
    method: init.method ?? 'GET',
    headers: {
      ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, build());
  } catch {
    throw new ApiError(0, `Serveur injoignable (${API_URL})`);
  }
  if (res.status === 401 && refreshToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await fetch(`${API_URL}${path}`, build());
    else {
      await setTokens(null, null);
      onSessionExpired?.();
      throw new ApiError(401, 'Ta session a expiré, reconnecte-toi');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message || `Erreur ${res.status}`, body.code);
  }
  return res.json() as Promise<T>;
}

const toSong = ({ id, title, artist, duration }: Song): Song => ({ id, title, artist, duration });

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', json: { email, password } }),
    register: (email: string, password: string, displayName: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', { method: 'POST', json: { email, password, displayName } }),
    me: () => request<User>('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => undefined),
  },
  search: (q: string) => request<{ songs: Song[] }>(`/search?q=${encodeURIComponent(q)}`),
  smartSearch: (q: string) => request<SmartSearchResult>('/ai/search', { method: 'POST', json: { q } }),
  home: () => request<HomeData>('/home'),
  refreshHome: () => request<{ started: boolean }>('/home/refresh', { method: 'POST' }),
  mix: (id: string) => request<{ songs: Song[] }>(`/mixes/${encodeURIComponent(id)}`),
  likes: {
    list: () => request<{ songs: (Song & { likedAt: string })[] }>('/library/likes'),
    ids: () => request<{ ids: string[] }>('/library/like-ids'),
    add: (song: Song) => request(`/library/likes/${song.id}`, { method: 'PUT', json: toSong(song) }),
    remove: (id: string) => request(`/library/likes/${id}`, { method: 'DELETE' }),
  },
  history: () => request<{ songs: (Song & { playedAt: string })[] }>('/library/history'),
  recordPlay: (song: Song, listenedSeconds: number, completed: boolean, skipped: boolean) =>
    request('/plays', { method: 'POST', json: { song: toSong(song), listenedSeconds, completed, skipped } }).catch(() => undefined),
  playlists: {
    list: () => request<{ playlists: PlaylistSummary[] }>('/playlists'),
    get: (id: string) => request<Playlist>(`/playlists/${id}`),
    create: (data: { name: string; description?: string; aiPrompt?: string; songs?: Song[] }) =>
      request<{ id: string }>('/playlists', { method: 'POST', json: { ...data, songs: data.songs?.map(toSong) } }),
    update: (id: string, data: { name?: string; description?: string }) => request(`/playlists/${id}`, { method: 'PATCH', json: data }),
    remove: (id: string) => request(`/playlists/${id}`, { method: 'DELETE' }),
    addSongs: (id: string, songs: Song[]) => request<{ added: number }>(`/playlists/${id}/songs`, { method: 'POST', json: { songs: songs.map(toSong) } }),
    removeSong: (id: string, songId: string) => request(`/playlists/${id}/songs/${songId}`, { method: 'DELETE' }),
    reorder: (id: string, songIds: string[]) => request(`/playlists/${id}/order`, { method: 'PUT', json: { songIds } }),
  },
  radio: (seeds: Song[], exclude: string[], smart: boolean, count = 10) =>
    request<RadioResult>('/radio', { method: 'POST', json: { seeds: seeds.map(toSong), exclude, smart, count } }),
  generatePlaylist: (prompt: string, count: number) => request<GeneratedPlaylist>('/ai/playlist', { method: 'POST', json: { prompt, count } }),
};

export const streamUrl = (id: string) => `${API_URL}/stream/${id}`;
export const coverUrl = (id: string, size: 'sm' | 'lg' = 'sm') => `${API_URL}/thumb/${id}${size === 'lg' ? '?size=lg' : ''}`;
