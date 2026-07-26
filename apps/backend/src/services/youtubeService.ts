import { execFileSync } from 'child_process';
import { extractMetadata, detectGenre, relatedSearchQuery } from './metadataCleaner';

interface YouTubeTrack {
  id: string;
  title: string;
  duration: number;
  artist_name: string;
  album_title: string;
  album_cover_url: string | null;
  file_url: string | null;
  source: 'youtube';
  youtube_id: string;
  plays_count: number;
}

function parseDuration(duration: number | string): number {
  if (typeof duration === 'number') return Math.round(duration);
  return 0;
}

function parseLine(line: string): YouTubeTrack | null {
  try {
    const data = JSON.parse(line);
    const duration = parseDuration(data.duration || 0);
    const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`;
    const channelName = data.channel || data.uploader || data.channel_id || 'YouTube';
    const rawTitle = data.title || 'Unknown';

    const { title, artist } = extractMetadata(rawTitle, channelName);

    return {
      id: `yt__${data.id}`,
      title,
      duration,
      artist_name: artist,
      album_title: data.album || data.playlist_title || 'YouTube',
      album_cover_url: thumbnail,
      file_url: null,
      source: 'youtube' as const,
      youtube_id: data.id,
      plays_count: data.view_count || 0,
    };
  } catch { return null; }
}

function ytSearch(query: string, maxResults: number): YouTubeTrack[] {
  const output = execFileSync('yt-dlp', [
    '--dump-json',
    '--no-warnings',
    '--flat-playlist',
    '--extractor-args', 'youtube:player_client=ios',
    `ytsearch${maxResults}:${query}`
  ], { 
    timeout: 15000, 
    encoding: 'utf-8', 
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return output.trim().split('\n').filter(Boolean).map(parseLine).filter(Boolean) as YouTubeTrack[];
}

export const youtubeService = {
  search(query: string, maxResults = 20): YouTubeTrack[] {
    try {
      const tracks = ytSearch(query, maxResults);
      if (tracks.length > 0) return tracks;

      const tokens = query.split(' ').filter((t) => t.length > 0);
      if (tokens.length > 1) {
        const shorter = tokens.slice(0, Math.max(2, tokens.length - 1)).join(' ');
        const retry = ytSearch(shorter, maxResults);
        if (retry.length > 0) return retry;
      }
      if (tokens.length > 2) {
        const retry2 = ytSearch(tokens.slice(0, 2).join(' '), maxResults);
        if (retry2.length > 0) return retry2;
      }

      return ytSearch('popular music', maxResults);
    } catch (err) {
      try { return ytSearch('trending music', maxResults); } catch { return []; }
    }
  },

  getAudioUrl(youtubeId: string): string | null {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return null;
    }
    const url = `https://www.youtube.com/watch?v=${youtubeId}`;
    const clients = ['ios', 'web_creator', 'mweb'];
    for (const client of clients) {
      try {
        const output = execFileSync('yt-dlp', [
          '-f', 'bestaudio',
          '--get-url',
          '--no-warnings',
          '--extractor-args', `youtube:player_client=${client}`,
          url
        ], { 
          timeout: 12000, 
          encoding: 'utf-8', 
          maxBuffer: 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const trimmed = output.trim();
        if (trimmed && trimmed.startsWith('http')) return trimmed;
      } catch { continue; }
    }
    return null;
  },

  getDetails(youtubeId: string): YouTubeTrack | null {
    try {
      if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
        console.error('Invalid YouTube ID format:', youtubeId);
        return null;
      }
      const url = `https://www.youtube.com/watch?v=${youtubeId}`;
      const output = execFileSync('yt-dlp', [
        '--dump-json',
        '--no-warnings',
        url
      ], { 
        timeout: 15000, 
        encoding: 'utf-8', 
        maxBuffer: 5 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return parseLine(output.trim());
    } catch (err) {
      console.error('Failed to get YouTube details for', youtubeId, err);
      return null;
    }
  },

  related(query: string, _maxResults = 12): YouTubeTrack[] {
    try {
      const tokens = query.split(' ').filter((t) => t.length > 0);

      const potentialArtist = tokens.slice(0, 2).join(' ');
      const potentialTitle = tokens.slice(2).join(' ');
      const genre = detectGenre(potentialTitle || query, potentialArtist);

      const searchQuery = relatedSearchQuery(potentialTitle || query, potentialArtist, genre);
      const tracks = ytSearch(searchQuery, 12);

      if (tracks.length > 8) return tracks;

      if (tokens.length > 2) {
        const fallback = ytSearch(tokens.slice(0, 3).join(' ') + ' music', 12);
        if (fallback.length > tracks.length) return fallback;
      }

      return tracks;
    } catch {
      return [];
    }
  },
};