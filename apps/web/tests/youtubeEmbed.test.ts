// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.head.innerHTML = '';
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
});
afterEach(() => vi.useRealTimers());

describe('embed preference', () => {
  it('is off by default, on after a proxy failure, and expires', async () => {
    vi.useFakeTimers();
    const { embedPreferred, preferEmbed } = await import('../src/components/player/youtubeEmbed');
    expect(embedPreferred()).toBe(false);
    preferEmbed();
    expect(embedPreferred()).toBe(true);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(embedPreferred()).toBe(false);
  });

  it('accepts an explicit deadline', async () => {
    const { embedPreferred, preferEmbed } = await import('../src/components/player/youtubeEmbed');
    preferEmbed(Date.now() - 1);
    expect(embedPreferred()).toBe(false);
  });
});

describe('createEmbedPlayer', () => {
  it('loads the IFrame API once and resolves when the player is ready', async () => {
    const { createEmbedPlayer } = await import('../src/components/player/youtubeEmbed');
    const host = document.createElement('div');
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const pending = createEmbedPlayer(host, { onStateChange, onError });

    const scripts = document.head.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]');
    expect(scripts).toHaveLength(1);

    let options: any;
    window.YT = {
      Player: class {
        constructor(el: HTMLElement, opts: any) {
          options = opts;
          expect(host.contains(el)).toBe(true);
          setTimeout(() => opts.events.onReady());
        }
      } as any,
    };
    window.onYouTubeIframeAPIReady!();
    const player = await pending;
    expect(player).toBeTruthy();
    expect(options.playerVars).toMatchObject({ controls: 0, playsinline: 1, origin: window.location.origin });

    options.events.onStateChange({ data: 1 });
    options.events.onError({ data: 150 });
    expect(onStateChange).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledWith(150);
  });

  it('rejects when the IFrame API cannot be downloaded', async () => {
    const { createEmbedPlayer } = await import('../src/components/player/youtubeEmbed');
    const pending = createEmbedPlayer(document.createElement('div'), { onStateChange: vi.fn(), onError: vi.fn() });
    (document.head.querySelector('script') as HTMLScriptElement).onerror!(new Event('error'));
    await expect(pending).rejects.toThrow(/unavailable/);
  });
});
