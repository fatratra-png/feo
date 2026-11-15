// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fresh module per test: the API client keeps tokens in module state. */
async function load(handler: Handler, tokens: { access?: string; refresh?: string } = {}) {
  vi.resetModules();
  localStorage.clear();
  if (tokens.access) localStorage.setItem('feo_access_token', tokens.access);
  if (tokens.refresh) localStorage.setItem('feo_refresh_token', tokens.refresh);
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => handler(String(url), init));
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('../src/lib/api');
  return { ...mod, fetchMock };
}

const auth = (init: RequestInit) => (init.headers as Record<string, string> | undefined)?.Authorization;

beforeEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the access token and JSON bodies', async () => {
    const { api, fetchMock } = await load(() => json({ id: 'p1' }, 201), { access: 'A1', refresh: 'R1' });
    await api.playlists.create({ name: 'Soirée', songs: [{ id: 'aaaaaaaaaaa', title: 'T', artist: 'A', duration: 1, reason: 'x' } as never] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/playlists');
    expect(auth(init)).toBe('Bearer A1');
    // Only the song fields the API accepts are sent.
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Soirée', songs: [{ id: 'aaaaaaaaaaa', title: 'T', artist: 'A', duration: 1 }] });
  });

  it('refreshes an expired session once and replays the request', async () => {
    const { api, fetchMock } = await load((url, init) => {
      if (url.endsWith('/auth/refresh')) return json({ accessToken: 'A2', refreshToken: 'R2' });
      return auth(init) === 'Bearer A2' ? json({ ids: ['x'] }) : json({ message: 'Session expirée' }, 401);
    }, { access: 'A1', refresh: 'R1' });
    expect(await api.likes.ids()).toEqual({ ids: ['x'] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('feo_access_token')).toBe('A2');
    expect(localStorage.getItem('feo_refresh_token')).toBe('R2');
  });

  it('shares a single refresh between concurrent requests', async () => {
    const { api, fetchMock } = await load(async (url, init) => {
      if (url.endsWith('/auth/refresh')) { await new Promise((r) => setTimeout(r, 10)); return json({ accessToken: 'A2', refreshToken: 'R2' }); }
      return auth(init) === 'Bearer A2' ? json({ ok: true }) : json({}, 401);
    }, { access: 'A1', refresh: 'R1' });
    await Promise.all([api.likes.ids(), api.history(), api.playlists.list()]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('logs out locally when the refresh token is rejected', async () => {
    const { api, setSessionExpiredHandler, hasSession } = await load(() => json({}, 401), { access: 'A1', refresh: 'R1' });
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    await expect(api.history()).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(hasSession()).toBe(false);
    expect(localStorage.getItem('feo_access_token')).toBeNull();
  });

  it('does not try to refresh on auth routes (wrong password stays a 401)', async () => {
    const { api, fetchMock } = await load(() => json({ message: 'Email ou mot de passe incorrect' }, 401), { refresh: 'R1' });
    await expect(api.auth.login('a@b.c', 'x')).rejects.toMatchObject({ status: 401, message: 'Email ou mot de passe incorrect' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('surfaces the server message and code', async () => {
    const { api, ApiError } = await load(() => json({ message: 'YouTube limite', code: 'YOUTUBE_BLOCKED' }, 503));
    const err = await api.search('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 503, message: 'YouTube limite', code: 'YOUTUBE_BLOCKED' });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    const { api } = await load(() => new Response('<html>', { status: 502 }));
    await expect(api.search('x')).rejects.toMatchObject({ status: 502, message: 'Erreur 502' });
  });

  it('turns network failures into a readable error', async () => {
    const { api } = await load(() => { throw new TypeError('Failed to fetch'); });
    await expect(api.search('x')).rejects.toMatchObject({ status: 0, message: 'Connexion impossible au serveur' });
  });

  it('encodes search queries', async () => {
    const { api, fetchMock } = await load(() => json({ songs: [] }));
    await api.search('salegy & afro?');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/search?q=salegy%20%26%20afro%3F');
  });

  it('never lets play reporting fail the caller', async () => {
    const { api } = await load(() => json({}, 500));
    await expect(api.recordPlay({ id: 'aaaaaaaaaaa', title: 'T', artist: 'A', duration: 1 }, 30, true, false)).resolves.toBeUndefined();
  });
});
