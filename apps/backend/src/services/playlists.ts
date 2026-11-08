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
        for (const [i, s] of songs.entries()) {
          await db.query(`INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ($1, $2, $3)`, [id, s.id, i]);
        }
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
    return tx(async (db) => {
      await upsertSongs(songs, db);
      const { rows } = await db.query(`SELECT COALESCE(MAX(position), -1) AS max FROM playlist_songs WHERE playlist_id = $1`, [id]);
      let pos: number = rows[0].max + 1;
      let added = 0;
      for (const s of songs) {
        const r = await db.query(
          `INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [id, s.id, pos],
        );
        if (r.rowCount) { pos++; added++; }
      }
      await db.query(`UPDATE playlists SET updated_at = NOW() WHERE id = $1`, [id]);
      return added;
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
      if (songIds.length !== current.size || songIds.some((s) => !current.has(s))) {
        throw new AppError(409, 'La playlist a changé, recharge-la avant de réordonner');
      }
      for (const [i, songId] of songIds.entries()) {
        await db.query(`UPDATE playlist_songs SET position = $3 WHERE playlist_id = $1 AND song_id = $2`, [id, songId, i]);
      }
      await db.query(`UPDATE playlists SET updated_at = NOW() WHERE id = $1`, [id]);
    });
  },
};
