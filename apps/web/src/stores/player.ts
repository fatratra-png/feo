import { create } from 'zustand';
import { api } from '../lib/api';
import type { Song } from '../lib/types';

export interface QueueItem extends Song {
  /** Unique per queue entry, so the same song can appear twice. */
  uid: string;
  from: 'user' | 'radio';
}

export type Repeat = 'off' | 'all' | 'one';

export interface PlayContext {
  label: string;
  href?: string;
}

interface Listening {
  songId: string | null;
  seconds: number;
}

interface PlayerState {
  queue: QueueItem[];
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  buffering: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  radio: boolean;
  radioLoading: boolean;
  context: PlayContext | null;
  /** Bumped to ask the audio engine to seek. */
  seekRequest: { to: number; n: number } | null;
  nowPlayingOpen: boolean;
  nowPlayingTab: 'queue' | 'about';

  current: () => QueueItem | null;
  upcoming: () => QueueItem[];

  playSongs: (songs: Song[], startIndex?: number, context?: PlayContext | null) => void;
  playShuffled: (songs: Song[], context?: PlayContext | null) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  next: (userInitiated?: boolean) => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  seek: (to: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleRadio: () => void;
  addToQueue: (songs: Song[]) => void;
  playNext: (song: Song) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  clearUpcoming: () => void;
  openNowPlaying: (tab?: 'queue' | 'about') => void;
  closeNowPlaying: () => void;

  /* engine callbacks */
  onProgress: (position: number, duration: number, playingDelta: number) => void;
  onBuffering: (b: boolean) => void;
  onEnded: () => void;
}

let uidCounter = 0;
const toItem = (s: Song, from: QueueItem['from'] = 'user'): QueueItem => ({
  id: s.id, title: s.title, artist: s.artist, duration: s.duration, reason: s.reason,
  uid: `${s.id}-${++uidCounter}`, from,
});

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const read = <T,>(key: string, fallback: T, parse: (v: string) => T = (v) => v as T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : parse(v);
  } catch { return fallback; }
};
const write = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* ignore */ } };

/* -------- listening report: turns playback into taste signals -------- */
const listening: Listening = { songId: null, seconds: 0 };

/** Reports how the previous song ended, then starts measuring the new one. */
function reportAndReset(prev: QueueItem | null, reason: 'ended' | 'skip' | 'switch') {
  if (prev && listening.songId === prev.id) {
    const secs = listening.seconds;
    const dur = prev.duration || 0;
    const completed = reason === 'ended' || (dur > 0 && secs >= dur * 0.8);
    const skipped = reason === 'skip' && !completed && secs < Math.min(30, dur ? dur * 0.5 : 30);
    if (secs >= 5 || skipped) api.recordPlay(prev, secs, completed, skipped);
  }
  listening.songId = null;
  listening.seconds = 0;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  /** Switches to `index`, reporting the song we are leaving. */
  const goTo = (index: number, reason: 'ended' | 'skip' | 'switch', autoplay = true) => {
    const s = get();
    reportAndReset(s.current(), reason);
    set({ index, position: 0, duration: s.queue[index]?.duration || 0, isPlaying: autoplay, buffering: autoplay });
    void maybeExtendRadio();
  };

  /** Infinite radio: when the queue is about to run dry, ask the backend for more. */
  const maybeExtendRadio = async () => {
    const s = get();
    const cur = s.current();
    if (!s.radio || s.radioLoading || !cur || s.repeat === 'all') return;
    const remaining = s.queue.length - 1 - s.index;
    if (remaining >= 3) return;
    set({ radioLoading: true });
    try {
      const seeds = [cur, ...s.queue.slice(Math.max(0, s.index - 4), s.index).reverse()].slice(0, 4);
      const exclude = s.queue.map((q) => q.id);
      // Nothing left to play → fast YouTube mix now; otherwise there is time for the AI.
      const smart = remaining >= 1;
      const res = await api.radio(seeds, exclude, smart, 10);
      const known = new Set(get().queue.map((q) => q.id));
      const fresh = res.songs.filter((x) => !known.has(x.id)).map((x) => toItem(x, 'radio'));
      if (fresh.length) set({ queue: [...get().queue, ...fresh] });
    } catch {
      /* radio is best-effort */
    } finally {
      set({ radioLoading: false });
    }
  };

  return {
    queue: [],
    index: -1,
    isPlaying: false,
    position: 0,
    duration: 0,
    buffering: false,
    volume: read('feo_volume', 0.8, Number),
    muted: false,
    shuffle: read('feo_shuffle', false, (v) => v === '1'),
    repeat: read<Repeat>('feo_repeat', 'off'),
    radio: read('feo_radio', true, (v) => v === '1'),
    radioLoading: false,
    context: null,
    seekRequest: null,
    nowPlayingOpen: false,
    nowPlayingTab: 'queue',

    current: () => get().queue[get().index] ?? null,
    upcoming: () => get().queue.slice(get().index + 1),

    playSongs: (songs, startIndex = 0, context = null) => {
      if (!songs.length) return;
      const s = get();
      let items = songs.map((x) => toItem(x));
      let index = Math.min(Math.max(0, startIndex), items.length - 1);
      if (s.shuffle) {
        const first = items[index];
        items = [first, ...shuffled(items.filter((_, i) => i !== index))];
        index = 0;
      }
      reportAndReset(s.current(), 'switch');
      set({ queue: items, index, context, position: 0, duration: items[index].duration, isPlaying: true, buffering: true });
      void maybeExtendRadio();
    },

    playShuffled: (songs, context = null) => {
      if (!songs.length) return;
      write('feo_shuffle', '1');
      set({ shuffle: true });
      get().playSongs(songs, Math.floor(Math.random() * songs.length), context);
    },

    togglePlay: () => {
      const s = get();
      if (!s.current()) return;
      set({ isPlaying: !s.isPlaying });
    },
    setPlaying: (isPlaying) => set({ isPlaying }),

    next: (userInitiated = true) => {
      const s = get();
      if (s.index < s.queue.length - 1) return goTo(s.index + 1, userInitiated ? 'skip' : 'ended');
      if (s.repeat === 'all' && s.queue.length) return goTo(0, userInitiated ? 'skip' : 'ended');
      // End of queue: stop, but keep the last song loaded.
      reportAndReset(s.current(), userInitiated ? 'skip' : 'ended');
      set({ isPlaying: false, position: 0, seekRequest: { to: 0, n: Date.now() } });
      void maybeExtendRadio();
    },

    previous: () => {
      const s = get();
      // Like every player: past 3 seconds, "previous" restarts the song.
      if (s.position > 3 || s.index <= 0) {
        set({ seekRequest: { to: 0, n: Date.now() }, position: 0, isPlaying: true });
        return;
      }
      goTo(s.index - 1, 'switch');
    },

    jumpTo: (index) => {
      const s = get();
      if (index < 0 || index >= s.queue.length || index === s.index) return;
      goTo(index, 'skip');
    },

    seek: (to) => set({ seekRequest: { to, n: Date.now() }, position: to }),

    setVolume: (volume) => {
      const v = Math.min(1, Math.max(0, volume));
      write('feo_volume', String(v));
      set({ volume: v, muted: v === 0 });
    },
    toggleMute: () => set({ muted: !get().muted }),

    toggleShuffle: () => {
      const s = get();
      const shuffle = !s.shuffle;
      write('feo_shuffle', shuffle ? '1' : '0');
      if (shuffle && s.index >= 0) {
        // Shuffle only what is still to come; history stays intact.
        const head = s.queue.slice(0, s.index + 1);
        set({ shuffle, queue: [...head, ...shuffled(s.queue.slice(s.index + 1))] });
      } else {
        set({ shuffle });
      }
    },

    cycleRepeat: () => {
      const order: Repeat[] = ['off', 'all', 'one'];
      const repeat = order[(order.indexOf(get().repeat) + 1) % order.length];
      write('feo_repeat', repeat);
      set({ repeat });
    },

    toggleRadio: () => {
      const radio = !get().radio;
      write('feo_radio', radio ? '1' : '0');
      set({ radio });
      if (radio) void maybeExtendRadio();
    },

    addToQueue: (songs) => {
      const s = get();
      if (!s.current()) return get().playSongs(songs);
      set({ queue: [...s.queue, ...songs.map((x) => toItem(x))] });
    },

    playNext: (song) => {
      const s = get();
      if (!s.current()) return get().playSongs([song]);
      const q = [...s.queue];
      q.splice(s.index + 1, 0, toItem(song));
      set({ queue: q });
    },

    removeAt: (i) => {
      const s = get();
      if (i === s.index || i < 0 || i >= s.queue.length) return;
      const q = s.queue.filter((_, k) => k !== i);
      set({ queue: q, index: i < s.index ? s.index - 1 : s.index });
      void maybeExtendRadio();
    },

    move: (from, to) => {
      const s = get();
      if (from === to || from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return;
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      const cur = s.current();
      set({ queue: q, index: cur ? q.findIndex((x) => x.uid === cur.uid) : s.index });
    },

    clearUpcoming: () => {
      const s = get();
      set({ queue: s.queue.slice(0, s.index + 1) });
    },

    openNowPlaying: (tab) => set({ nowPlayingOpen: true, ...(tab ? { nowPlayingTab: tab } : {}) }),
    closeNowPlaying: () => set({ nowPlayingOpen: false }),

    onProgress: (position, duration, playingDelta) => {
      const cur = get().current();
      if (cur) {
        if (listening.songId !== cur.id) { listening.songId = cur.id; listening.seconds = 0; }
        // Only count real listening time, not seeks.
        if (playingDelta > 0 && playingDelta < 2) listening.seconds += playingDelta;
      }
      set({ position, duration: duration || get().duration });
    },
    onBuffering: (buffering) => set({ buffering }),
    onEnded: () => {
      const s = get();
      if (s.repeat === 'one') {
        reportAndReset(s.current(), 'ended');
        set({ seekRequest: { to: 0, n: Date.now() }, position: 0, isPlaying: true });
        return;
      }
      get().next(false);
    },
  };
});
