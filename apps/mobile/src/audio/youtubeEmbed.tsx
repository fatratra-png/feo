/**
 * The official YouTube IFrame player, running in an invisible WebView.
 *
 * Used as a fallback when the API's audio proxy cannot reach YouTube (cloud
 * hosts get "confirm you're not a bot" challenges): the embed plays from the
 * listener's own connection, which YouTube does not block.
 *
 * React Native talks to the page with `injectJavaScript` (commands) and the
 * page answers with `postMessage` (ready, state changes, errors, progress).
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { storage } from '../lib/storage';

// The default type parameter (`undefined`) collapses the props to `never` under
// recent TypeScript versions: pin it to an empty object.
const PlayerWebView = WebView<object>;

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/**
 * YouTube refuses to play embeds without an origin/referrer (errors 152/153),
 * so the page is loaded as if it were served from this origin. Point it at the
 * web app's domain with EXPO_PUBLIC_EMBED_ORIGIN.
 */
export const EMBED_ORIGIN = (process.env.EXPO_PUBLIC_EMBED_ORIGIN || 'https://feo-swart.vercel.app').replace(/\/$/, '');

const html = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}</style>
</head><body>
<div id="player"></div>
<script>
  var player = null;
  function send(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: 200,
      height: 200,
      playerVars: { origin: ${JSON.stringify(EMBED_ORIGIN)}, autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: function () { send({ type: 'ready' }); },
        onStateChange: function (e) { send({ type: 'state', state: e.data }); },
        onError: function (e) { send({ type: 'error', code: e.data }); }
      }
    });
  };
  // The IFrame API has no timeupdate event: report the position while playing.
  setInterval(function () {
    if (!player || !player.getPlayerState || player.getPlayerState() !== 1) return;
    send({ type: 'progress', time: player.getCurrentTime(), duration: player.getDuration() });
  }, 500);
  // Entry point for the commands injected by React Native.
  window.feo = function (cmd, a, b) {
    if (!player || !player.loadVideoById) return;
    switch (cmd) {
      case 'load': player.loadVideoById(a); break;
      case 'cue': player.cueVideoById(a); break;
      case 'play': player.playVideo(); break;
      case 'pause': player.pauseVideo(); break;
      case 'stop': player.stopVideo(); break;
      case 'seek': player.seekTo(a, true); break;
      case 'volume': player.setVolume(a); if (b) player.mute(); else player.unMute(); break;
    }
  };
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function () { send({ type: 'unavailable' }); };
  document.head.appendChild(tag);
</script>
</body></html>`;

export type EmbedMessage =
  | { type: 'ready' }
  | { type: 'unavailable' }
  | { type: 'state'; state: number }
  | { type: 'error'; code: number }
  | { type: 'progress'; time: number; duration: number };

export interface EmbedHandle {
  load(id: string): void;
  cue(id: string): void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  /** `volume` is 0..1, like the store. */
  setVolume(volume: number, muted: boolean): void;
}

interface Props {
  onMessage: (msg: EmbedMessage) => void;
  /** The WebView's process was killed (memory pressure): the player is gone. */
  onCrash: () => void;
}

export const YouTubeEmbed = forwardRef<EmbedHandle, Props>(function YouTubeEmbed({ onMessage, onCrash }, ref) {
  const web = useRef<WebView<object>>(null);
  const run = (cmd: string, a?: string | number | boolean, b?: string | number | boolean) =>
    web.current?.injectJavaScript(`window.feo && window.feo(${[cmd, a, b].map((v) => JSON.stringify(v ?? null)).join(',')}); true;`);

  useImperativeHandle(ref, () => ({
    load: (id) => run('load', id),
    cue: (id) => run('cue', id),
    play: () => run('play'),
    pause: () => run('pause'),
    stop: () => run('stop'),
    seek: (seconds) => run('seek', seconds),
    setVolume: (volume, muted) => run('volume', Math.round(volume * 100), muted),
  }), []);

  return (
    <PlayerWebView
      ref={web}
      source={{ html, baseUrl: EMBED_ORIGIN }}
      style={styles.hidden}
      containerStyle={styles.hidden}
      pointerEvents="none"
      originWhitelist={['*']}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsPictureInPictureMediaPlayback={false}
      onMessage={(e: WebViewMessageEvent) => {
        try { onMessage(JSON.parse(e.nativeEvent.data) as EmbedMessage); } catch { /* not ours */ }
      }}
      onError={() => onMessage({ type: 'unavailable' })}
      onContentProcessDidTerminate={onCrash}
      onRenderProcessGone={onCrash}
    />
  );
});

const styles = StyleSheet.create({
  // Must stay laid out (a 0×0 or off-screen WebView may not play), just invisible.
  hidden: { position: 'absolute', right: 0, bottom: 0, width: 200, height: 200, opacity: 0, zIndex: -1 },
});

/* Once the proxy failed, stay on the embed for a while instead of failing again on every song. */
const STICKY_KEY = 'feo_embed_until';
const STICKY_MS = 30 * 60 * 1000;

// SecureStore is async: keep the deadline in memory and persist it in the background.
let embedUntil = 0;

/** Restores the sticky choice saved by a previous session. */
export async function loadEmbedPreference(): Promise<boolean> {
  embedUntil = Math.max(embedUntil, Number((await storage.get(STICKY_KEY)) || 0));
  return embedPreferred();
}

export function embedPreferred(): boolean {
  return embedUntil > Date.now();
}

export function preferEmbed(untilMs = Date.now() + STICKY_MS) {
  embedUntil = untilMs;
  void storage.set(STICKY_KEY, String(untilMs));
}
