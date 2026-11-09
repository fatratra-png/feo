import { one, query, tx } from '../db';
import { AppError } from '../lib/http';
import { Song } from '../lib/types';
import { upsertSongs } from './library';

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

const SUMMARY = `
  p.id, p.name, p.description, p.ai_prompt AS "aiPrompt", p.updated_at AS "updatedAt",
  COUNT(ps.song_id)::int AS "songCount",
  COALESCE(SUM(s.duration), 0)::int AS duration,
  COALESCE((ARRAY_AGG(ps.song_id ORDER BY ps.position) FILTER (WHERE ps.song_id IS NOT NULL))[1:4], '{}') AS "coverIds"`;

async function assertOwner(userId: string, playlistId: string) {
  const row = await one<{ user_id: string }>(`SELECT user_id FROM playlists WHERE id = $1`, [playlistId]);
  if (!row) throw new AppError(404, 'Playlist introuvable');
  if (row.user_id !== userId) throw new AppError(403, "Cette playlist ne t'appartient pas");
}

const touch = (id: string) => query(`UPDATE playlists SET updated_at = NOW() WHERE id = $1`, [id]);

export const playlists = {
  async list(userId: string): Promise<PlaylistSummary[]> {
    return query(
      `SELECT ${SUMMARY} FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       LEFT JOIN songs s ON s.id = ps.song_id
       WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.updated_at DESC`,
      [userId],
    );
  },

  async get(userId: string, id: string) {
    await assertOwner(userId, id);
    const summary = await one<PlaylistSummary>(
      `SELECT ${SUMMARY} FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       LEFT JOIN songs s ON s.id = ps.song_id
       WHERE p.id = $1 GROUP BY p.id`,
      [id],
    );
    const songs = await query<Song & { addedAt: string }>(
      `SELECT s.id, s.title, s.artist, s.duration, ps.added_at AS "addedAt"
       FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = $1 ORDER BY ps.position`,
      [id],
    );
    return { ...summary!, songs };
  },

  async create(userId: string, input: { name: string; description?: string; aiPrompt?: string; songs?: Song[] }) {
    return tx(async (db) => {
      const { rows } = await db.query(
        `INSERT INTO playlists (user_id, name, description, ai_prompt) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, input.name.trim(), input.description?.trim() ?? '', input.aiPrompt ?? null],
      );
      const id: string = rows[0].id;
      const songs = [...new Map((input.songs ?? []).map((s) => [s.id, s])).values()];
      if (songs.length) {
        await upsertSongs(songs, db);
        // One statement for the whole list instead of one round trip per song.
        await db.query(
          `INSERT INTO playlist_songs (playlist_id, song_id, position)
           SELECT $1, t.id, t.ord - 1 FROM unnest($2::varchar[]) WITH ORDINALITY AS t(id, ord)`,
          [id, songs.map((s) => s.id)],
        );
      }
      return { id };
    });
  },

  async update(userId: string, id: string, input: { name?: string; description?: string }) {
    await assertOwner(userId, id);
    await query(
      `UPDATE playlists SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = NOW() WHERE id = $1`,
      [id, input.name?.trim() ?? null, input.description?.trim() ?? null],
    );
  },

  async remove(userId: string, id: string) {
    await assertOwner(userId, id);
    await query(`DELETE FROM playlists WHERE id = $1`, [id]);
  },

  /** Appends songs, silently skipping ones already present. Returns how many were added. */
  async addSongs(userId: string, id: string, songs: Song[]): Promise<number> {
    await assertOwner(userId, id);
    const unique = [...new Map(songs.map((s) => [s.id, s])).values()];
    return tx(async (db) => {
      await upsertSongs(unique, db);
      // Songs already in the playlist are skipped; the new ones get contiguous positions after the last.
      const r = await db.query(
        `INSERT INTO playlist_songs (playlist_id, song_id, position)
         SELECT $1, t.id, (SELECT COALESCE(MAX(position), -1) FROM playlist_songs WHERE playlist_id = $1) + ROW_NUMBER() OVER (ORDER BY t.ord)
         FROM unnest($2::varchar[]) WITH ORDINALITY AS t(id, ord)
         WHERE NOT EXISTS (SELECT 1 FROM playlist_songs ps WHERE ps.playlist_id = $1 AND ps.song_id = t.id)
         ON CONFLICT DO NOTHING`,
        [id, unique.map((s) => s.id)],
      );
      await db.query(`UPDATE playlists SET updated_at = NOW() WHERE id = $1`, [id]);
      return r.rowCount ?? 0;
    });
  },

  async removeSong(userId: string, id: string, songId: string) {
    await assertOwner(userId, id);
    await query(`DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2`, [id, songId]);
    await touch(id);
  },

  /** Rewrites positions from the full ordered id list sent by the client. */
  async reorder(userId: string, id: string, songIds: string[]) {
    await assertOwner(userId, id);
    await tx(async (db) => {
      const { rows } = await db.query(`SELECT song_id FROM playlist_songs WHERE playlist_id = $1`, [id]);
      const current = new Set(rows.map((r) => r.song_id));
      if (songIds.length !== current.size || new Set(songIds).size !== songIds.length || songIds.some((s) => !current.has(s))) {
        throw new AppError(409, 'La playlist a changé, recharge-la avant de réordonner');
      }
      await db.query(
        `UPDATE playlist_songs ps SET position = t.ord - 1
         FROM unnest($2::varchar[]) WITH ORDINALITY AS t(id, ord)
         WHERE ps.playlist_id = $1 AND ps.song_id = t.id`,
        [id, songIds],
      );
      await db.query(`UPDATE playlists SET updated_at = NOW() WHERE id = $1`, [id]);
    });
  },
};
