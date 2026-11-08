import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef } from 'react';
import { coverUrl, streamUrl } from '../lib/api';
import { usePlayerStore } from '../stores/player';
import { toast } from '../stores/ui';

/** If a song shows no progress for this long after starting, it is skipped. */
const STALL_MS = 25_000;

/**
 * The single audio player of the app. It mirrors the player store: the store
 * says what should happen, the engine makes expo-audio do it.
 */
export function AudioEngine() {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const lastTime = useRef(0);
  const failures = useRef(0);
  const endedFor = useRef<string | null>(null);

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

  // New song → new source + lock-screen metadata.
  useEffect(() => {
    if (!current) {
      player.pause();
      return;
    }
    lastTime.current = 0;
    endedFor.current = null;
    player.replace({ uri: streamUrl(current.id) });
    if (usePlayerStore.getState().isPlaying) player.play();
    try {
      player.setActiveForLockScreen(true, {
        title: current.title,
        artist: current.artist,
        albumTitle: usePlayerStore.getState().context?.label ?? 'FEO',
        artworkUrl: coverUrl(current.id, 'lg'),
      });
    } catch { /* lock screen controls unsupported on this platform */ }

    // Stall guard: a stream that never starts is skipped instead of hanging.
    const uid = current.uid;
    const timer = setTimeout(() => {
      const s = usePlayerStore.getState();
      if (s.current()?.uid === uid && s.isPlaying && lastTime.current === 0) handleFailure();
    }, STALL_MS);
    return () => clearTimeout(timer);
  }, [current?.uid]);

  useEffect(() => {
    if (!current) return;
    if (isPlaying && !status.playing) player.play();
    else if (!isPlaying && status.playing) player.pause();
  }, [isPlaying, current?.uid]);

  useEffect(() => {
    player.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (seekRequest) {
      lastTime.current = seekRequest.to;
      player.seekTo(seekRequest.to).catch(() => undefined);
    }
  }, [seekRequest]);

  // Progress, buffering and end of track.
  useEffect(() => {
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
    if (!nextId || !isPlaying) return;
    const t = setTimeout(() => {
      fetch(streamUrl(nextId), { headers: { Range: 'bytes=0-1' } }).catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [nextId, isPlaying]);

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

  return null;
}
