/**
 * Thin wrapper around the official YouTube IFrame Player API.
 *
 * Used as a fallback when the API's audio proxy cannot reach YouTube (cloud
 * hosts get "confirm you're not a bot" challenges): the embed plays from the
 * listener's own connection, which YouTube does not block.
 */

export interface YTPlayer {
  loadVideoById(id: string, startSeconds?: number): void;
  cueVideoById(id: string, startSeconds?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube player unavailable'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface EmbedEvents {
  onStateChange: (state: number) => void;
  onError: (code: number) => void;
}

/** Creates the (invisible) player inside `host`; resolves once it is ready to take commands. */
export async function createEmbedPlayer(host: HTMLElement, events: EmbedEvents): Promise<YTPlayer> {
  await loadApi();
  const mount = document.createElement('div');
  host.appendChild(mount);
  return new Promise<YTPlayer>((resolve) => {
    const player = new window.YT!.Player(mount, {
      width: 200,
      height: 200,
      playerVars: { origin: window.location.origin, autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e: { data: number }) => events.onStateChange(e.data),
        onError: (e: { data: number }) => events.onError(e.data),
      },
    });
  });
}

/* Once the proxy failed, stay on the embed for a while instead of failing again on every song. */
const STICKY_KEY = 'feo_embed_until';
const STICKY_MS = 30 * 60 * 1000;

export function embedPreferred(): boolean {
  try { return Number(localStorage.getItem(STICKY_KEY) || 0) > Date.now(); } catch { return false; }
}

export function preferEmbed(untilMs = Date.now() + STICKY_MS) {
  try { localStorage.setItem(STICKY_KEY, String(untilMs)); } catch { /* private mode */ }
}
