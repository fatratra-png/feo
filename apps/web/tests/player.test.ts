import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordPlay = vi.fn();
const radio = vi.fn();
vi.mock('../src/lib/api', () => ({ api: { recordPlay: (...a: unknown[]) => recordPlay(...a), radio: (...a: unknown[]) => radio(...a) } }));

const { usePlayerStore } = await import('../src/stores/player');
const { pickAccent } = await import('../src/lib/color');

const song = (n: number, duration = 200) => ({ id: `id${String(n).padStart(9, '0')}`, title: `Song ${n}`, artist: `Artist ${n}`, duration });
const songs = Array.from({ length: 6 }, (_, i) => song(i));
const s = () => usePlayerStore.getState();

beforeEach(() => {
  recordPlay.mockReset();
  radio.mockReset().mockResolvedValue({ songs: [song(100), song(101)], source: 'mix' });
  usePlayerStore.setState({ queue: [], index: -1, isPlaying: false, position: 0, shuffle: false, repeat: 'off', radio: false, radioLoading: false, context: null });
});

describe('queue basics', () => {
  it('plays a list from the clicked index', () => {
    s().playSongs(songs, 2, { label: 'Test' });
    expect(s().current()?.title).toBe('Song 2');
    expect(s().isPlaying).toBe(true);
    expect(s().context?.label).toBe('Test');
  });

  it('previous restarts the song after 3 seconds, otherwise goes back', () => {
    s().playSongs(songs, 2);
    usePlayerStore.setState({ position: 10 });
    s().previous();
    expect(s().index).toBe(2);
    expect(s().seekRequest?.to).toBe(0);
    usePlayerStore.setState({ position: 1 });
    s().previous();
    expect(s().index).toBe(1);
  });

  it('stops at the end of the queue unless repeat-all', () => {
    s().playSongs(songs, 5);
    s().next();
    expect(s().isPlaying).toBe(false);
    s().cycleRepeat(); // → all
    s().setPlaying(true);
    s().next();
    expect(s().index).toBe(0);
  });

  it('repeat-one replays the same song when it ends', () => {
    s().playSongs(songs, 1);
    usePlayerStore.setState({ repeat: 'one' });
    s().onEnded();
    expect(s().index).toBe(1);
    expect(s().seekRequest?.to).toBe(0);
  });

  it('playNext inserts right after the current song', () => {
    s().playSongs(songs, 0);
    s().playNext(song(42));
    expect(s().queue[1].title).toBe('Song 42');
  });

  it('move keeps the current song selected', () => {
    s().playSongs(songs, 2);
    s().move(2, 4);
    expect(s().current()?.title).toBe('Song 2');
    expect(s().index).toBe(4);
  });

  it('shuffle only reorders upcoming songs and keeps history', () => {
    s().playSongs(songs, 2);
    s().toggleShuffle();
    expect(s().queue.slice(0, 3).map((q) => q.title)).toEqual(['Song 0', 'Song 1', 'Song 2']);
    expect(new Set(s().queue.slice(3).map((q) => q.title))).toEqual(new Set(['Song 3', 'Song 4', 'Song 5']));
  });
});

describe('listening signals', () => {
  it('reports a skip when the user skips early', () => {
    s().playSongs(songs, 0);
    s().onProgress(1, 200, 0);
    for (let i = 0; i < 8; i++) s().onProgress(1 + i, 200, 1);
    s().next(true);
    expect(recordPlay).toHaveBeenCalledOnce();
    const [played, secs, completed, skipped] = recordPlay.mock.calls[0];
    expect(played.title).toBe('Song 0');
    expect(secs).toBeGreaterThanOrEqual(8);
    expect(completed).toBe(false);
    expect(skipped).toBe(true);
  });

  it('reports a completed listen when the song ends', () => {
    s().playSongs([song(1, 10), song(2)], 0);
    for (let i = 0; i < 10; i++) s().onProgress(i, 10, 1);
    s().onEnded();
    expect(recordPlay.mock.calls[0].slice(2)).toEqual([true, false]);
  });

  it('ignores seeks when measuring listening time', () => {
    s().playSongs(songs, 0);
    s().onProgress(150, 200, 150); // a jump, not listening
    s().next(true);
    // The immediate skip is still a (negative) signal, but the seek adds no listening time.
    expect(recordPlay).toHaveBeenCalledOnce();
    expect(recordPlay.mock.calls[0][1]).toBe(0);
    expect(recordPlay.mock.calls[0][3]).toBe(true);
  });
});

describe('AI radio', () => {
  it('extends the queue when it runs low, without duplicates', async () => {
    usePlayerStore.setState({ radio: true });
    s().playSongs([song(1), song(2)], 0);
    await vi.waitFor(() => expect(s().queue.length).toBe(4));
    expect(radio).toHaveBeenCalledOnce();
    const [seeds, exclude, smart] = radio.mock.calls[0];
    expect(seeds[0].title).toBe('Song 1');
    expect(exclude).toContain(song(2).id);
    expect(smart).toBe(true); // one song left → time for the AI
  });

  it('asks for a fast mix when nothing is left to play', async () => {
    usePlayerStore.setState({ radio: true });
    s().playSongs([song(1)], 0);
    await vi.waitFor(() => expect(radio).toHaveBeenCalled());
    expect(radio.mock.calls[0][2]).toBe(false);
  });
});

describe('pickAccent', () => {
  const pixels = (rgb: [number, number, number], n = 400) => {
    const d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) d.set([...rgb, 255], i * 4);
    return d;
  };
  it('returns a readable accent for a vivid cover', () => {
    const c = pickAccent(pixels([200, 30, 40]));
    expect(c?.accent).toMatch(/^hsl\(\d+ \d+% (5[89]|6\d)%\)$/);
  });
  it('returns null for a grey cover (falls back to the default accent)', () => {
    expect(pickAccent(pixels([90, 90, 90]))).toBeNull();
  });
});
