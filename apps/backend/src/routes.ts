import { Router, type RequestHandler } from 'express';
import { Readable } from 'stream';
import { z } from 'zod';
import { aiEnabled } from './config';
import { TTLCache } from './lib/cache';
import { AppError, handler } from './lib/http';
import { YT_ID } from './lib/types';
import * as ai from './services/ai';
import { auth, authenticate } from './services/auth';
import * as library from './services/library';
import { aiPausedUntil, consumeAiQuota } from './services/llm';
import { playlists } from './services/playlists';
import { youtube, youtubeBlockedUntil } from './services/youtube';

/* ---------------- validation schemas ---------------- */

const songSchema = z.object({
  id: z.string().regex(YT_ID, 'identifiant YouTube invalide'),
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().min(1).max(200),
  duration: z.number().int().min(0).max(24 * 3600).default(0),
});
const idParam = z.object({ id: z.string().uuid('identifiant invalide') });
const ytParam = z.object({ id: z.string().regex(YT_ID, 'identifiant YouTube invalide') });

export const router = Router();

/** Resolving a stream URL takes ~5 s (yt-dlp): do it ahead for the songs most likely to be played. */
function warmStreams(ids: string[]) {
  for (const id of ids) youtube.streamUrl(id).catch(() => null);
}

router.get('/health', (_req, res) =>
  res.json({ status: 'ok', ai: aiEnabled(), aiPausedUntil: aiPausedUntil(), youtubeBlockedUntil: youtubeBlockedUntil(), time: new Date().toISOString() }),
);

/* ---------------- auth ---------------- */

/** Per-IP fixed-window limiter for credential endpoints (blocks password guessing). */
function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return next();
    }
    if (++entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message: 'Trop de tentatives, réessaie dans quelques minutes' });
    }
    next();
  };
}
const authLimit = rateLimit(10, 10 * 60 * 1000);

router.post('/auth/register', authLimit, handler(async (req, res) => {
  const body = z.object({
    email: z.string().trim().email('email invalide'),
    password: z.string().min(8, 'au moins 8 caractères').max(128),
    displayName: z.string().trim().min(2, 'au moins 2 caractères').max(60),
  }).parse(req.body);
  res.status(201).json(await auth.register(body.email, body.password, body.displayName));
}));

router.post('/auth/login', authLimit, handler(async (req, res) => {
  const body = z.object({ email: z.string().trim().email('email invalide'), password: z.string().min(1).max(128) }).parse(req.body);
  res.json(await auth.login(body.email, body.password));
}));

router.post('/auth/refresh', handler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
  res.json(await auth.refresh(refreshToken));
}));

router.get('/auth/me', authenticate, handler(async (req, res) => res.json(await auth.me(req.userId!))));

router.post('/auth/logout', authenticate, handler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
  await auth.logout(req.userId!, refreshToken);
  res.json({ ok: true });
}));

/* ---------------- catalogue (public) ---------------- */

router.get('/search', authenticate, handler(async (req, res) => {
  const { q, limit } = z.object({ q: z.string().trim().max(150).default(''), limit: z.coerce.number().int().min(1).max(40).default(24) }).parse(req.query);
  const songs = q ? await youtube.search(q, limit) : [];
  res.json({ songs });
  warmStreams(songs.slice(0, 1).map((s) => s.id));
}));

const thumbCache = new TTLCache<{ type: string; body: Buffer }>(24 * 3600 * 1000, 600);

router.get('/thumb/:id', handler(async (req, res) => {
  const { id } = ytParam.parse(req.params);
  const size = req.query.size === 'lg' ? 'lg' : 'sm';
  const img = await thumbCache.wrap(`${size}:${id}`, async () => {
    // hqdefault/sddefault are 4:3 with black bars: stick to 16:9 variants.
    const variants = size === 'lg' ? ['maxresdefault', 'hq720', 'mqdefault'] : ['mqdefault'];
    for (const v of variants) {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/${v}.jpg`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return { type: r.headers.get('content-type') || 'image/jpeg', body: Buffer.from(await r.arrayBuffer()) };
    }
    throw new AppError(404, 'Pochette introuvable');
  });
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=604800, immutable' }).send(img.body);
}));

/**
 * Proxies the audio so the browser never deals with expiring / IP-bound URLs.
 *
 * googlevideo answers 403 to open-ended or large ranges (`bytes=0-`, which is
 * what every browser sends first) and only serves ~1 MB slices. So we answer
 * the browser's range ourselves (size comes from the `clen` URL param) and
 * pull the bytes from upstream slice by slice, respecting back-pressure.
 */
const SLICE = 1024 * 1024;

export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start: number, end: number;
  if (!m[1]) { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: last N bytes
  else { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1; }
  return start > end || start >= size ? null : { start, end };
}

router.get('/stream/:id', handler(async (req, res) => {
  const { id } = ytParam.parse(req.params);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let url = await youtube.streamUrl(id);
  if (!url) throw new AppError(502, 'Impossible de lire ce titre', 'STREAM_FAILED');

  const fetchSlice = async (from: number, to: number) => {
    let r = await fetch(url!, { headers: { Range: `bytes=${from}-${to}` }, signal: controller.signal });
    if (r.status === 403 || r.status === 410) {
      // URL expired or got invalidated: resolve a fresh one once.
      await r.body?.cancel();
      url = await youtube.streamUrl(id, true);
      if (!url) throw new AppError(502, 'Impossible de lire ce titre', 'STREAM_FAILED');
      r = await fetch(url, { headers: { Range: `bytes=${from}-${to}` }, signal: controller.signal });
    }
    if (!r.ok || !r.body) throw new AppError(502, 'Impossible de lire ce titre', 'STREAM_FAILED');
    return r;
  };

  const params = new URL(url).searchParams;
  let size = Number(params.get('clen'));
  const mime = (params.get('mime') || 'audio/mp4').split(';')[0];
  if (!size) {
    // No clen: read the total size from a tiny probe request.
    const probe = await fetchSlice(0, 0);
    size = Number(probe.headers.get('content-range')?.split('/')[1]);
    await probe.body?.cancel();
    if (!size) throw new AppError(502, 'Impossible de lire ce titre', 'STREAM_FAILED');
  }

  const range = parseRange(req.headers.range, size);
  if (!range) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`);
    return void res.end();
  }

  // Fetch the first slice before committing headers, so errors still return JSON.
  let pos = range.start;
  let first: Response | null = await fetchSlice(pos, Math.min(pos + SLICE - 1, range.end));

  res.status(req.headers.range ? 206 : 200).set({
    'Content-Type': mime,
    'Content-Length': String(range.end - range.start + 1),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    ...(req.headers.range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } : {}),
  });

  try {
    while (pos <= range.end && !controller.signal.aborted) {
      const to = Math.min(pos + SLICE - 1, range.end);
      for (let attempt = 0; ; attempt++) {
        try {
          const slice = first ?? (await fetchSlice(pos, to));
          first = null;
          for await (const chunk of Readable.fromWeb(slice.body as any)) {
            pos += (chunk as Buffer).length;
            if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
          }
          break;
        } catch (err) {
          // A dropped upstream connection mid-slice: resume once from the last byte sent.
          first = null;
          if (controller.signal.aborted || attempt >= 1) throw err;
        }
      }
      pos = to + 1;
    }
    res.end();
  } catch (err) {
    if (!controller.signal.aborted) console.warn('[stream] interrupted', id, (err as Error).message);
    res.destroy();
  }
}));

/* ---------------- everything below requires a session ---------------- */

router.use(authenticate);

router.get('/home', handler(async (req, res) => {
  const userId = req.userId!;
  const [{ mixes, aiPending, aiReady, taste }, recent, lists] = await Promise.all([
    ai.homeMixes(userId),
    library.recentlyPlayed(userId, 12),
    playlists.list(userId),
  ]);
  res.json({ mixes, aiPending, aiReady, aiEnabled: aiEnabled(), aiPausedUntil: aiPausedUntil(), recent, playlists: lists.slice(0, 6), topArtists: taste.topArtists });
}));

router.post('/home/refresh', handler(async (req, res) => {
  consumeAiQuota(req.userId!);
  const taste = await library.tasteProfile(req.userId!);
  if (!taste.topArtists.length) throw new AppError(400, "Écoute quelques titres d'abord pour que l'IA apprenne tes goûts");
  const started = ai.refreshAiMixes(req.userId!, taste, true);
  if (!started && aiPausedUntil()) throw new AppError(503, "L'IA est en pause jusqu'à la remise à zéro du quota quotidien", 'AI_UNAVAILABLE');
  res.json({ started });
}));

router.get('/mixes/:id', handler(async (req, res) => {
  const id = z.string().max(200).parse(req.params.id);
  const detail = await ai.mixDetail(req.userId!, id);
  if (!detail) throw new AppError(404, 'Ce mix a expiré, rafraîchis l’accueil');
  res.json(detail);
  warmStreams(detail.songs.slice(0, 1).map((s) => s.id));
}));

/* ---------------- library ---------------- */

router.get('/library/likes', handler(async (req, res) => res.json({ songs: await library.likedSongs(req.userId!) })));
router.get('/library/like-ids', handler(async (req, res) => res.json({ ids: await library.likedIds(req.userId!) })));

router.put('/library/likes/:id', handler(async (req, res) => {
  const song = songSchema.parse(req.body);
  if (song.id !== req.params.id) throw new AppError(400, 'Identifiant incohérent');
  await library.setLike(req.userId!, song, true);
  res.json({ liked: true });
}));

router.delete('/library/likes/:id', handler(async (req, res) => {
  const { id } = ytParam.parse(req.params);
  await library.setLike(req.userId!, { id, title: '', artist: '', duration: 0 }, false);
  res.json({ liked: false });
}));

router.get('/library/history', handler(async (req, res) => res.json({ songs: await library.recentlyPlayed(req.userId!, 50) })));

router.post('/plays', handler(async (req, res) => {
  const body = z.object({
    song: songSchema,
    listenedSeconds: z.number().min(0).max(24 * 3600),
    completed: z.boolean(),
    skipped: z.boolean(),
  }).parse(req.body);
  await library.recordPlay(req.userId!, body);
  res.status(201).json({ ok: true });
}));

/* ---------------- playlists ---------------- */

router.get('/playlists', handler(async (req, res) => res.json({ playlists: await playlists.list(req.userId!) })));

router.post('/playlists', handler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(1, 'nom requis').max(120),
    description: z.string().max(500).optional(),
    aiPrompt: z.string().max(500).optional(),
    songs: z.array(songSchema).max(200).optional(),
  }).parse(req.body);
  res.status(201).json(await playlists.create(req.userId!, body));
}));

router.get('/playlists/:id', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const playlist = await playlists.get(req.userId!, id);
  res.json(playlist);
  warmStreams(playlist.songs.slice(0, 1).map((s) => s.id));
}));

router.patch('/playlists/:id', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().max(500).optional() }).parse(req.body);
  await playlists.update(req.userId!, id, body);
  res.json({ ok: true });
}));

router.delete('/playlists/:id', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await playlists.remove(req.userId!, id);
  res.json({ ok: true });
}));

router.post('/playlists/:id/songs', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { songs } = z.object({ songs: z.array(songSchema).min(1).max(200) }).parse(req.body);
  res.json({ added: await playlists.addSongs(req.userId!, id, songs) });
}));

router.delete('/playlists/:id/songs/:songId', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const songId = z.string().regex(YT_ID).parse(req.params.songId);
  await playlists.removeSong(req.userId!, id, songId);
  res.json({ ok: true });
}));

router.put('/playlists/:id/order', handler(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { songIds } = z.object({ songIds: z.array(z.string().regex(YT_ID)).max(1000) }).parse(req.body);
  await playlists.reorder(req.userId!, id, songIds);
  res.json({ ok: true });
}));

/* ---------------- AI ---------------- */

router.post('/radio', handler(async (req, res) => {
  const body = z.object({
    seeds: z.array(songSchema).min(1).max(5),
    exclude: z.array(z.string().regex(YT_ID)).max(500).default([]),
    count: z.number().int().min(1).max(25).default(10),
    smart: z.boolean().default(false),
  }).parse(req.body);
  let smart = body.smart && aiEnabled();
  if (smart) {
    try { consumeAiQuota(req.userId!); } catch { smart = false; } // quota hit → silent fallback to YouTube mix
  }
  res.json(await ai.radio(req.userId!, body.seeds, body.exclude, { count: body.count, smart }));
}));

router.post('/ai/playlist', handler(async (req, res) => {
  const { prompt, count } = z.object({
    prompt: z.string().trim().min(3, 'décris un peu plus ce que tu veux').max(300),
    count: z.number().int().min(5).max(40).default(20),
  }).parse(req.body);
  consumeAiQuota(req.userId!);
  res.json(await ai.playlistFromPrompt(req.userId!, prompt, count));
}));

router.post('/ai/search', handler(async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(3).max(300) }).parse(req.body);
  consumeAiQuota(req.userId!);
  res.json(await ai.smartSearch(q));
}));
