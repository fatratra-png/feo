import type {
  GeneratedPlaylist,
  HomeData,
  Playlist,
  PlaylistSummary,
  RadioResult,
  SmartSearchResult,
  Song,
  User,
} from './types';

const BASE = '/api';
const ACCESS = 'feo_access_token';
const REFRESH = 'feo_refresh_token';

const storage = {
  get: (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k: string, v: string | null) => {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

let accessToken = storage.get(ACCESS);
let refreshToken = storage.get(REFRESH);
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  storage.set(ACCESS, access);
  storage.set(REFRESH, refresh);
}

export const hasSession = () => Boolean(accessToken || refreshToken);

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Single in-flight refresh shared by every request that hits a 401. */
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const build = (): RequestInit => ({
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(rest.headers as Record<string, string>),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, build());
  } catch {
    throw new ApiError(0, 'Connexion impossible au serveur');
  }

  if (res.status === 401 && refreshToken && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      res = await fetch(`${BASE}${path}`, build());
    } else {
      setTokens(null, null);
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
    addSongs: (id: string, songs: Song[]) =>
      request<{ added: number }>(`/playlists/${id}/songs`, { method: 'POST', json: { songs: songs.map(toSong) } }),
    removeSong: (id: string, songId: string) => request(`/playlists/${id}/songs/${songId}`, { method: 'DELETE' }),
    reorder: (id: string, songIds: string[]) => request(`/playlists/${id}/order`, { method: 'PUT', json: { songIds } }),
  },
  radio: (seeds: Song[], exclude: string[], smart: boolean, count = 10) =>
    request<RadioResult>('/radio', { method: 'POST', json: { seeds: seeds.map(toSong), exclude, smart, count } }),
  generatePlaylist: (prompt: string, count: number) =>
    request<GeneratedPlaylist>('/ai/playlist', { method: 'POST', json: { prompt, count } }),
};

export const streamUrl = (id: string) => `${BASE}/stream/${id}`;
export const coverUrl = (id: string, size: 'sm' | 'lg' = 'sm') => `${BASE}/thumb/${id}${size === 'lg' ? '?size=lg' : ''}`;
