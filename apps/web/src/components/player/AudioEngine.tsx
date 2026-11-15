import { useEffect, useRef } from 'react';
import { coverUrl, healthUrl, streamUrl } from '../../lib/api';
import { usePlayerStore, type QueueItem } from '../../stores/player';
import { toast } from '../../stores/ui';
import { YT_STATE, createEmbedPlayer, embedPreferred, preferEmbed, type YTPlayer } from './youtubeEmbed';

type Mode = 'proxy' | 'embed';

/**
 * The only audio output of the app. It mirrors the player store: the store
 * says what *should* happen, the engine makes the browser do it.
 *
 * Two backends:
 * - `proxy`: an <audio> element reading the API's /stream proxy (background
 *   playback, lock-screen controls, no ads);
 * - `embed`: the official YouTube player, invisible, used when the proxy
 *   cannot reach YouTube (the API's host gets bot-checked). It plays from the
 *   listener's own connection, so it keeps working whatever happens server-side.
 */
export function AudioEngine() {
  const audio = useRef<HTMLAudioElement>(null);
  const embedHost = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const ytLoading = useRef<Promise<YTPlayer> | null>(null);
  const mode = useRef<Mode>(embedPreferred() ? 'embed' : 'proxy');
  const lastTime = useRef(0);
  const failures = useRef(0);
  const autoplayCheck = useRef<ReturnType<typeof setTimeout>>(undefined);

  const current = usePlayerStore((s) => s.queue[s.index] ?? null);
  const nextId = usePlayerStore((s) => s.queue[s.index + 1]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const seekRequest = usePlayerStore((s) => s.seekRequest);

  /* ---------------- shared failure handling ---------------- */

  const failCurrent = () => {
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
  };

  /* ---------------- YouTube embed backend ---------------- */

  const ensureYt = (): Promise<YTPlayer> => {
    if (yt.current) return Promise.resolve(yt.current);
    if (!ytLoading.current) {
      ytLoading.current = createEmbedPlayer(embedHost.current!, {
        onStateChange: (state) => {
          if (mode.current !== 'embed') return;
          const s = usePlayerStore.getState();
          if (state === YT_STATE.PLAYING) {
            failures.current = 0;
            clearTimeout(autoplayCheck.current);
            s.onBuffering(false);
            if (!s.isPlaying) yt.current?.pauseVideo();
          } else if (state === YT_STATE.BUFFERING) {
            s.onBuffering(true);
          } else if (state === YT_STATE.PAUSED) {
            s.onBuffering(false);
          } else if (state === YT_STATE.ENDED) {
            s.onEnded();
          }
        },
        // 2: bad id, 5: HTML5 error, 100: removed/private, 101/150: embedding disabled by the owner.
        onError: () => {
          if (mode.current === 'embed') failCurrent();
        },
      }).then((p) => {
        yt.current = p;
        return p;
      });
      ytLoading.current.catch(() => {
        ytLoading.current = null;
      });
    }
    return ytLoading.current;
  };

  const playEmbed = (song: QueueItem) => {
    mode.current = 'embed';
    const el = audio.current;
    if (el?.getAttribute('src')) {
      el.removeAttribute('src');
      el.load();
    }
    const wantPlay = usePlayerStore.getState().isPlaying;
    if (wantPlay) usePlayerStore.getState().onBuffering(true);
    ensureYt()
      .then((p) => {
        const s = usePlayerStore.getState();
        if (s.current()?.uid !== song.uid || mode.current !== 'embed') return;
        p.setVolume(Math.round(s.volume * 100));
        if (s.muted) p.mute(); else p.unMute();
        lastTime.current = 0;
        if (s.isPlaying) {
          p.loadVideoById(song.id);
          // Autoplay blocked (no recent user gesture): reflect reality in the UI.
          clearTimeout(autoplayCheck.current);
          autoplayCheck.current = setTimeout(() => {
            const state = p.getPlayerState();
            if (mode.current === 'embed' && (state === YT_STATE.UNSTARTED || state === YT_STATE.CUED)) {
              usePlayerStore.getState().setPlaying(false);
              usePlayerStore.getState().onBuffering(false);
            }
          }, 6000);
        } else {
          p.cueVideoById(song.id);
        }
      })
      .catch(() => {
        usePlayerStore.getState().onBuffering(false);
        usePlayerStore.getState().setPlaying(false);
        toast('Lecture impossible pour le moment. Vérifie ta connexion.', { tone: 'error' });
      });
  };

  const playProxy = (song: QueueItem) => {
    mode.current = 'proxy';
    yt.current?.stopVideo();
    const el = audio.current;
    if (!el) return;
    el.src = streamUrl(song.id);
    if (usePlayerStore.getState().isPlaying) {
      el.play().catch(() => { /* handled by the error/pause listeners */ });
    }
  };

  /* ---------------- store → output ---------------- */

  // If the API already knows YouTube is blocking it, go straight to the embed.
  useEffect(() => {
    if (mode.current === 'embed') return;
    fetch(healthUrl)
      .then((r) => r.json())
      .then((h: { youtubeBlockedUntil?: string | null }) => {
        if (!h.youtubeBlockedUntil) return;
        preferEmbed();
        const s = usePlayerStore.getState();
        const song = s.current();
        const el = audio.current;
        // Switch the current song too, unless it is already playing fine.
        if (song && mode.current === 'proxy' && (!el || el.paused || el.error)) playEmbed(song);
        else mode.current = 'embed';
      })
      .catch(() => undefined);
  }, []);

  // New song → new source.
  useEffect(() => {
    const el = audio.current;
    if (!current) {
      el?.removeAttribute('src');
      el?.load();
      yt.current?.stopVideo();
      document.title = 'FEO — Henoy ara';
      return;
    }
    lastTime.current = 0;
    if (mode.current === 'embed' || embedPreferred()) playEmbed(current);
    else playProxy(current);
    document.title = `${current.title} · ${current.artist} — FEO`;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: usePlayerStore.getState().context?.label ?? 'FEO',
        artwork: [
          { src: coverUrl(current.id), sizes: '320x180', type: 'image/jpeg' },
          { src: coverUrl(current.id, 'lg'), sizes: '1280x720', type: 'image/jpeg' },
        ],
      });
    }
  }, [current?.uid]);

  // Play / pause.
  useEffect(() => {
    if (!current) return;
    if (mode.current === 'embed') {
      const p = yt.current;
      if (p) {
        const state = p.getPlayerState();
        if (isPlaying && state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) p.playVideo();
        else if (!isPlaying && (state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING)) p.pauseVideo();
      }
    } else {
      const el = audio.current;
      if (!el) return;
      if (isPlaying && el.paused) {
        el.play().catch((err: DOMException) => {
          // Autoplay blocked (no user gesture yet): reflect reality in the UI.
          if (err.name === 'NotAllowedError') usePlayerStore.getState().setPlaying(false);
        });
      } else if (!isPlaying && !el.paused) {
        el.pause();
      }
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, current?.uid]);

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
    if (yt.current) {
      yt.current.setVolume(Math.round(volume * 100));
      if (muted) yt.current.mute(); else yt.current.unMute();
    }
  }, [volume, muted]);

  useEffect(() => {
    if (!seekRequest) return;
    if (mode.current === 'embed') yt.current?.seekTo(seekRequest.to, true);
    else if (audio.current) audio.current.currentTime = seekRequest.to;
    lastTime.current = seekRequest.to;
  }, [seekRequest]);

  // The embed has no timeupdate event: poll its position.
  useEffect(() => {
    const t = setInterval(() => {
      const p = yt.current;
      if (mode.current !== 'embed' || !p || p.getPlayerState() !== YT_STATE.PLAYING) return;
      const time = p.getCurrentTime();
      const duration = p.getDuration();
      const delta = time - lastTime.current;
      lastTime.current = time;
      usePlayerStore.getState().onProgress(time, duration, delta);
      if ('mediaSession' in navigator && duration > 0) {
        try { navigator.mediaSession.setPositionState({ duration, position: Math.min(time, duration), playbackRate: 1 }); } catch { /* ignore */ }
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Warm up the next song's stream URL (yt-dlp lookup) so transitions are instant.
  useEffect(() => {
    if (!nextId || !isPlaying || mode.current === 'embed') return;
    const t = setTimeout(() => {
      fetch(streamUrl(nextId), { headers: { Range: 'bytes=0-1' } }).then((r) => r.body?.cancel()).catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [nextId, isPlaying]);

  // OS / headset / lock-screen controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const p = () => usePlayerStore.getState();
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => p().setPlaying(true)],
      ['pause', () => p().setPlaying(false)],
      ['previoustrack', () => p().previous()],
      ['nexttrack', () => p().next()],
      ['seekto', (d) => d.seekTime !== undefined && p().seek(d.seekTime)],
      ['seekbackward', () => p().seek(Math.max(0, p().position - 10))],
      ['seekforward', () => p().seek(p().position + 10)],
    ];
    for (const [action, fn] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported action */ }
    }
  }, []);

  return (
    <>
      <audio
        ref={audio}
        preload="auto"
        onTimeUpdate={(e) => {
          if (mode.current !== 'proxy') return;
          const el = e.currentTarget;
          const delta = el.currentTime - lastTime.current;
          lastTime.current = el.currentTime;
          usePlayerStore.getState().onProgress(el.currentTime, Number.isFinite(el.duration) ? el.duration : 0, el.paused ? 0 : delta);
          if ('mediaSession' in navigator && Number.isFinite(el.duration) && el.duration > 0) {
            try { navigator.mediaSession.setPositionState({ duration: el.duration, position: Math.min(el.currentTime, el.duration), playbackRate: 1 }); } catch { /* ignore */ }
          }
        }}
        onWaiting={() => mode.current === 'proxy' && usePlayerStore.getState().onBuffering(true)}
        onPlaying={() => { failures.current = 0; usePlayerStore.getState().onBuffering(false); }}
        onCanPlay={() => mode.current === 'proxy' && usePlayerStore.getState().onBuffering(false)}
        onPause={(e) => {
          // Paused by the system (headphones unplugged, OS media key…): sync the store.
          if (mode.current === 'proxy' && !e.currentTarget.ended && usePlayerStore.getState().isPlaying && e.currentTarget.readyState > 2) {
            usePlayerStore.getState().setPlaying(false);
          }
        }}
        onEnded={() => mode.current === 'proxy' && usePlayerStore.getState().onEnded()}
        onError={(e) => {
          if (mode.current !== 'proxy' || !e.currentTarget.getAttribute('src')) return;
          const song = usePlayerStore.getState().current();
          if (!song) return;
          // The API could not get this song from YouTube (usually a bot check on
          // the server's IP): play it with the YouTube player instead.
          preferEmbed();
          playEmbed(song);
        }}
      />
      <div
        ref={embedHost}
        aria-hidden
        style={{ position: 'fixed', right: 0, bottom: 0, width: 200, height: 200, opacity: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}
      />
    </>
  );
}
