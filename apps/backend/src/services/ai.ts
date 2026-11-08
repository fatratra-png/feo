import { one, query } from '../db';
import { TTLCache, limiter } from '../lib/cache';
import { CuratedSong, Song } from '../lib/types';
import { aiPausedUntil, chatJson } from './llm';
import { Taste, mainArtist, tasteProfile } from './library';
import { isSongLike, youtube } from './youtube';

const SYSTEM = `Tu es le curateur musical de FEO, une app d'écoute utilisée surtout à Madagascar et dans le monde francophone.
Règles absolues :
- Ne propose QUE des chansons qui existent réellement, avec le titre et l'artiste exacts tels qu'on les trouve sur YouTube.
- Varie les artistes (jamais plus de 2 titres du même artiste dans une liste), sauf demande explicite.
- Respecte la langue, la culture, l'époque et l'énergie demandées. Les artistes malgaches sont les bienvenus quand c'est pertinent.
- Réponds uniquement en JSON valide, sans texte autour.`;

interface Suggestion {
  title: string;
  artist: string;
  reason?: string;
}

const resolveLimit = limiter(6);

/** Turns AI "title/artist" suggestions into real, playable YouTube songs. */
async function resolveSuggestions(items: Suggestion[], exclude: Set<string>, avoid: string[] = []): Promise<CuratedSong[]> {
  const avoidSet = new Set(avoid.map((a) => a.toLowerCase()));
  const valid = items.filter((s) => s && typeof s.title === 'string' && typeof s.artist === 'string').slice(0, 30);
  const resolved = await Promise.all(
    valid.map((s) =>
      resolveLimit(() => youtube.resolve(s.title, s.artist)).then((song) =>
        song ? { ...song, title: s.title.trim().slice(0, 120), artist: s.artist.trim().slice(0, 80), reason: s.reason } : null,
      ),
    ),
  );
  const out: CuratedSong[] = [];
  const seen = new Set(exclude);
  for (const song of resolved) {
    if (!song || seen.has(song.id) || !isSongLike(song)) continue;
    if (avoidSet.has(mainArtist(song.artist).toLowerCase())) continue;
    seen.add(song.id);
    out.push(song);
  }
  return out;
}

/** Caps the number of songs per artist so lists don't become one-artist loops. */
export function diversify<T extends Song>(songs: T[], perArtist = 2): T[] {
  const counts = new Map<string, number>();
  return songs.filter((s) => {
    const key = mainArtist(s.artist).toLowerCase();
    const n = counts.get(key) ?? 0;
    if (n >= perArtist) return false;
    counts.set(key, n + 1);
    return true;
  });
}

const describe = (s: Song) => `"${s.title}" — ${s.artist}`;

/* ------------------------------------------------------------------ */
/* Radio: keeps the music going when the queue runs out                */
/* ------------------------------------------------------------------ */

export interface RadioResult {
  songs: CuratedSong[];
  source: 'ai' | 'mix';
  model?: string;
}

async function radioFromMix(seeds: Song[], exclude: Set<string>, taste: Taste, count: number): Promise<RadioResult> {
  const mixes = await Promise.all(seeds.slice(0, 2).map((s) => youtube.mix(s.id, 25)));
  // Interleave both mixes so the radio follows the overall session, not just the last song.
  const merged: Song[] = [];
  for (let i = 0; i < 30; i++) for (const m of mixes) if (m[i]) merged.push(m[i]);
  const avoid = new Set(taste.avoidArtists.map((a) => a.toLowerCase()));
  const filtered = merged.filter((s) => !exclude.has(s.id) && !avoid.has(mainArtist(s.artist).toLowerCase()));
  return { songs: diversify(filtered, 2).slice(0, count), source: 'mix' };
}

/** AI radio picks per seed song: the free tier allows ~50 AI calls a day, don't repeat them. */
const radioCache = new TTLCache<{ songs: CuratedSong[]; model: string }>(45 * 60 * 1000, 300);

export async function radio(
  userId: string,
  seeds: Song[],
  excludeIds: string[],
  opts: { count?: number; smart?: boolean } = {},
): Promise<RadioResult> {
  const count = Math.min(opts.count ?? 10, 25);
  const taste = await tasteProfile(userId);
  const exclude = new Set([...excludeIds, ...seeds.map((s) => s.id), ...taste.recentIds.slice(0, 30)]);

  if (opts.smart && seeds.length) {
    const cacheKey = `${userId}:${seeds.slice(0, 2).map((s) => s.id).join(',')}`;
    const cached = radioCache.get(cacheKey);
    if (cached) {
      const fresh = cached.songs.filter((s) => !exclude.has(s.id));
      if (fresh.length >= 3) return { songs: fresh.slice(0, count), source: 'ai', model: cached.model };
    }
    try {
      const { data, model } = await chatJson<{ songs: Suggestion[] }>(
        [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `L'utilisateur écoute en ce moment (du plus récent au plus ancien) :
${seeds.slice(0, 5).map(describe).join('\n')}

Ses artistes préférés : ${taste.topArtists.map((a) => a.name).join(', ') || 'inconnus'}
Artistes qu'il zappe souvent (à éviter) : ${taste.avoidArtists.join(', ') || 'aucun'}

Propose ${count + 6} chansons à enchaîner pour prolonger cette session de façon fluide : même énergie et même univers, avec environ 30 % de découvertes moins connues. N'inclus aucune des chansons ci-dessus.
Format : {"songs":[{"title":"...","artist":"...","reason":"raison courte en français (max 8 mots)"}]}`,
          },
        ],
        { budgetMs: 40_000, temperature: 0.8, priority: 'fast' },
      );
      const songs = diversify(await resolveSuggestions(data.songs ?? [], exclude, taste.avoidArtists));
      if (songs.length >= 3) {
        radioCache.set(cacheKey, { songs, model });
        return { songs: songs.slice(0, count), source: 'ai', model };
      }
    } catch (err) {
      console.warn('[ai] radio fell back to YouTube mix:', (err as Error).message);
    }
  }
  return radioFromMix(seeds, exclude, taste, count);
}

/* ------------------------------------------------------------------ */
/* Playlist from a natural-language prompt                             */
/* ------------------------------------------------------------------ */

export interface GeneratedPlaylist {
  name: string;
  description: string;
  songs: CuratedSong[];
  model: string;
}

/** Used when every model is rate-limited: plain YouTube search + mix, clearly flagged. */
async function playlistWithoutAi(prompt: string, count: number): Promise<GeneratedPlaylist> {
  const found = diversify(await youtube.search(prompt, 20), 2);
  const seen = new Set(found.map((s) => s.id));
  const mixes = found.length ? await Promise.all(found.slice(0, 2).map((s) => youtube.mix(s.id, 15))) : [];
  const extra = mixes.flat().filter((s) => !seen.has(s.id) && (seen.add(s.id), true));
  return {
    name: prompt.slice(0, 60),
    description: 'Sélection basée sur une recherche YouTube (IA momentanément indisponible).',
    songs: diversify([...found, ...extra], 2).slice(0, count),
    model: 'fallback',
  };
}

export async function playlistFromPrompt(userId: string, prompt: string, count = 20): Promise<GeneratedPlaylist> {
  try {
    return await playlistWithAi(userId, prompt, count);
  } catch (err) {
    if ((err as { code?: string }).code !== 'AI_UNAVAILABLE') throw err;
    return playlistWithoutAi(prompt, count);
  }
}

async function playlistWithAi(userId: string, prompt: string, count: number): Promise<GeneratedPlaylist> {
  const taste = await tasteProfile(userId);
  const { data, model } = await chatJson<{ name: string; description: string; songs: Suggestion[] }>(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Crée une playlist pour cette demande : « ${prompt} »

Contexte (à n'utiliser que si cela colle à la demande) — artistes que l'utilisateur aime : ${taste.topArtists.map((a) => a.name).join(', ') || 'inconnus'}.

Donne ${count + 6} chansons dans un ordre d'écoute agréable (montée en énergie progressive si c'est pertinent).
Format : {"name":"titre accrocheur, max 40 caractères","description":"une phrase en français","songs":[{"title":"...","artist":"...","reason":"max 8 mots"}]}`,
      },
    ],
    { budgetMs: 75_000, temperature: 0.85, maxTokens: 4000, priority: 'fast' },
  );
  let songs = diversify(await resolveSuggestions(data.songs ?? [], new Set()), 3).slice(0, count);
  if (songs.length >= 3 && songs.length < count) {
    // The AI sometimes names songs that don't exist (common for niche genres):
    // top up with YouTube's mix of the verified ones, which keeps the same vibe.
    const seen = new Set(songs.map((s) => s.id));
    const mixes = await Promise.all(songs.slice(0, 3).map((s) => youtube.mix(s.id, 15)));
    const extra = diversify(mixes.flat().filter((s) => !seen.has(s.id) && (seen.add(s.id), true)), 2)
      .map((s) => ({ ...s, reason: 'Dans la même ambiance' }));
    songs = diversify([...songs, ...extra], 3).slice(0, count);
  }
  return {
    name: (data.name || prompt).slice(0, 60),
    description: (data.description || '').slice(0, 240),
    songs,
    model,
  };
}

/* ------------------------------------------------------------------ */
/* Smart search: "la chanson qui fait na na na de 2010"                */
/* ------------------------------------------------------------------ */

export async function smartSearch(q: string): Promise<{ interpretation: string; songs: CuratedSong[]; model: string }> {
  const { data, model } = await chatJson<{ interpretation: string; songs: Suggestion[]; queries: string[] }>(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Un utilisateur cherche de la musique avec cette description : « ${q} »
Identifie ce qu'il cherche (chanson précise floue, ambiance, époque, paroles approximatives…).
Format : {"interpretation":"ce que tu as compris, une phrase en français","songs":[{"title":"...","artist":"...","reason":"max 8 mots"}],"queries":["1 à 2 requêtes YouTube courtes pour compléter"]}
Donne jusqu'à 10 chansons, la plus probable en premier.`,
      },
    ],
    { budgetMs: 40_000, temperature: 0.4, priority: 'fast' },
  );

  const [resolved, ...extra] = await Promise.all([
    resolveSuggestions(data.songs ?? [], new Set()),
    ...(data.queries ?? []).slice(0, 2).map((query) => youtube.search(query, 6).catch(() => [] as Song[])),
  ]);
  const seen = new Set(resolved.map((s) => s.id));
  const more = extra.flat().filter((s) => !seen.has(s.id) && (seen.add(s.id), true));
  return { interpretation: data.interpretation || '', songs: [...resolved, ...more].slice(0, 24), model };
}

/* ------------------------------------------------------------------ */
/* Home "Pour toi" mixes                                               */
/* ------------------------------------------------------------------ */

export interface Mix {
  id: string;
  title: string;
  subtitle: string;
  kind: 'ai' | 'radio' | 'query';
  coverIds: string[];
  songs?: CuratedSong[];
}

const HOME_TTL_HOURS = 8;
const generating = new Set<string>();
/** After a failed generation, wait before retrying (home is polled while pending). */
const lastFailure = new Map<string, number>();
const RETRY_AFTER_MS = 10 * 60 * 1000;

const STARTERS: { title: string; subtitle: string; query: string }[] = [
  { title: 'Gasy Vibes', subtitle: 'Le meilleur de la musique malgache', query: 'musique malagasy hits' },
  { title: 'Hits du moment', subtitle: 'Ce que tout le monde écoute', query: 'new hit song official music video 2026' },
  { title: 'Afro Heat', subtitle: 'Afrobeats & amapiano', query: 'afrobeats amapiano hits' },
  { title: 'Chill & Focus', subtitle: 'Pour travailler ou se poser', query: 'chill acoustic song' },
  { title: 'Soirée Dance', subtitle: "De l'énergie pour la fête", query: 'dance pop hit official video' },
  { title: 'Douceur R&B', subtitle: 'Soul et R&B tout en finesse', query: 'rnb soul hits' },
];

const queryMixId = (q: string) => `q-${Buffer.from(q).toString('base64url')}`;

/** Instant, non-AI mixes: radios from favourite artists, or genre starters. */
async function fallbackMixes(taste: Taste): Promise<Mix[]> {
  const mixes: Mix[] = [];
  const seen = new Set<string>();
  for (const song of taste.topSongs) {
    const artist = mainArtist(song.artist);
    if (seen.has(artist.toLowerCase())) continue;
    seen.add(artist.toLowerCase());
    mixes.push({ id: `radio-${song.id}`, title: `Radio ${artist}`, subtitle: `Inspirée par « ${song.title} »`, kind: 'radio', coverIds: [song.id] });
    if (mixes.length >= 3) break;
  }
  const starters = await Promise.all(
    STARTERS.slice(0, 6 - mixes.length).map(async (s) => {
      const songs = await youtube.search(s.query, 20).catch(() => [] as Song[]);
      return { id: queryMixId(s.query), title: s.title, subtitle: s.subtitle, kind: 'query' as const, coverIds: songs.map((x) => x.id).slice(0, 4) };
    }),
  );
  // A starter whose search found no actual songs would open empty: hide it.
  return [...mixes, ...starters.filter((m) => m.coverIds.length > 0)];
}

async function generateAiMixes(userId: string, taste: Taste): Promise<Mix[]> {
  const { data } = await chatJson<{ mixes: { title: string; subtitle: string; songs: Suggestion[] }[] }>(
    [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Profil d'écoute de l'utilisateur :
- Artistes préférés (score) : ${taste.topArtists.map((a) => `${a.name} (${a.score})`).join(', ')}
- Titres favoris : ${taste.topSongs.slice(0, 8).map(describe).join(' ; ')}
- À éviter : ${taste.avoidArtists.join(', ') || 'rien'}

Crée 4 mix personnalisés et distincts :
1. « Dans ta lignée » : ses goûts actuels, sans répéter ses titres favoris.
2. Une découverte : artistes qu'il ne connaît probablement pas mais qu'il aimerait.
3. Un mix d'ambiance adapté à ses goûts (ex. calme, soirée, motivation).
4. Un voyage dans le temps ou dans un autre pays, relié à ses goûts.
Chaque mix : titre court et créatif en français (max 28 caractères), sous-titre d'une phrase, 10 chansons.
Format : {"mixes":[{"title":"...","subtitle":"...","songs":[{"title":"...","artist":"...","reason":"max 8 mots"}]}]}`,
      },
    ],
    { budgetMs: 120_000, temperature: 0.9, maxTokens: 6000 },
  );

  const exclude = new Set(taste.topSongs.map((s) => s.id));
  const mixes: Mix[] = [];
  for (const [i, m] of (data.mixes ?? []).slice(0, 4).entries()) {
    const songs = diversify(await resolveSuggestions(m.songs ?? [], exclude, taste.avoidArtists));
    if (songs.length < 4) continue;
    mixes.push({ id: `ai-${i}`, title: (m.title || 'Mix').slice(0, 40), subtitle: (m.subtitle || '').slice(0, 140), kind: 'ai', coverIds: songs.slice(0, 4).map((s) => s.id), songs });
  }
  return mixes;
}

async function readCache<T>(key: string): Promise<T | null> {
  const row = await one<{ value: T }>(`SELECT value FROM ai_cache WHERE key = $1 AND expires_at > NOW()`, [key]);
  return row?.value ?? null;
}

async function writeCache(key: string, value: unknown, hours: number) {
  await query(
    `INSERT INTO ai_cache (key, value, expires_at) VALUES ($1, $2, NOW() + make_interval(hours => $3))
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(value), hours],
  );
}

/** Starts AI mix generation in the background; the home endpoint never waits for it. */
export function refreshAiMixes(userId: string, taste: Taste, force = false) {
  if (generating.has(userId) || taste.topArtists.length === 0 || aiPausedUntil()) return false;
  if (!force && Date.now() - (lastFailure.get(userId) ?? 0) < RETRY_AFTER_MS) return false;
  generating.add(userId);
  generateAiMixes(userId, taste)
    .then((mixes) => {
      if (!mixes.length) throw new Error('no playable mix');
      lastFailure.delete(userId);
      return writeCache(`home:${userId}`, { mixes, at: new Date().toISOString() }, HOME_TTL_HOURS);
    })
    .catch((err) => {
      lastFailure.set(userId, Date.now());
      console.warn('[ai] home mixes failed:', err.message);
    })
    .finally(() => generating.delete(userId));
  return true;
}

export async function homeMixes(userId: string): Promise<{ mixes: Mix[]; aiPending: boolean; aiReady: boolean; taste: Taste }> {
  const taste = await tasteProfile(userId);
  const cached = await readCache<{ mixes: Mix[] }>(`home:${userId}`);
  const fallback = await fallbackMixes(taste);
  if (cached?.mixes?.length) {
    const ai = cached.mixes.map(({ songs, ...m }) => m);
    return { mixes: [...ai, ...fallback].slice(0, 8), aiPending: false, aiReady: true, taste };
  }
  // Need at least a few signals before the AI can personalise anything.
  const pending = taste.totalPlays >= 3 ? refreshAiMixes(userId, taste) || generating.has(userId) : false;
  return { mixes: fallback, aiPending: pending, aiReady: false, taste };
}

export async function mixDetail(userId: string, mixId: string): Promise<{ songs: CuratedSong[] } | null> {
  if (mixId.startsWith('ai-')) {
    const cached = await readCache<{ mixes: Mix[] }>(`home:${userId}`);
    const mix = cached?.mixes.find((m) => m.id === mixId);
    return mix?.songs ? { songs: mix.songs } : null;
  }
  if (mixId.startsWith('radio-')) {
    const songs = await youtube.mix(mixId.slice(6), 30);
    return { songs: diversify(songs, 3) };
  }
  if (mixId.startsWith('q-')) {
    const q = Buffer.from(mixId.slice(2), 'base64url').toString('utf8').slice(0, 150);
    return { songs: diversify(await youtube.search(q, 30), 3) };
  }
  return null;
}
