export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  /** Why the AI picked this song (radio, mixes, generated playlists). */
  reason?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string;
  aiPrompt: string | null;
  songCount: number;
  duration: number;
  coverIds: string[];
  updatedAt: string;
}

export interface Playlist extends PlaylistSummary {
  songs: (Song & { addedAt: string })[];
}

export interface Mix {
  id: string;
  title: string;
  subtitle: string;
  kind: 'ai' | 'radio' | 'query';
  coverIds: string[];
}

export interface HomeData {
  mixes: Mix[];
  aiPending: boolean;
  aiReady: boolean;
  aiEnabled: boolean;
  /** Set when the daily AI quota is exhausted: AI features fall back until then. */
  aiPausedUntil: string | null;
  recent: (Song & { playedAt: string })[];
  playlists: PlaylistSummary[];
  topArtists: { name: string; score: number }[];
}

export interface GeneratedPlaylist {
  name: string;
  description: string;
  songs: Song[];
  model: string;
}

export interface SmartSearchResult {
  interpretation: string;
  songs: Song[];
  model: string;
}

export interface RadioResult {
  songs: Song[];
  source: 'ai' | 'mix';
  model?: string;
}
