// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ---- fakes ---- */

const toast = vi.fn();
vi.mock('../src/stores/ui', () => ({ toast: (...a: unknown[]) => toast(...a) }));
vi.mock('../src/lib/api', () => ({
  api: { recordPlay: vi.fn(), radio: vi.fn().mockResolvedValue({ songs: [] }) },
  streamUrl: (id: string) => `http://api.test/stream/${id}`,
  coverUrl: (id: string) => `http://api.test/thumb/${id}`,
  healthUrl: 'http://api.test/health',
}));

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
let events: { onStateChange: (s: number) => void; onError: (c: number) => void };
const player = {
  state: STATE.UNSTARTED,
  time: 0,
  loadVideoById: vi.fn(function (this: void) { player.state = STATE.BUFFERING; }),
  cueVideoById: vi.fn(() => { player.state = STATE.CUED; }),
  playVideo: vi.fn(() => { player.state = STATE.PLAYING; }),
  pauseVideo: vi.fn(() => { player.state = STATE.PAUSED; }),
  stopVideo: vi.fn(),
  seekTo: vi.fn(),
  setVolume: vi.fn(),
  mute: vi.fn(),
  unMute: vi.fn(),
  getCurrentTime: () => player.time,
  getDuration: () => 211,
  getPlayerState: () => player.state,
  destroy: vi.fn(),
};
vi.mock('../src/components/player/youtubeEmbed', async (orig) => {
  const real = await orig<typeof import('../src/components/player/youtubeEmbed')>();
  return {
    ...real,
    createEmbedPlayer: vi.fn(async (_host: HTMLElement, ev: typeof events) => { events = ev; return player; }),
  };
});

const { AudioEngine } = await import('../src/components/player/AudioEngine');
const { usePlayerStore } = await import('../src/stores/player');

const song = (n: number) => ({ id: `video${String(n).padStart(6, '0')}`, title: `Song ${n}`, artist: 'Artist', duration: 200 });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

let healthBody: unknown = { youtubeBlockedUntil: null };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  player.state = STATE.UNSTARTED;
  player.time = 0;
  healthBody = { youtubeBlockedUntil: null };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(healthBody))));
  // jsdom does not implement media playback.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  usePlayerStore.setState({ queue: [], index: -1, isPlaying: false, position: 0, repeat: 'off', radio: false, volume: 0.8, muted: false });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const audio = (c: HTMLElement) => c.querySelector('audio')!;

describe('AudioEngine', () => {
  it('plays through the API proxy by default', async () => {
    const { container } = render(<AudioEngine />);
    await act(async () => usePlayerStore.getState().playSongs([song(1), song(2)]));
    expect(audio(container).getAttribute('src')).toBe('http://api.test/stream/video000001');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(document.title).toBe('Song 1 · Artist — FEO');
  });

  it('switches to the YouTube embed when the proxy fails, and remembers it', async () => {
    const { container } = render(<AudioEngine />);
    await act(async () => usePlayerStore.getState().playSongs([song(1), song(2)]));
    await act(async () => { fireEvent.error(audio(container)); });
    await flush();
    expect(player.loadVideoById).toHaveBeenCalledWith('video000001');
    expect(player.setVolume).toHaveBeenCalledWith(80);
    expect(audio(container).getAttribute('src')).toBeNull();
    expect(localStorage.getItem('feo_embed_until')).not.toBeNull();
    expect(toast).not.toHaveBeenCalled();

    // The next song goes straight to the embed.
    await act(async () => usePlayerStore.getState().next());
    await flush();
    expect(player.loadVideoById).toHaveBeenLastCalledWith('video000002');
    expect(audio(container).getAttribute('src')).toBeNull();
  });

  it('starts on the embed when the API reports a YouTube block', async () => {
    healthBody = { youtubeBlockedUntil: new Date(Date.now() + 60000).toISOString() };
    const { container } = render(<AudioEngine />);
    await flush();
    await act(async () => usePlayerStore.getState().playSongs([song(1)]));
    await flush();
    expect(player.loadVideoById).toHaveBeenCalledWith('video000001');
    expect(audio(container).getAttribute('src')).toBeNull();
  });

  describe('in embed mode', () => {
    beforeEach(() => localStorage.setItem('feo_embed_until', String(Date.now() + 600000)));

    it('mirrors play / pause / seek / volume from the store', async () => {
      render(<AudioEngine />);
      await act(async () => usePlayerStore.getState().playSongs([song(1)]));
      await flush();
      await act(async () => events.onStateChange((player.state = STATE.PLAYING)));

      await act(async () => usePlayerStore.getState().togglePlay());
      expect(player.pauseVideo).toHaveBeenCalled();
      await act(async () => usePlayerStore.getState().togglePlay());
      expect(player.playVideo).toHaveBeenCalled();
      await act(async () => usePlayerStore.getState().seek(42));
      expect(player.seekTo).toHaveBeenCalledWith(42, true);
      await act(async () => usePlayerStore.getState().setVolume(0.3));
      expect(player.setVolume).toHaveBeenLastCalledWith(30);
      await act(async () => usePlayerStore.getState().toggleMute());
      expect(player.mute).toHaveBeenCalled();
    });

    it('cues instead of playing when the store is paused', async () => {
      render(<AudioEngine />);
      await act(async () => {
        usePlayerStore.getState().playSongs([song(1)]);
        usePlayerStore.getState().setPlaying(false);
      });
      await flush();
      expect(player.cueVideoById).toHaveBeenCalledWith('video000001');
      expect(player.loadVideoById).not.toHaveBeenCalled();
    });

    it('reports progress and buffering to the store', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<AudioEngine />);
      await act(async () => usePlayerStore.getState().playSongs([song(1)]));
      await flush();
      await act(async () => events.onStateChange(STATE.BUFFERING));
      expect(usePlayerStore.getState().buffering).toBe(true);
      player.state = STATE.PLAYING;
      player.time = 12.5;
      await act(async () => events.onStateChange(STATE.PLAYING));
      expect(usePlayerStore.getState().buffering).toBe(false);
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(usePlayerStore.getState()).toMatchObject({ position: 12.5, duration: 211 });
      vi.useRealTimers();
    });

    it('moves on when a song ends', async () => {
      render(<AudioEngine />);
      await act(async () => usePlayerStore.getState().playSongs([song(1), song(2)]));
      await flush();
      await act(async () => events.onStateChange(STATE.ENDED));
      expect(usePlayerStore.getState().index).toBe(1);
    });

    it('skips songs the embed cannot play, and stops after three failures', async () => {
      render(<AudioEngine />);
      await act(async () => usePlayerStore.getState().playSongs([song(1), song(2), song(3), song(4)]));
      await flush();
      await act(async () => events.onError(150));
      expect(toast).toHaveBeenLastCalledWith('« Song 1 » est indisponible, titre suivant', { tone: 'error' });
      expect(usePlayerStore.getState().index).toBe(1);
      await act(async () => events.onError(150));
      await act(async () => events.onError(150));
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(toast).toHaveBeenLastCalledWith('Lecture impossible pour le moment. Vérifie ta connexion.', { tone: 'error' });
    });
  });
});
