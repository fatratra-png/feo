import { PoolClient } from 'pg';
import { pool, query } from '../db';
import { Song } from '../lib/types';

type Db = Pick<PoolClient, 'query'>;

const SONG_COLS = `s.id, s.title, s.artist, s.duration`;

/** Stores (or refreshes) song metadata so likes/playlists/plays can reference it. */
export async function upsertSongs(songs: Song[], db: Db = pool) {
  const unique = [...new Map(songs.map((s) => [s.id, s])).values()];
  if (!unique.length) return;
  const values: unknown[] = [];
  const rows = unique.map((s, i) => {
    values.push(s.id, s.title.slice(0, 200), s.artist.slice(0, 120), Math.max(0, Math.round(s.duration || 0)));
    return `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`;
  });
  await db.query(
    `INSERT INTO songs (id, title, artist, duration) VALUES ${rows.join(',')}
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist,
       duration = GREATEST(songs.duration, EXCLUDED.duration)`,
    values,
  );
}

/* ---------------- likes ---------------- */

export async function likedSongs(userId: string): Promise<(Song & { likedAt: string })[]> {
  return query(
    `SELECT ${SONG_COLS}, l.created_at AS "likedAt"
     FROM liked_songs l JOIN songs s ON s.id = l.song_id
     WHERE l.user_id = $1 ORDER BY l.created_at DESC`,
    [userId],
  );
}

export async function likedIds(userId: string): Promise<string[]> {
  const rows = await query<{ song_id: string }>(`SELECT song_id FROM liked_songs WHERE user_id = $1`, [userId]);
  return rows.map((r) => r.song_id);
}

export async function setLike(userId: string, song: Song, liked: boolean) {
  if (liked) {
    await upsertSongs([song]);
    await query(`INSERT INTO liked_songs (user_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, song.id]);
  } else {
    await query(`DELETE FROM liked_songs WHERE user_id = $1 AND song_id = $2`, [userId, song.id]);
  }
}

/* ---------------- plays ---------------- */

export interface PlayEvent {
  song: Song;
  listenedSeconds: number;
  completed: boolean;
  skipped: boolean;
}

export async function recordPlay(userId: string, e: PlayEvent) {
  // A "play" under 5 seconds is noise (rapid zapping), not a signal.
  if (e.listenedSeconds < 5 && !e.skipped) return;
  await upsertSongs([e.song]);
  await query(
    `INSERT INTO plays (user_id, song_id, listened_seconds, completed, skipped) VALUES ($1, $2, $3, $4, $5)`,
    [userId, e.song.id, Math.round(e.listenedSeconds), e.completed, e.skipped],
  );
}

export async function recentlyPlayed(userId: string, limit = 20): Promise<(Song & { playedAt: string })[]> {
  return query(
    `SELECT ${SONG_COLS}, r.played_at AS "playedAt" FROM (
       SELECT DISTINCT ON (song_id) song_id, played_at FROM plays
       WHERE user_id = $1 AND skipped = false ORDER BY song_id, played_at DESC
     ) r JOIN songs s ON s.id = r.song_id
     ORDER BY r.played_at DESC LIMIT $2`,
    [userId, limit],
  );
}

/* ---------------- taste profile ---------------- */

export interface Taste {
  topArtists: { name: string; score: number }[];
  topSongs: Song[];
  avoidArtists: string[];
  recentIds: string[];
  totalPlays: number;
}

export const mainArtist = (artist: string) => artist.split(/,|&| feat\.? | ft\.? | x /i)[0].trim();

/**
 * Scores what the user actually enjoys. A completed listen counts more than a
 * start, a skip counts against, a like counts most. Recent activity weighs more.
 */
export async function tasteProfile(userId: string): Promise<Taste> {
  const [songRows, recent] = await Promise.all([query<Song & { score: number; skips: number; plays: number }>(
    `WITH signals AS (
       SELECT song_id,
              CASE WHEN completed THEN 2.0 WHEN skipped THEN -1.5 ELSE 1.0 END
                * (CASE WHEN played_at > NOW() - INTERVAL '14 days' THEN 1.5 ELSE 1.0 END) AS w,
              skipped::int AS skip
       FROM plays WHERE user_id = $1 AND played_at > NOW() - INTERVAL '120 days'
       UNION ALL
       SELECT song_id, 3.0, 0 FROM liked_songs WHERE user_id = $1
     )
     SELECT ${SONG_COLS}, SUM(w)::float AS score, SUM(skip)::int AS skips, COUNT(*)::int AS plays
     FROM signals g JOIN songs s ON s.id = g.song_id
     GROUP BY s.id ORDER BY score DESC`,
    [userId],
  ), query<{ song_id: string }>(
    `SELECT song_id FROM plays WHERE user_id = $1 ORDER BY played_at DESC LIMIT 60`,
    [userId],
  )]);

  const artists = new Map<string, { name: string; score: number; skips: number; plays: number }>();
  for (const row of songRows) {
    const name = mainArtist(row.artist);
    const key = name.toLowerCase();
    const a = artists.get(key) ?? { name, score: 0, skips: 0, plays: 0 };
    a.score += row.score;
    a.skips += row.skips;
    a.plays += row.plays;
    artists.set(key, a);
  }

  const ranked = [...artists.values()].sort((a, b) => b.score - a.score);

  return {
    topArtists: ranked.filter((a) => a.score > 0).slice(0, 8).map(({ name, score }) => ({ name, score: Math.round(score * 10) / 10 })),
    topSongs: songRows.filter((s) => s.score > 0).slice(0, 12).map(({ id, title, artist, duration }) => ({ id, title, artist, duration })),
    avoidArtists: ranked.filter((a) => a.skips >= 2 && a.skips / a.plays >= 0.6).map((a) => a.name).slice(0, 10),
    recentIds: recent.map((r) => r.song_id),
    totalPlays: songRows.reduce((n, r) => n + r.plays, 0),
  };
}
