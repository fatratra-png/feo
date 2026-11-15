/**
 * HTTP-level tests of the API against a real PostgreSQL database.
 * Skipped unless TEST_DATABASE_URL is set (see tests/setup.ts).
 */
import { expect } from 'chai';
import type { Express } from 'express';
import request from 'supertest';

const DB = process.env.TEST_DATABASE_URL;
const suite = DB ? describe : describe.skip;

const song = (id: string, title = `Song ${id}`, artist = 'Artist', duration = 200) => ({ id, title, artist, duration });
const A = song('aaaaaaaaaaa', 'Vololona', 'Mahaleo', 190);
const B = song('bbbbbbbbbbb', 'Bad Guy', 'Billie Eilish', 194);
const C = song('ccccccccccc', 'Waka Waka', 'Shakira', 211);

suite('API (integration, PostgreSQL)', function () {
  this.timeout(30000);
  let app: Express;
  let pool: import('pg').Pool;
  const stamp = Date.now();
  const email = `it-${stamp}@example.com`;
  let access = '';
  let refresh = '';
  const bearer = () => ({ Authorization: `Bearer ${access}` });

  before(async () => {
    const { migrate } = await import('../src/migrate');
    await migrate();
    ({ pool } = await import('../src/db'));
    await pool.query(`TRUNCATE users, songs, playlists, playlist_songs, liked_songs, plays, refresh_tokens, ai_cache CASCADE`);
    app = (await import('../src/app')).createApp();
  });

  after(async () => {
    await pool?.query(`DELETE FROM users WHERE email LIKE 'it-%@example.com'`);
  });

  describe('public routes', () => {
    it('GET /health reports status and degraded services', async () => {
      const r = await request(app).get('/api/health').expect(200);
      expect(r.body).to.include({ status: 'ok', ai: false });
      expect(r.body).to.have.property('youtubeBlockedUntil');
    });

    it('protected routes require a session', async () => {
      await request(app).get('/api/library/likes').expect(401);
      await request(app).get('/api/search?q=x').expect(401);
      await request(app).get('/api/playlists').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });
  });

  describe('auth', () => {
    it('rejects invalid registration input with a readable message', async () => {
      const r = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'short', displayName: 'X' }).expect(400);
      expect(r.body.message).to.match(/^email/);
    });

    it('registers, normalising the email', async () => {
      const r = await request(app)
        .post('/api/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password: 'correct-horse', displayName: ' Rakoto ' })
        .expect(201);
      expect(r.body.user).to.include({ email, displayName: 'Rakoto' });
      expect(r.body.user).not.to.have.property('password_hash');
      ({ accessToken: access, refreshToken: refresh } = r.body);
    });

    it('refuses a second account with the same email', async () => {
      await request(app).post('/api/auth/register').send({ email, password: 'correct-horse', displayName: 'Other' }).expect(409);
    });

    it('logs in with the right password only', async () => {
      await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
      const r = await request(app).post('/api/auth/login').send({ email, password: 'correct-horse' }).expect(200);
      expect(r.body.user.email).to.equal(email);
      expect(r.body.accessToken).to.be.a('string');
    });

    it('GET /auth/me returns the current user', async () => {
      const r = await request(app).get('/api/auth/me').set(bearer()).expect(200);
      expect(r.body).to.include({ email, displayName: 'Rakoto' });
    });

    it('rotates refresh tokens: the old one cannot be reused', async () => {
      const r = await request(app).post('/api/auth/refresh').send({ refreshToken: refresh }).expect(200);
      await request(app).post('/api/auth/refresh').send({ refreshToken: refresh }).expect(401);
      ({ accessToken: access, refreshToken: refresh } = r.body);
      await request(app).get('/api/auth/me').set(bearer()).expect(200);
    });

    it('logout revokes the refresh token', async () => {
      const login = await request(app).post('/api/auth/login').send({ email, password: 'correct-horse' }).expect(200);
      await request(app).post('/api/auth/logout').set({ Authorization: `Bearer ${login.body.accessToken}` }).send({ refreshToken: login.body.refreshToken }).expect(200);
      await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(401);
    });
  });

  describe('not found', () => {
    it('unknown routes answer a JSON 404 (behind auth, so 401 without a session)', async () => {
      await request(app).get('/api/nope').expect(401);
      const r = await request(app).get('/api/nope').set(bearer()).expect(404);
      expect(r.body.message).to.equal('Route introuvable');
    });
  });

  describe('likes', () => {
    it('likes a song and lists it', async () => {
      await request(app).put(`/api/library/likes/${A.id}`).set(bearer()).send(A).expect(200);
      await request(app).put(`/api/library/likes/${B.id}`).set(bearer()).send(B).expect(200);
      const ids = await request(app).get('/api/library/like-ids').set(bearer()).expect(200);
      expect(ids.body.ids).to.have.members([A.id, B.id]);
      const likes = await request(app).get('/api/library/likes').set(bearer()).expect(200);
      expect(likes.body.songs.map((s: { title: string }) => s.title)).to.have.members(['Vololona', 'Bad Guy']);
    });

    it('rejects a body that does not match the URL', async () => {
      await request(app).put(`/api/library/likes/${C.id}`).set(bearer()).send(A).expect(400);
    });

    it('rejects invalid YouTube ids', async () => {
      await request(app).put('/api/library/likes/bad').set(bearer()).send({ ...A, id: 'bad' }).expect(400);
    });

    it('unlikes a song', async () => {
      await request(app).delete(`/api/library/likes/${B.id}`).set(bearer()).expect(200);
      const ids = await request(app).get('/api/library/like-ids').set(bearer()).expect(200);
      expect(ids.body.ids).to.deep.equal([A.id]);
    });
  });

  describe('plays and history', () => {
    it('records real listens, ignores zapping and skips in history', async () => {
      await request(app).post('/api/plays').set(bearer()).send({ song: A, listenedSeconds: 120, completed: true, skipped: false }).expect(201);
      await request(app).post('/api/plays').set(bearer()).send({ song: B, listenedSeconds: 2, completed: false, skipped: false }).expect(201);
      await request(app).post('/api/plays').set(bearer()).send({ song: C, listenedSeconds: 8, completed: false, skipped: true }).expect(201);
      const r = await request(app).get('/api/library/history').set(bearer()).expect(200);
      expect(r.body.songs.map((s: { id: string }) => s.id)).to.deep.equal([A.id]);
    });

    it('validates play events', async () => {
      await request(app).post('/api/plays').set(bearer()).send({ song: A, listenedSeconds: -1, completed: true, skipped: false }).expect(400);
    });
  });

  describe('playlists', () => {
    let id = '';

    it('creates a playlist with songs (duplicates removed)', async () => {
      const r = await request(app).post('/api/playlists').set(bearer()).send({ name: '  Soirée  ', songs: [A, B, A] }).expect(201);
      id = r.body.id;
      const p = await request(app).get(`/api/playlists/${id}`).set(bearer()).expect(200);
      expect(p.body).to.include({ name: 'Soirée', songCount: 2, duration: A.duration + B.duration });
      expect(p.body.songs.map((s: { id: string }) => s.id)).to.deep.equal([A.id, B.id]);
    });

    it('requires a name', async () => {
      await request(app).post('/api/playlists').set(bearer()).send({ name: '   ' }).expect(400);
    });

    it('appends only new songs', async () => {
      const r = await request(app).post(`/api/playlists/${id}/songs`).set(bearer()).send({ songs: [B, C] }).expect(200);
      expect(r.body.added).to.equal(1);
      const p = await request(app).get(`/api/playlists/${id}`).set(bearer()).expect(200);
      expect(p.body.songs.map((s: { id: string }) => s.id)).to.deep.equal([A.id, B.id, C.id]);
    });

    it('reorders, and refuses an order built from a stale list', async () => {
      await request(app).put(`/api/playlists/${id}/order`).set(bearer()).send({ songIds: [C.id, A.id, B.id] }).expect(200);
      const p = await request(app).get(`/api/playlists/${id}`).set(bearer()).expect(200);
      expect(p.body.songs.map((s: { id: string }) => s.id)).to.deep.equal([C.id, A.id, B.id]);
      await request(app).put(`/api/playlists/${id}/order`).set(bearer()).send({ songIds: [A.id, B.id] }).expect(409);
    });

    it('renames and removes songs', async () => {
      await request(app).patch(`/api/playlists/${id}`).set(bearer()).send({ name: 'Matin', description: 'calme' }).expect(200);
      await request(app).delete(`/api/playlists/${id}/songs/${A.id}`).set(bearer()).expect(200);
      const p = await request(app).get(`/api/playlists/${id}`).set(bearer()).expect(200);
      expect(p.body).to.include({ name: 'Matin', description: 'calme', songCount: 2 });
    });

    it('lists the playlists with their summary', async () => {
      const r = await request(app).get('/api/playlists').set(bearer()).expect(200);
      expect(r.body.playlists).to.have.length(1);
      expect(r.body.playlists[0]).to.include({ id, name: 'Matin', songCount: 2 });
      expect(r.body.playlists[0].coverIds).to.deep.equal([C.id, B.id]);
    });

    it("keeps other users out of someone else's playlist", async () => {
      const other = await request(app)
        .post('/api/auth/register')
        .send({ email: `it-other-${stamp}@example.com`, password: 'correct-horse', displayName: 'Other' })
        .expect(201);
      const auth = { Authorization: `Bearer ${other.body.accessToken}` };
      await request(app).get(`/api/playlists/${id}`).set(auth).expect(403);
      await request(app).delete(`/api/playlists/${id}`).set(auth).expect(403);
    });

    it('validates ids and 404s on unknown playlists', async () => {
      await request(app).get('/api/playlists/not-a-uuid').set(bearer()).expect(400);
      await request(app).get('/api/playlists/00000000-0000-4000-8000-000000000000').set(bearer()).expect(404);
    });

    it('deletes a playlist', async () => {
      await request(app).delete(`/api/playlists/${id}`).set(bearer()).expect(200);
      await request(app).get(`/api/playlists/${id}`).set(bearer()).expect(404);
    });
  });

  describe('search', () => {
    const original = globalThis.fetch;
    afterEach(() => { globalThis.fetch = original; });

    it('returns cleaned songs from YouTube (InnerTube stubbed)', async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({
        contents: [{ videoRenderer: { videoId: 'fffffffffff', title: { runs: [{ text: 'Mahaleo - Bagdad (Official Audio)' }] }, ownerText: { runs: [{ text: 'Mahaleo' }] }, lengthText: { simpleText: '4:05' } } }],
      }), { status: 200 })) as typeof fetch;
      const r = await request(app).get('/api/search?q=it-mahaleo-bagdad').set(bearer()).expect(200);
      expect(r.body.songs).to.deep.equal([{ id: 'fffffffffff', title: 'Bagdad', artist: 'Mahaleo', duration: 245 }]);
    });

    it('returns nothing for an empty query without calling YouTube', async () => {
      globalThis.fetch = (async () => { throw new Error('should not be called'); }) as typeof fetch;
      const r = await request(app).get('/api/search?q=').set(bearer()).expect(200);
      expect(r.body.songs).to.deep.equal([]);
    });
  });
});
