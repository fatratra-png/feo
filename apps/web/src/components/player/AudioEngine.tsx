import { useEffect, useRef } from 'react';
import { coverUrl, streamUrl } from '../../lib/api';
import { usePlayerStore } from '../../stores/player';
import { toast } from '../../stores/ui';

/**
 * The only <audio> element of the app. It mirrors the player store:
 * the store says what *should* happen, the engine makes the browser do it.
 */
export function AudioEngine() {
  const audio = useRef<HTMLAudioElement>(null);
  const lastTime = useRef(0);
  const failures = useRef(0);

  const current = usePlayerStore((s) => s.queue[s.index] ?? null);
  const nextId = usePlayerStore((s) => s.queue[s.index + 1]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const seekRequest = usePlayerStore((s) => s.seekRequest);

  // New song → new source.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (!current) {
      el.removeAttribute('src');
      el.load();
      document.title = 'FEO — Henoy ara';
      return;
    }
    lastTime.current = 0;
    el.src = streamUrl(current.id);
    if (usePlayerStore.getState().isPlaying) {
      el.play().catch(() => { /* handled by the error/pause listeners */ });
    }
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
    const el = audio.current;
    if (!el || !current) return;
    if (isPlaying && el.paused) {
      el.play().catch((err: DOMException) => {
        // Autoplay blocked (no user gesture yet): reflect reality in the UI.
        if (err.name === 'NotAllowedError') usePlayerStore.getState().setPlaying(false);
      });
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, current?.uid]);

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume;
      audio.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (audio.current && seekRequest) {
      audio.current.currentTime = seekRequest.to;
      lastTime.current = seekRequest.to;
    }
  }, [seekRequest]);

  // Warm up the next song's stream URL (yt-dlp lookup) so transitions are instant.
  useEffect(() => {
    if (!nextId || !isPlaying) return;
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
    <audio
      ref={audio}
      preload="auto"
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        const delta = el.currentTime - lastTime.current;
        lastTime.current = el.currentTime;
        usePlayerStore.getState().onProgress(el.currentTime, Number.isFinite(el.duration) ? el.duration : 0, el.paused ? 0 : delta);
        if ('mediaSession' in navigator && Number.isFinite(el.duration) && el.duration > 0) {
          try { navigator.mediaSession.setPositionState({ duration: el.duration, position: Math.min(el.currentTime, el.duration), playbackRate: 1 }); } catch { /* ignore */ }
        }
      }}
      onWaiting={() => usePlayerStore.getState().onBuffering(true)}
      onPlaying={() => { failures.current = 0; usePlayerStore.getState().onBuffering(false); }}
      onCanPlay={() => usePlayerStore.getState().onBuffering(false)}
      onPause={(e) => {
        // Paused by the system (headphones unplugged, OS media key…): sync the store.
        if (!e.currentTarget.ended && usePlayerStore.getState().isPlaying && e.currentTarget.readyState > 2) {
          usePlayerStore.getState().setPlaying(false);
        }
      }}
      onEnded={() => usePlayerStore.getState().onEnded()}
      onError={() => {
        const s = usePlayerStore.getState();
        if (!s.current()) return;
        failures.current += 1;
        if (failures.current >= 3) {
          s.setPlaying(false);
          s.onBuffering(false);
          toast('Lecture impossible pour le moment. Vérifie ta connexion.', { tone: 'error' });
          return;
        }
        toast(`« ${s.current()!.title} » est indisponible, titre suivant`, { tone: 'error' });
        s.next(false);
      }}
    />
  );
}
