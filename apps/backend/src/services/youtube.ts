import { execFile } from 'child_process';
import { promisify } from 'util';
import { TTLCache, limiter } from '../lib/cache';
import { extractMetadata } from '../lib/metadata';
import { Song, YT_ID } from '../lib/types';
import { SONG_MAX_SECONDS, SONG_MIN_SECONDS, isLikelySong } from '../lib/songFilter';

const run = promisify(execFile);
const ytLimit = limiter(6);

const MIN = 60 * 1000;
const searchCache = new TTLCache<Song[]>(30 * MIN, 400);
const mixCache = new TTLCache<Song[]>(60 * MIN, 300);
const resolveCache = new TTLCache<Song | null>(7 * 24 * 60 * MIN, 3000);
const streamCache = new TTLCache<string>(60 * MIN, 500);

/** Thrown when YouTube asks yt-dlp to prove it is not a bot. */
export class YouTubeBlockedError extends Error {
  constructor(public retryAt: number) {
    super('YouTube limite temporairement les requêtes, réessaie dans quelques minutes');
  }
}

export const isBotCheck = (message: string) => /confirm you.?re not a bot|sign in to confirm|HTTP Error 429|too many requests/i.test(message);

const BOT_COOLDOWN_MS = 3 * 60 * 1000;
let blockedUntil = 0;

/** Optional cookies (exported from a logged-in browser) make YouTube far less likely to block. */
function cookieArgs(): string[] {
  if (process.env.YTDLP_COOKIES) return ['--cookies', process.env.YTDLP_COOKIES];
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) return ['--cookies-from-browser', process.env.YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

export const youtubeBlockedUntil = () => (blockedUntil > Date.now() ? new Date(blockedUntil).toISOString() : null);

async function ytdlp(args: string[], timeout = 20000): Promise<string> {
  // Hammering YouTube while it is challenging us only extends the block: back off instead.
  if (blockedUntil > Date.now()) throw new YouTubeBlockedError(blockedUntil);
  return ytLimit(async () => {
    try {
      const { stdout } = await run('yt-dlp', ['--no-warnings', ...cookieArgs(), ...args], {
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        encoding: 'utf-8',
      });
      return stdout;
    } catch (err) {
      const message = `${(err as { stderr?: string }).stderr ?? ''} ${(err as Error).message}`;
      if (isBotCheck(message)) {
        blockedUntil = Date.now() + BOT_COOLDOWN_MS;
        console.warn(`[youtube] bot check from YouTube: pausing yt-dlp for ${BOT_COOLDOWN_MS / 60000} min` + (cookieArgs().length ? '' : ' (set YTDLP_COOKIES to reduce this)'));
        throw new YouTubeBlockedError(blockedUntil);
      }
      throw err;
    }
  });
}

interface RawEntry {
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  duration?: number | null;
  live_status?: string | null;
}

/** Converts a raw entry; with `songsOnly`, films, shows, albums and compilations are dropped. */
function toSong(raw: RawEntry, songsOnly = true, hint?: string): Song | null {
  if (!raw.id || !YT_ID.test(raw.id) || !raw.title) return null;
  if (raw.title === '[Private video]' || raw.title === '[Deleted video]') return null;
  if (raw.live_status === 'is_live' || raw.live_status === 'is_upcoming') return null;
  const rawChannel = raw.channel || raw.uploader || 'YouTube';
  if (songsOnly && !isLikelySong({ title: raw.title, channel: rawChannel, duration: Math.round(raw.duration || 0) })) return null;
  const channel = rawChannel.replace(/\s*-\s*Topic$/i, '');
  const { title, artist } = extractMetadata(raw.title, channel, hint);
  return { id: raw.id, title, artist, duration: Math.round(raw.duration || 0) };
}

/** Keeps actual songs: drops shorts, livestreams and hour-long compilations. */
export function isSongLike(song: Song, maxSeconds = SONG_MAX_SECONDS) {
  return song.duration === 0 || (song.duration >= SONG_MIN_SECONDS && song.duration <= maxSeconds);
}

function parseLines(stdout: string): RawEntry[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as RawEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is RawEntry => Boolean(x));
}

function dedupe(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const youtube = {
  async search(q: string, limit = 20): Promise<Song[]> {
    const query = q.trim().slice(0, 150);
    if (!query) return [];
    return searchCache.wrap(`${limit}:${norm(query)}`, async () => {
      // Over-fetch: the song filter typically drops 10–40 % of raw results.
      const out = await ytdlp(['--dump-json', '--flat-playlist', `ytsearch${Math.ceil(limit * 1.6)}:${query}`]);
      return dedupe(parseLines(out).map((r) => toSong(r, true, query)).filter((s): s is Song => !!s)).slice(0, limit);
    });
  },

  /** YouTube's own "Mix" (RD playlist) for a video: a strong, fast similarity signal. */
  async mix(videoId: string, limit = 25): Promise<Song[]> {
    if (!YT_ID.test(videoId)) return [];
    return mixCache.wrap(`${videoId}:${limit}`, async () => {
      try {
        const out = await ytdlp([
          '--dump-json',
          '--flat-playlist',
          '--playlist-end',
          String(limit + 1),
          `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`,
        ]);
        return dedupe(parseLines(out).map((r) => toSong(r)).filter((s): s is Song => !!s && s.id !== videoId));
      } catch (err) {
        console.warn('[youtube] mix failed for', videoId, (err as Error).message);
        return [];
      }
    });
  },

  /** Finds the best YouTube video for a "title — artist" pair proposed by the AI. */
  async resolve(title: string, artist: string): Promise<Song | null> {
    const key = `${norm(artist)}|${norm(title)}`;
    return resolveCache.wrap(key, async () => {
      try {
        const candidates = await youtube.search(`${artist} ${title} audio`, 6);
        return pickBestMatch(candidates, title, artist);
      } catch {
        return null;
      }
    });
  },

  /** Direct audio URL (googlevideo), cached until shortly before it expires. */
  async streamUrl(videoId: string, fresh = false): Promise<string | null> {
    if (!YT_ID.test(videoId)) return null;
    if (fresh) streamCache.delete(videoId);
    const cached = streamCache.get(videoId);
    if (cached) return cached;
    // A JS runtime lets yt-dlp solve YouTube's signature challenge. Without it,
    // it falls back to clients whose URLs are cut off after ~1 MB (HTTP 403).
    const attempts: string[][] = [['--js-runtimes', 'node'], []];
    for (const extra of attempts) {
      try {
        const args = [...extra, '-f', 'bestaudio[ext=m4a]/bestaudio', '--get-url'];
        const out = (await ytdlp([...args, `https://www.youtube.com/watch?v=${videoId}`], 30000)).trim().split('\n')[0];
        if (out?.startsWith('http')) {
          const expire = Number(new URL(out).searchParams.get('expire')) * 1000;
          const ttl = expire ? Math.max(MIN, expire - Date.now() - 10 * MIN) : 60 * MIN;
          streamCache.set(videoId, out, ttl);
          return out;
        }
      } catch (err) {
        if (err instanceof YouTubeBlockedError) throw err;
        console.warn('[youtube] stream url failed', videoId, (err as Error).message.split('\n').slice(-2).join(' '));
      }
    }
    return null;
  },
};

export function pickBestMatch(candidates: Song[], title: string, artist: string): Song | null {
  if (!candidates.length) return null;
  const wantTitle = norm(title).split(' ').filter((w) => w.length > 1);
  const wantArtist = norm(artist).split(' ').filter((w) => w.length > 1);
  const allowLive = /live/i.test(title);

  const scored = candidates.map((song, rank) => {
    const hay = norm(`${song.title} ${song.artist}`);
    let score = -rank * 0.5; // YouTube's own ranking is a decent prior
    const titleHits = wantTitle.filter((w) => hay.includes(w)).length;
    const artistHits = wantArtist.filter((w) => hay.includes(w)).length;
    score += (titleHits / Math.max(1, wantTitle.length)) * 6;
    score += (artistHits / Math.max(1, wantArtist.length)) * 4;
    if (song.duration >= 90 && song.duration <= 600) score += 1.5;
    if (song.duration > 900) score -= 6;
    if (/karaoke|instrumental|8d audio|slowed|reverb|sped up|nightcore|1 hour|tutorial|reaction/i.test(song.title)) score -= 4;
    if (!allowLive && /\blive\b/i.test(song.title)) score -= 1.5;
    if (/cover/i.test(song.title) && !/cover/i.test(title)) score -= 2;
    return { song, score, titleHits, artistHits, titleRatio: titleHits / Math.max(1, wantTitle.length) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Refuse doubtful matches instead of playing (and mislabelling) something random:
  // the artist must appear and at least half of the title words must match.
  if (!best || best.artistHits === 0 || best.titleRatio < 0.5) return null;
  return best.song;
}
