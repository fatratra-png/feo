/**
 * Account recovery and external logins, over HTTP against PostgreSQL.
 * Google, GitHub and the email provider are stubbed. Skipped without TEST_DATABASE_URL.
 */
import { expect } from 'chai';
import type { Express } from 'express';
import request from 'supertest';

const DB = process.env.TEST_DATABASE_URL;
const suite = DB ? describe : describe.skip;

type Stub = (url: string, init?: RequestInit) => unknown;

suite('Auth flows (integration)', function () {
  this.timeout(30000);
  let app: Express;
  let outbox: { to: string; text: string }[];
  const original = globalThis.fetch;
  const stamp = Date.now();
  const mail = (n: string) => `it-auth-${n}-${stamp}@example.com`;

  /** Replaces outgoing HTTP calls (supertest itself does not use fetch). */
  function fakeProviders(stub: Stub) {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const body = stub(String(url), init);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  }

  const register = async (name: string, password = 'first-password') => {
    const r = await request(app).post('/api/auth/register').send({ email: mail(name), password, displayName: name }).expect(201);
    return r.body as { accessToken: string; refreshToken: string; user: { id: string } };
  };

  before(async () => {
    const { migrate } = await import('../src/migrate');
    await migrate();
    app = (await import('../src/app')).createApp();
    ({ outbox } = await import('../src/services/mail'));
  });
  afterEach(() => { globalThis.fetch = original; });
  after(async () => {
    const { pool } = await import('../src/db');
    await pool.query(`DELETE FROM users WHERE email LIKE 'it-auth-%@example.com'`);
  });

  describe('change password', () => {
    it('requires the current password, then signs other sessions out', async () => {
      const a = await register('change');
      const auth = { Authorization: `Bearer ${a.accessToken}` };
      await request(app).put('/api/auth/password').set(auth).send({ currentPassword: 'nope', newPassword: 'second-password' }).expect(400);
      await request(app).put('/api/auth/password').set(auth).send({ currentPassword: 'first-password', newPassword: 'short' }).expect(400);
      await request(app).put('/api/auth/password').set(auth).send({ currentPassword: 'first-password', newPassword: 'first-password' }).expect(400);

      const r = await request(app).put('/api/auth/password').set(auth).send({ currentPassword: 'first-password', newPassword: 'second-password' }).expect(200);
      expect(r.body.accessToken).to.be.a('string');
      await request(app).post('/api/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
      await request(app).post('/api/auth/refresh').send({ refreshToken: r.body.refreshToken }).expect(200);
      await request(app).post('/api/auth/login').send({ email: mail('change'), password: 'first-password' }).expect(401);
      await request(app).post('/api/auth/login').send({ email: mail('change'), password: 'second-password' }).expect(200);
    });

    it('requires a session', async () => {
      await request(app).put('/api/auth/password').send({ newPassword: 'whatever-123' }).expect(401);
    });
  });

  describe('forgot / reset password', () => {
    const linkFor = (email: string) => {
      const m = [...outbox].reverse().find((x) => x.to === email);
      return m?.text.match(/https?:\/\/\S+/)?.[0];
    };
    const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;

    it('answers the same for unknown emails, without sending anything', async () => {
      const before = outbox.length;
      const r = await request(app).post('/api/auth/forgot-password').send({ email: mail('ghost') }).expect(200);
      expect(r.body).to.deep.equal({ ok: true });
      expect(outbox.length).to.equal(before);
    });

    it('emails a single-use link that resets the password and signs in', async () => {
      const a = await register('reset');
      await request(app).post('/api/auth/forgot-password').send({ email: mail('reset').toUpperCase() }).expect(200);
      const link = linkFor(mail('reset'));
      expect(link).to.match(/^http:\/\/app\.test\/reset-password\?token=/);

      const r = await request(app).post('/api/auth/reset-password').send({ token: tokenOf(link!), password: 'brand-new-pass' }).expect(200);
      expect(r.body.user.email).to.equal(mail('reset'));
      expect(r.body.accessToken).to.be.a('string');

      await request(app).post('/api/auth/reset-password').send({ token: tokenOf(link!), password: 'another-pass-1' }).expect(400);
      await request(app).post('/api/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
      await request(app).post('/api/auth/login').send({ email: mail('reset'), password: 'brand-new-pass' }).expect(200);
    });

    it('rejects forged or malformed tokens', async () => {
      const r = await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(43), password: 'brand-new-pass' }).expect(400);
      expect(r.body.code).to.equal('RESET_INVALID');
      await request(app).post('/api/auth/reset-password').send({ token: 'short', password: 'brand-new-pass' }).expect(400);
    });

    it('a newer reset invalidates nothing, a used one invalidates the others', async () => {
      await register('multi');
      await request(app).post('/api/auth/forgot-password').send({ email: mail('multi') }).expect(200);
      const first = linkFor(mail('multi'))!;
      await request(app).post('/api/auth/forgot-password').send({ email: mail('multi') }).expect(200);
      const second = linkFor(mail('multi'))!;
      expect(second).not.to.equal(first);
      await request(app).post('/api/auth/reset-password').send({ token: tokenOf(second), password: 'brand-new-pass' }).expect(200);
      await request(app).post('/api/auth/reset-password').send({ token: tokenOf(first), password: 'other-new-pass' }).expect(400);
    });

    it('caps reset emails per hour', async () => {
      await register('flood');
      const before = outbox.length;
      for (let i = 0; i < 5; i++) await request(app).post('/api/auth/forgot-password').send({ email: mail('flood') }).expect(200);
      expect(outbox.length - before).to.equal(3);
    });
  });

  describe('Google / GitHub login', () => {
    /** Runs start → provider → callback like a browser would, returning the final redirect. */
    async function loginVia(provider: 'google' | 'github', opts: { target?: string; withCookie?: boolean } = {}) {
      const start = await request(app).get(`/api/auth/oauth/${provider}/start${opts.target ? `?target=${opts.target}` : ''}`).expect(302);
      const authorize = new URL(start.headers.location);
      const state = authorize.searchParams.get('state')!;
      const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      const cb = request(app).get(`/api/auth/oauth/${provider}/callback?code=provider-code&state=${encodeURIComponent(state)}`);
      if (opts.withCookie !== false) cb.set('Cookie', cookie);
      const res = await cb.expect(302);
      return { authorize, location: new URL(res.headers.location) };
    }

    const google = (profile: Record<string, unknown>) => fakeProviders((url) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) return { access_token: 'g-token' };
      if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) return profile;
      throw new Error(`unexpected ${url}`);
    });

    it('lists the configured providers', async () => {
      const r = await request(app).get('/api/auth/providers').expect(200);
      expect(r.body).to.deep.equal({ google: true, github: true, passwordResetEmail: false });
    });

    it('sends the browser to Google with the right parameters', async () => {
      const start = await request(app).get('/api/auth/oauth/google/start').expect(302);
      const url = new URL(start.headers.location);
      expect(url.origin + url.pathname).to.equal('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).to.equal('google-client');
      expect(url.searchParams.get('redirect_uri')).to.equal('http://api.test/api/auth/oauth/google/callback');
      expect(url.searchParams.get('scope')).to.equal('openid email profile');
      expect(start.headers['set-cookie'][0]).to.match(/^feo_oauth_nonce=.+HttpOnly; SameSite=Lax/);
    });

    it('creates an account from Google and trades the one-time code for a session', async () => {
      google({ sub: `g-${stamp}`, email: mail('google'), email_verified: true, name: 'Hery G', picture: 'https://pic/g.png' });
      const { location } = await loginVia('google');
      expect(location.origin + location.pathname).to.equal('http://app.test/auth/callback');
      const code = location.searchParams.get('code')!;

      const r = await request(app).post('/api/auth/oauth/exchange').send({ code }).expect(200);
      expect(r.body.user).to.include({ email: mail('google'), displayName: 'Hery G', avatarUrl: 'https://pic/g.png' });
      await request(app).post('/api/auth/oauth/exchange').send({ code }).expect(400); // single use

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(200);
      expect(me.body).to.include({ hasPassword: false });
      expect(me.body.providers).to.deep.equal(['google']);

      // No password yet: a clear message, and the account can create one without a current password.
      const login = await request(app).post('/api/auth/login').send({ email: mail('google'), password: 'whatever-123' }).expect(401);
      expect(login.body.code).to.equal('NO_PASSWORD');
      await request(app).put('/api/auth/password').set('Authorization', `Bearer ${r.body.accessToken}`).send({ newPassword: 'now-i-have-one' }).expect(200);
      await request(app).post('/api/auth/login').send({ email: mail('google'), password: 'now-i-have-one' }).expect(200);
    });

    it('signs the same Google user into the same account next time', async () => {
      google({ sub: `g-again-${stamp}`, email: mail('again'), email_verified: true, name: 'Again' });
      const first = await request(app).post('/api/auth/oauth/exchange').send({ code: (await loginVia('google')).location.searchParams.get('code') }).expect(200);
      google({ sub: `g-again-${stamp}`, email: mail('again'), email_verified: true, name: 'Again' });
      const second = await request(app).post('/api/auth/oauth/exchange').send({ code: (await loginVia('google')).location.searchParams.get('code') }).expect(200);
      expect(second.body.user.id).to.equal(first.body.user.id);
    });

    it('links GitHub to an existing account with the same verified email', async () => {
      const existing = await register('linked');
      fakeProviders((url) => {
        if (url.startsWith('https://github.com/login/oauth/access_token')) return { access_token: 'gh-token' };
        if (url === 'https://api.github.com/user') return { id: 4242 + stamp, login: 'rakoto', name: null, avatar_url: 'https://pic/gh.png' };
        if (url === 'https://api.github.com/user/emails') return [
          { email: 'old@example.com', primary: false, verified: false },
          { email: mail('linked'), primary: true, verified: true },
        ];
        throw new Error(`unexpected ${url}`);
      });
      const { location } = await loginVia('github');
      const r = await request(app).post('/api/auth/oauth/exchange').send({ code: location.searchParams.get('code') }).expect(200);
      expect(r.body.user.id).to.equal(existing.user.id);
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(200);
      expect(me.body).to.include({ hasPassword: true });
      expect(me.body.providers).to.deep.equal(['github']);
    });

    it('refuses an unverified email (it could be someone else\'s address)', async () => {
      google({ sub: `g-unverified-${stamp}`, email: mail('unverified'), email_verified: false, name: 'X' });
      const { location } = await loginVia('google');
      expect(location.searchParams.get('code')).to.equal(null);
      expect(location.searchParams.get('error')).to.match(/vérifié/);
    });

    it('blocks a callback that did not start in this browser (login CSRF)', async () => {
      google({ sub: `g-csrf-${stamp}`, email: mail('csrf'), email_verified: true, name: 'X' });
      const { location } = await loginVia('google', { withCookie: false });
      expect(location.searchParams.get('error')).to.match(/expiré/);
    });

    it('reports a cancelled login', async () => {
      const start = await request(app).get('/api/auth/oauth/google/start').expect(302);
      const state = new URL(start.headers.location).searchParams.get('state')!;
      const res = await request(app).get(`/api/auth/oauth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`).expect(302);
      expect(new URL(res.headers.location).searchParams.get('error')).to.equal('Connexion annulée.');
    });

    it('returns to the mobile app when started from it', async () => {
      google({ sub: `g-mobile-${stamp}`, email: mail('mobile'), email_verified: true, name: 'Mobile' });
      const { location } = await loginVia('google', { target: 'mobile' });
      expect(location.href.startsWith('feo://auth?code=')).to.equal(true);
    });

    it('reports provider outages without leaking details', async () => {
      fakeProviders(() => new Response('nope', { status: 500 }));
      const { location } = await loginVia('google');
      expect(location.searchParams.get('error')).to.equal('Connexion avec Google impossible pour le moment.');
    });
  });
});
