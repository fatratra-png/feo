// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  auth: { login: vi.fn(), register: vi.fn(), me: vi.fn(), logout: vi.fn() },
};
let session = false;
const setTokens = vi.fn((a: string | null, r: string | null) => { session = Boolean(a || r); });
vi.mock('../src/lib/api', () => ({ api, hasSession: () => session, setTokens: (a: string | null, r: string | null) => setTokens(a, r) }));

const { useUiStore, toast } = await import('../src/stores/ui');
const { useAuthStore } = await import('../src/stores/auth');
const { useThemeStore } = await import('../src/stores/theme');

const user = { id: 'u1', email: 'a@b.c', displayName: 'Rakoto', avatarUrl: null, createdAt: '' };

describe('toasts', () => {
  beforeEach(() => { vi.useFakeTimers(); useUiStore.setState({ toasts: [] }); });
  afterEach(() => vi.useRealTimers());

  it('shows at most three toasts, newest last', () => {
    for (const m of ['1', '2', '3', '4']) toast(m);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['2', '3', '4']);
  });

  it('dismisses itself, later when it carries an action', () => {
    toast('plain');
    toast('undo me', { tone: 'success', action: { label: 'Annuler', run: () => undefined } });
    vi.advanceTimersByTime(4000);
    expect(useUiStore.getState().toasts.map((t) => t.message)).toEqual(['undo me']);
    vi.advanceTimersByTime(2500);
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('defaults to the info tone', () => {
    toast('x');
    expect(useUiStore.getState().toasts[0].tone).toBe('info');
  });
});

describe('add-to-playlist dialog state', () => {
  it('opens with the songs and closes', () => {
    const songs = [{ id: 'aaaaaaaaaaa', title: 'T', artist: 'A', duration: 1 }];
    useUiStore.getState().openAddToPlaylist(songs);
    expect(useUiStore.getState().addToPlaylist).toBe(songs);
    useUiStore.getState().closeAddToPlaylist();
    expect(useUiStore.getState().addToPlaylist).toBeNull();
  });
});

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session = false;
    useAuthStore.setState({ user: null, status: 'anonymous' });
  });

  it('login stores the tokens and the user', async () => {
    api.auth.login.mockResolvedValue({ user, accessToken: 'A', refreshToken: 'R' });
    await useAuthStore.getState().login('a@b.c', 'pw');
    expect(setTokens).toHaveBeenCalledWith('A', 'R');
    expect(useAuthStore.getState()).toMatchObject({ user, status: 'authenticated' });
  });

  it('register signs the new user in', async () => {
    api.auth.register.mockResolvedValue({ user, accessToken: 'A', refreshToken: 'R' });
    await useAuthStore.getState().register('a@b.c', 'pw', 'Rakoto');
    expect(api.auth.register).toHaveBeenCalledWith('a@b.c', 'pw', 'Rakoto');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('a failed login leaves the user anonymous', async () => {
    api.auth.login.mockRejectedValue(new Error('Email ou mot de passe incorrect'));
    await expect(useAuthStore.getState().login('a@b.c', 'bad')).rejects.toThrow();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('init restores a saved session', async () => {
    session = true;
    api.auth.me.mockResolvedValue(user);
    await useAuthStore.getState().init();
    expect(useAuthStore.getState()).toMatchObject({ user, status: 'authenticated' });
  });

  it('init drops a session the server no longer accepts', async () => {
    session = true;
    api.auth.me.mockRejectedValue(new Error('401'));
    await useAuthStore.getState().init();
    expect(setTokens).toHaveBeenCalledWith(null, null);
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('init without a session does not call the API', async () => {
    await useAuthStore.getState().init();
    expect(api.auth.me).not.toHaveBeenCalled();
  });

  it('logout clears everything', async () => {
    useAuthStore.setState({ user, status: 'authenticated' });
    await useAuthStore.getState().logout();
    expect(api.auth.logout).toHaveBeenCalled();
    expect(setTokens).toHaveBeenCalledWith(null, null);
    expect(useAuthStore.getState()).toMatchObject({ user: null, status: 'anonymous' });
  });
});

describe('theme store', () => {
  it('toggle switches the document theme and remembers it', () => {
    useThemeStore.getState().setPref('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    useThemeStore.getState().toggle();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(useThemeStore.getState()).toMatchObject({ pref: 'dark', resolved: 'dark' });
    expect(localStorage.getItem('feo_theme')).toBe('dark');
  });

  it('"system" forgets the saved choice', () => {
    useThemeStore.getState().setPref('dark');
    useThemeStore.getState().setPref('system');
    expect(localStorage.getItem('feo_theme')).toBeNull();
    expect(useThemeStore.getState().pref).toBe('system');
  });
});
