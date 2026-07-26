import { query } from '../db/connection';
import { getRecommendations } from './llmService';
import { execFileSync } from 'child_process';

interface TrackRow {
  id: string;
  title: string;
  duration: number;
  file_url: string | null;
  track_number: number;
  artist_id: string;
  album_id: string;
  genre: string;
  tags: string[];
  mood: string;
  tempo: number;
  plays_count: number;
  artist_name: string;
  album_title: string;
  album_cover_url: string | null;
}

interface RecommendationResult {
  tracks: TrackRow[];
  source: 'artist' | 'genre' | 'popular' | 'llm' | 'youtube';
  reasoning: string;
}

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { result: RecommendationResult; ts: number }>();

function cacheKey(trackId: string, userId: string): string {
  return `${userId}:${trackId}`;
}

function getCached(key: string): RecommendationResult | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.result;
  cache.delete(key);
  return null;
}

function setCache(key: string, result: RecommendationResult): void {
  cache.set(key, { result, ts: Date.now() });
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

async function getTrackById(id: string): Promise<TrackRow | null> {
  if (id.startsWith('yt__')) return null;
  const res = await query(
    `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
     FROM tracks t
     JOIN artists a ON t.artist_id = a.id
     JOIN albums al ON t.album_id = al.id
     WHERE t.id = $1`,
    [id],
  );
  return res.rows[0] || null;
}

async function getTracksByIds(ids: string[]): Promise<TrackRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const res = await query(
    `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
     FROM tracks t
     JOIN artists a ON t.artist_id = a.id
     JOIN albums al ON t.album_id = al.id
     WHERE t.id IN (${placeholders})`,
    ids,
  );
  return res.rows;
}

async function getRecentSkips(userId: string, limit = 5): Promise<string[]> {
  const res = await query(
    `SELECT track_id FROM listening_history
     WHERE user_id = $1
     ORDER BY listened_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => r.track_id);
}

async function sameArtistTracks(track: TrackRow, excludeId: string, limit = 5): Promise<TrackRow[]> {
  const res = await query(
    `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
     FROM tracks t
     JOIN artists a ON t.artist_id = a.id
     JOIN albums al ON t.album_id = al.id
     WHERE t.artist_id = $1 AND t.id != $2
     ORDER BY t.plays_count DESC
     LIMIT $3`,
    [track.artist_id, excludeId, limit],
  );
  return res.rows;
}

async function sameGenreTracks(track: TrackRow, excludeId: string, excludeArtistId: string, limit = 10): Promise<TrackRow[]> {
  const genre = track.genre || '';
  if (!genre) return [];

  const res = await query(
    `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
     FROM tracks t
     JOIN artists a ON t.artist_id = a.id
     JOIN albums al ON t.album_id = al.id
     WHERE t.genre = $1 AND t.id != $2 AND t.artist_id != $3
     ORDER BY t.plays_count DESC
     LIMIT $4`,
    [genre, excludeId, excludeArtistId, limit],
  );
  return res.rows;
}

async function popularFallback(genre: string, excludeIds: string[], limit = 5): Promise<TrackRow[]> {
  if (excludeIds.length === 0) {
    const genreClause = genre ? `AND t.genre = $1` : '';
    const res = await query(
      `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
       FROM tracks t
       JOIN artists a ON t.artist_id = a.id
       JOIN albums al ON t.album_id = al.id
       WHERE 1=1 ${genreClause}
       ORDER BY t.plays_count DESC
       LIMIT $${genre ? 2 : 1}`,
      genre ? [genre, limit] : [limit],
    );
    return res.rows;
  }
  const excludePlaceholders = excludeIds.map((_, i) => `$${i + 2}`).join(',');
  const res = await query(
    `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_url as album_cover_url
     FROM tracks t
     JOIN artists a ON t.artist_id = a.id
     JOIN albums al ON t.album_id = al.id
     WHERE t.id NOT IN (${excludePlaceholders}) ${genre ? `AND t.genre = $1` : ''}
     ORDER BY t.plays_count DESC
     LIMIT $1`,
    genre ? [genre, ...excludeIds] : [limit, ...excludeIds],
  );
  return res.rows;
}

function dedupe(tracks: TrackRow[]): TrackRow[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function ytSearchTracks(query: string, maxResults: number): TrackRow[] {
  try {
    const output = execFileSync('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--flat-playlist',
      `ytsearch${maxResults}:${query}`
    ], {
      timeout: 15000,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return output.trim().split('\n').filter(Boolean).map((line) => {
      try {
        const data = JSON.parse(line);
        const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`;
        const channelName = data.channel || data.uploader || data.channel_id || 'YouTube';
        return {
          id: `yt__${data.id}`,
          title: (data.title || 'Unknown').substring(0, 100),
          duration: typeof data.duration === 'number' ? Math.round(data.duration) : 0,
          file_url: null,
          track_number: 0,
          artist_id: '',
          album_id: '',
          genre: '',
          tags: [],
          mood: '',
          tempo: 0,
          plays_count: data.view_count || 0,
          artist_name: channelName.substring(0, 60),
          album_title: 'YouTube',
          album_cover_url: thumbnail,
        } as TrackRow;
      } catch { return null; }
    }).filter(Boolean) as TrackRow[];
  } catch {
    return [];
  }
}

function parseYoutubeId(id: string): string | null {
  if (id.startsWith('yt__')) return id.substring(4);
  return null;
}

export async function getUpNext(
  trackId: string,
  userId: string,
  limit = 10,
): Promise<RecommendationResult> {
  const key = cacheKey(trackId, userId);
  const cached = getCached(key);
  if (cached) return cached;

  const track = await getTrackById(trackId);

  if (!track) {
    // Track not in database — likely a YouTube track. Use YouTube related search.
    const ytId = parseYoutubeId(trackId);
    if (ytId) {
      try {
        const output = execFileSync('yt-dlp', [
          '--dump-json',
          '--no-warnings',
          '--flat-playlist',
          `ytsearch${limit + 5}:related music`
        ], {
          timeout: 15000,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const tracks: TrackRow[] = output.trim().split('\n').filter(Boolean).map((line) => {
          try {
            const data = JSON.parse(line);
            if (data.id === ytId) return null;
            const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`;
            const channelName = data.channel || data.uploader || 'YouTube';
            return {
              id: `yt__${data.id}`,
              title: (data.title || 'Unknown').substring(0, 100),
              duration: typeof data.duration === 'number' ? Math.round(data.duration) : 0,
              file_url: null,
              track_number: 0,
              artist_id: '',
              album_id: '',
              genre: '',
              tags: [],
              mood: '',
              tempo: 0,
              plays_count: data.view_count || 0,
              artist_name: channelName.substring(0, 60),
              album_title: 'YouTube',
              album_cover_url: thumbnail,
            } as TrackRow;
          } catch { return null; }
        }).filter(Boolean) as TrackRow[];

        const uniqueTracks = dedupe(tracks).slice(0, limit);
        const result: RecommendationResult = {
          tracks: uniqueTracks,
          source: 'youtube',
          reasoning: 'YouTube related tracks for non-database track',
        };
        setCache(key, result);
        return result;
      } catch {
        // YouTube search failed
      }
    }

    const popular = await popularFallback('', [], limit);
    const result: RecommendationResult = { tracks: popular, source: 'popular', reasoning: 'Track not found, showing popular tracks' };
    setCache(key, result);
    return result;
  }

  const result = await buildRecommendations(track, userId, limit);
  setCache(key, result);
  return result;
}

async function buildRecommendations(
  track: TrackRow,
  userId: string,
  limit: number,
): Promise<RecommendationResult> {
  const artists = await sameArtistTracks(track, track.id, limit);
  const genreTracks = artists.length < limit
    ? await sameGenreTracks(track, track.id, track.artist_id, limit - artists.length)
    : [];

  let combined = dedupe([...artists, ...genreTracks]);

  if (combined.length < limit) {
    const excludeIds = combined.map((t) => t.id).concat(track.id);
    const popular = await popularFallback(track.genre || '', excludeIds, limit - combined.length);
    combined = dedupe([...combined, ...popular]);
  }

  combined = combined.slice(0, limit);

  let reasoning = `Same artist: ${artists.length}, Same genre: ${genreTracks.length}`;
  let source: RecommendationResult['source'] = 'artist';

  if (artists.length > 0) source = 'artist';
  else if (genreTracks.length > 0) source = 'genre';
  else source = 'popular';

  const recentSkips = await getRecentSkips(userId);

  if (combined.length > 3) {
    try {
      const llmResult = await getRecommendations(
        {
          id: track.id,
          title: track.title,
          artist: track.artist_name,
          genre: track.genre || '',
          tags: track.tags || [],
          mood: track.mood || '',
          tempo: track.tempo || 0,
        },
        combined.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist_name,
          genre: t.genre || '',
          tags: t.tags || [],
          mood: t.mood || '',
          tempo: t.tempo || 0,
        })),
        recentSkips,
      );

      if (llmResult?.track_ids?.length) {
        const llmTracks = await getTracksByIds(llmResult.track_ids);
        if (llmTracks.length > 0) {
          combined = dedupe([...llmTracks]).slice(0, limit);
          reasoning = `LLM: ${llmResult.reasoning}`;
          source = 'llm';
        }
      }
    } catch {
      // LLM unavailable, fall through to rule-based result
    }
  }

  return { tracks: combined, source, reasoning };
}

export async function recordSkip(trackId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO listening_history (user_id, track_id) VALUES ($1, $2)`,
    [userId, trackId],
  );

  const keyPattern = `${userId}:`;
  for (const [k] of cache) {
    if (k.startsWith(keyPattern)) cache.delete(k);
  }
}

export async function getUpNextFromQueue(
  currentTrackId: string,
  manualQueueIds: string[],
  userId: string,
  limit = 10,
): Promise<{ recommendations: TrackRow[]; manual: TrackRow[]; suggested: TrackRow[] }> {
  const manualTracks = manualQueueIds.length > 0 ? await getTracksByIds(manualQueueIds) : [];
  const manualCount = manualTracks.length;

  if (manualCount >= limit) {
    return { recommendations: manualTracks.slice(0, limit), manual: manualTracks.slice(0, limit), suggested: [] };
  }

  const recResult = await getUpNext(currentTrackId, userId, limit - manualCount);
  const suggestedTracks = recResult.tracks.filter((t) => !manualQueueIds.includes(t.id));

  return {
    recommendations: [...manualTracks, ...suggestedTracks].slice(0, limit),
    manual: manualTracks,
    suggested: suggestedTracks,
  };
}
