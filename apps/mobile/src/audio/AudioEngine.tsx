import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { coverUrl, healthUrl, streamUrl } from '../lib/api';
import { usePlayerStore, type QueueItem } from '../stores/player';
import { toast } from '../stores/ui';
import { YT_STATE, YouTubeEmbed, embedPreferred, loadEmbedPreference, preferEmbed, type EmbedHandle, type EmbedMessage } from './youtubeEmbed';

/** If a song shows no progress for this long after starting, it is skipped. */
const STALL_MS = 25_000;
/** How long the hidden YouTube player may take to load before we give up. */
const EMBED_READY_MS = 20_000;
/** react-native-webview has no web implementation: Expo web keeps the proxy only. */
const CAN_EMBED = Platform.OS !== 'web';

type Mode = 'proxy' | 'embed';

/**
 * The single audio player of the app. It mirrors the player store: the store
 * says what should happen, the engine makes the active backend do it.
 *
 * Two backends, like on the web:
 * - `proxy`: expo-audio reading the API's /stream proxy (background playback,
 *   lock-screen controls, no ads);
 * - `embed`: the official YouTube player in a hidden WebView, used when the
 *   proxy cannot reach YouTube (the API's host gets bot-checked). It plays from
 *   the phone's own connection, so it keeps working whatever happens server-side.
 */
export function AudioEngine() {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const lastTime = useRef(0);
  const failures = useRef(0);
  const endedFor = useRef<string | null>(null);
  const mode = useRef<Mode>('proxy');
  /** Song for which the proxy already failed, so one error triggers one fallback. */
  const fellBackFor = useRef<string | null>(null);

  // The WebView is only mounted once the embed is first needed.
  const [embedMounted, setEmbedMounted] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  const embed = useRef<EmbedHandle>(null);
  const embedReady = useRef(false);
  const embedLoading = useRef<{ promise: Promise<void>; resolve: () => void; reject: () => void } | null>(null);
  const embedState = useRef<number>(YT_STATE.UNSTARTED);
  const autoplayCheck = useRef<ReturnType<typeof setTimeout>>(undefined);

  const current = usePlayerStore((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const seekRequest = usePlayerStore((s) => s.seekRequest);
  const nextId = usePlayerStore((s) => s.queue[s.index + 1]?.id);

  useEffect(() => {
    // Keep playing with the screen locked and when the iPhone is on silent.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => undefined);
  }, []);

  /* ---------------- shared failure handling ---------------- */

  function handleFailure() {
    const s = usePlayerStore.getState();
    const song = s.current();
    if (!song) return;
    failures.current += 1;
    if (failures.current >= 3) {
      s.setPlaying(false);
      s.onBuffering(false);
      toast('Lecture impossible pour le moment. Vérifie ta connexion.', { tone: 'error' });
      return;
    }
    toast(`« ${song.title} » est indisponible, titre suivant`, { tone: 'error' });
    s.next(false);
  }

  /** The API could not get this song from YouTube: play it with the YouTube player instead. */
  function fallBackToEmbed(song: QueueItem) {
    if (!CAN_EMBED) return handleFailure();
    fellBackFor.current = song.uid;
    preferEmbed();
    playEmbed(song);
  }

  /* ---------------- YouTube embed backend ---------------- */

  function ensureEmbed(): Promise<void> {
    if (embedReady.current) return Promise.resolve();
    if (!embedLoading.current) {
      let resolve!: () => void;
      let reject!: () => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      const timer = setTimeout(() => reject(), EMBED_READY_MS);
      promise.finally(() => clearTimeout(timer)).catch(() => undefined);
      promise.catch(() => { embedLoading.current = null; });
      embedLoading.current = { promise, resolve, reject };
      setEmbedMounted(true);
    }
    return embedLoading.current.promise;
  }

  function onEmbedMessage(msg: EmbedMessage) {
    if (msg.type === 'ready') {
      embedReady.current = true;
      embedLoading.current?.resolve();
      return;
    }
    if (msg.type === 'unavailable') {
      if (!embedReady.current) embedLoading.current?.reject();
      return;
    }
    if (msg.type === 'state') embedState.current = msg.state;
    if (mode.current !== 'embed') return;
    const s = usePlayerStore.getState();
    if (msg.type === 'state') {
      if (msg.state === YT_STATE.PLAYING) {
        failures.current = 0;
        clearTimeout(autoplayCheck.current);
        s.onBuffering(false);
        if (!s.isPlaying) embed.current?.pause();
      } else if (msg.state === YT_STATE.BUFFERING) {
        s.onBuffering(true);
      } else if (msg.state === YT_STATE.PAUSED) {
        s.onBuffering(false);
      } else if (msg.state === YT_STATE.ENDED) {
        s.onEnded();
      }
    } else if (msg.type === 'error') {
      // 2: bad id, 5: HTML5 error, 100: removed/private, 101/150: embedding disabled by the owner.
      handleFailure();
    } else if (msg.type === 'progress') {
      const delta = msg.time - lastTime.current;
      lastTime.current = msg.time;
      s.onProgress(msg.time, msg.duration || 0, delta);
    }
  }

  // The WebView's process was killed (memory pressure): rebuild the player and resume.
  function onEmbedCrash() {
    embedReady.current = false;
    embedLoading.current = null;
    setEmbedKey((k) => k + 1);
    const song = usePlayerStore.getState().current();
    if (mode.current === 'embed' && song) playEmbed(song);
  }

  function playEmbed(song: QueueItem) {
    mode.current = 'embed';
    // Silence the proxy player and hand the lock screen back (it would control nothing).
    player.pause();
    try { player.clearLockScreenControls(); } catch { /* unsupported on this platform */ }
    const wantPlay = usePlayerStore.getState().isPlaying;
    if (wantPlay) usePlayerStore.getState().onBuffering(true);
    ensureEmbed()
      .then(() => {
        const s = usePlayerStore.getState();
        const p = embed.current;
        if (!p || s.current()?.uid !== song.uid || mode.current !== 'embed') return;
        p.setVolume(s.volume, s.muted);
        lastTime.current = 0;
        embedState.current = YT_STATE.UNSTARTED;
        if (s.isPlaying) {
          p.load(song.id);
          // Autoplay refused by the WebView: reflect reality in the UI.
          clearTimeout(autoplayCheck.current);
          autoplayCheck.current = setTimeout(() => {
            const state = embedState.current;
            if (mode.current === 'embed' && (state === YT_STATE.UNSTARTED || state === YT_STATE.CUED)) {
              usePlayerStore.getState().setPlaying(false);
              usePlayerStore.getState().onBuffering(false);
            }
          }, 6000);
        } else {
          p.cue(song.id);
        }
      })
      .catch(() => {
        usePlayerStore.getState().onBuffering(false);
        usePlayerStore.getState().setPlaying(false);
        toast('Lecture impossible pour le moment. Vérifie ta connexion.', { tone: 'error' });
      });
  }

  /* ---------------- proxy backend ---------------- */

  function playProxy(song: QueueItem) {
    mode.current = 'proxy';
    embed.current?.stop();
    player.replace({ uri: streamUrl(song.id) });
    if (usePlayerStore.getState().isPlaying) player.play();
    try {
      player.setActiveForLockScreen(true, {
        title: song.title,
        artist: song.artist,
        albumTitle: usePlayerStore.getState().context?.label ?? 'FEO',
        artworkUrl: coverUrl(song.id, 'lg'),
      });
    } catch { /* lock screen controls unsupported on this platform */ }
  }

  /* ---------------- store → output ---------------- */

  // Embed chosen recently (sticky) or the API already knows YouTube blocks it:
  // go straight to the embed.
  useEffect(() => {
    if (!CAN_EMBED) return;
    let alive = true;
    (async () => {
      let blocked = await loadEmbedPreference();
      if (!blocked) {
        const h = await fetch(healthUrl).then((r) => r.json() as Promise<{ youtubeBlockedUntil?: string | null }>).catch(() => null);
        if (h?.youtubeBlockedUntil) {
          preferEmbed();
          blocked = true;
        }
      }
      if (!alive || !blocked) return;
      // Switch the current song too, unless it is already playing fine.
      const song = usePlayerStore.getState().current();
      if (song && mode.current === 'proxy' && !player.playing) playEmbed(song);
    })();
    return () => { alive = false; };
  }, []);

  // New song → new source.
  useEffect(() => {
    if (!current) {
      player.pause();
      embed.current?.stop();
      return;
    }
    lastTime.current = 0;
    endedFor.current = null;
    if (CAN_EMBED && embedPreferred()) playEmbed(current);
    else playProxy(current);

    // Stall guard: a song that never starts is retried on the embed, then skipped.
    const uid = current.uid;
    const timer = setTimeout(() => {
      const s = usePlayerStore.getState();
      const song = s.current();
      if (song?.uid !== uid || !s.isPlaying || lastTime.current !== 0) return;
      if (mode.current === 'proxy' && fellBackFor.current !== uid) fallBackToEmbed(song);
      else handleFailure();
    }, STALL_MS);
    return () => clearTimeout(timer);
  }, [current?.uid]);

  // Proxy error (503 YOUTUBE_BLOCKED, 502 STREAM_FAILED…) → embed.
  useEffect(() => {
    const song = usePlayerStore.getState().current();
    if (!status.error || mode.current !== 'proxy' || !song || fellBackFor.current === song.uid) return;
    fallBackToEmbed(song);
  }, [status.error]);

  useEffect(() => {
    if (!current) return;
    if (mode.current === 'embed') {
      const p = embed.current;
      if (!p || !embedReady.current) return;
      const state = embedState.current;
      const active = state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING;
      if (isPlaying && !active) p.play();
      else if (!isPlaying && active) p.pause();
      return;
    }
    if (isPlaying && !status.playing) player.play();
    else if (!isPlaying && status.playing) player.pause();
  }, [isPlaying, current?.uid]);

  useEffect(() => {
    player.volume = muted ? 0 : volume;
    if (embedReady.current) embed.current?.setVolume(volume, muted);
  }, [volume, muted]);

  useEffect(() => {
    if (!seekRequest) return;
    lastTime.current = seekRequest.to;
    if (mode.current === 'embed') embed.current?.seek(seekRequest.to);
    else player.seekTo(seekRequest.to).catch(() => undefined);
  }, [seekRequest]);

  // Progress, buffering and end of track (proxy only; the embed reports its own).
  useEffect(() => {
    if (mode.current !== 'proxy') return;
    const s = usePlayerStore.getState();
    if (!s.current()) return;
    const delta = status.currentTime - lastTime.current;
    lastTime.current = status.currentTime;
    if (status.currentTime > 0) failures.current = 0;
    s.onProgress(status.currentTime, status.duration || 0, status.playing ? delta : 0);
    if (s.buffering !== (status.isBuffering && s.isPlaying)) s.onBuffering(status.isBuffering && s.isPlaying);
    if (status.didJustFinish && endedFor.current !== s.current()!.uid) {
      endedFor.current = s.current()!.uid;
      s.onEnded();
    }
  }, [status.currentTime, status.isBuffering, status.didJustFinish, status.playing]);

  // Warm up the next song's stream URL on the server so transitions are quick.
  useEffect(() => {
    if (!nextId || !isPlaying || mode.current === 'embed') return;
    const t = setTimeout(() => {
      fetch(streamUrl(nextId), { headers: { Range: 'bytes=0-1' } }).catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [nextId, isPlaying]);

  useEffect(() => () => clearTimeout(autoplayCheck.current), []);

  if (!CAN_EMBED || !embedMounted) return null;
  return <YouTubeEmbed key={embedKey} ref={embed} onMessage={onEmbedMessage} onCrash={onEmbedCrash} />;
}
