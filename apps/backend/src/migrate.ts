/**
 * Schema v2 — YouTube-first catalogue.
 *
 * The v1 schema modelled a local catalogue (artists/albums/tracks with UUIDs)
 * that the app never actually used: every track played comes from YouTube and
 * carries a `yt__<id>` identifier, which broke likes, playlists and history.
 * v1 tables are renamed `legacy_*` (not dropped) so no data is lost.
 */
import { pool } from './db';

const LEGACY = ['tracks', 'albums', 'artists', 'likes', 'follows', 'listening_history', 'playlist_tracks', 'playlists'];

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const { rows } = await client.query(`SELECT value FROM schema_meta WHERE key = 'version'`);
    const version = rows[0] ? parseInt(rows[0].value, 10) : 1;

    if (version < 2) {
      for (const table of LEGACY) {
        const exists = await client.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
        const legacyExists = await client.query(`SELECT to_regclass($1) AS t`, [`public.legacy_${table}`]);
        if (exists.rows[0].t && !legacyExists.rows[0].t) {
          await client.query(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
        }
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON refresh_tokens(token);

        -- One row per YouTube video we have ever seen a user interact with.
        CREATE TABLE songs (
          id VARCHAR(11) PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          artist VARCHAR(120) NOT NULL,
          duration INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE liked_songs (
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          song_id VARCHAR(11) REFERENCES songs(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (user_id, song_id)
        );

        CREATE TABLE playlists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          name VARCHAR(120) NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          ai_prompt TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX playlists_user_idx ON playlists(user_id, updated_at DESC);

        CREATE TABLE playlist_songs (
          playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
          song_id VARCHAR(11) REFERENCES songs(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          added_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (playlist_id, song_id)
        );

        -- Every listen, with how it ended: the raw signal for taste & radio.
        CREATE TABLE plays (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          song_id VARCHAR(11) REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
          listened_seconds INTEGER NOT NULL DEFAULT 0,
          completed BOOLEAN NOT NULL DEFAULT false,
          skipped BOOLEAN NOT NULL DEFAULT false,
          played_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX plays_user_time_idx ON plays(user_id, played_at DESC);

        -- Durable cache for slow AI results (home mixes, generated lists).
        CREATE TABLE ai_cache (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );
      `);

      await client.query(
        `INSERT INTO schema_meta (key, value) VALUES ('version', '2')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      );
      console.log('[migrate] schema upgraded to v2 (v1 tables kept as legacy_*)');
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => { console.log('[migrate] up to date'); return pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}
