import { useQuery } from '@tanstack/react-query';
import { Clock, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SectionTitle } from '../components/layout/CollectionHeader';
import { LikeButton, SongMenu } from '../components/song/SongActions';
import { SongList } from '../components/song/SongList';
import { Button, PlayButton } from '../components/ui/Button';
import { Cover } from '../components/ui/Cover';
import { EmptyState, ErrorState, SongListSkeleton } from '../components/ui/Feedback';
import { ApiError, api } from '../lib/api';
import { cn } from '../lib/format';
import type { Song } from '../lib/types';
import { usePlayerStore } from '../stores/player';

const GENRES: { label: string; q: string; from: string; to: string }[] = [
  { label: 'Gasy', q: 'musique malagasy hits', from: '#e8504f', to: '#7a1f3d' },
  { label: 'Afrobeats', q: 'afrobeats hits', from: '#f59e0b', to: '#9a3412' },
  { label: 'Hip-hop', q: 'hip hop hits', from: '#6366f1', to: '#1e1b4b' },
  { label: 'R&B', q: 'rnb soul hits', from: '#ec4899', to: '#581c87' },
  { label: 'Pop', q: 'pop hits official audio', from: '#22d3ee', to: '#1e3a8a' },
  { label: 'Amapiano', q: 'amapiano hits', from: '#10b981', to: '#064e3b' },
  { label: 'Chill', q: 'chill lofi beats', from: '#8b5cf6', to: '#312e81' },
  { label: 'Gospel', q: 'gospel malagasy', from: '#facc15', to: '#854d0e' },
  { label: 'Rock', q: 'rock classics', from: '#ef4444', to: '#3f0d0d' },
  { label: 'Jazz', q: 'jazz classics', from: '#0ea5e9', to: '#0c4a6e' },
  { label: 'Zouk & Kompa', q: 'zouk kompa hits', from: '#f97316', to: '#7c2d12' },
  { label: 'Électro', q: 'electronic dance hits', from: '#a3e635', to: '#365314' },
];

const HISTORY_KEY = 'feo_recent_searches';
const readHistory = (): string[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } };
const saveHistory = (q: string) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...readHistory().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8))); } catch { /* ignore */ }
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Natural-language queries ("la chanson qui…") are better served by the AI. */
const looksLikeDescription = (q: string) => q.trim().split(/\s+/).length >= 5 || /\b(qui|comme|chanson|musique pour|ambiance|années)\b/i.test(q);

function TopResult({ song, onPlay }: { song: Song; onPlay: () => void }) {
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const active = currentId === song.id;
  return (
    <div className="group relative flex flex-1 flex-col gap-4 rounded-2xl bg-fg/[0.05] p-5 transition-colors hover:bg-fg/[0.08]">
      <Cover id={song.id} className="size-24" rounded="rounded-xl" />
      <div className="min-w-0">
        <p className="line-clamp-2 font-display text-2xl font-bold">{song.title}</p>
        <p className="mt-1 truncate text-sm text-fg-2">{song.artist}</p>
      </div>
      <div className="mt-auto flex items-center gap-1">
        <LikeButton song={song} />
        <SongMenu song={song} />
      </div>
      <PlayButton playing={active && isPlaying} onClick={onPlay} className="absolute right-5 bottom-5" />
    </div>
  );
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mode = params.get('ai') === '1' ? 'ai' : 'classic';
  const [input, setInput] = useState(q);
  const debounced = useDebounced(input.trim(), 450);
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(readHistory);

  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    if (mode === 'classic' && debounced !== q) setParams(debounced ? { q: debounced } : {}, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const classic = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: mode === 'classic' && q.length > 0,
    staleTime: 10 * 60_000,
  });

  const ai = useQuery({
    queryKey: ['smart-search', q],
    queryFn: async () => {
      try {
        return { ...(await api.smartSearch(q)), fallback: false };
      } catch (err) {
        // AI unavailable or quota reached: fall back to a classic search, and say so.
        if (err instanceof ApiError && (err.status === 503 || err.status === 429)) {
          const res = await api.search(q);
          return { interpretation: '', songs: res.songs, model: '', fallback: true, reason: err.message };
        }
        throw err;
      }
    },
    enabled: mode === 'ai' && q.length >= 3,
    staleTime: 30 * 60_000,
    retry: false,
  });

  const active = mode === 'ai' ? ai : classic;
  const songs = active.data?.songs ?? [];
  useEffect(() => {
    if (q && songs.length) { saveHistory(q); setHistory(readHistory()); }
  }, [q, songs.length]);

  const runAi = () => {
    const text = input.trim();
    if (text.length < 3) return inputRef.current?.focus();
    setParams({ q: text, ai: '1' });
  };

  const context = useMemo(() => ({ label: `Recherche « ${q} »`, href: `/search?q=${encodeURIComponent(q)}${mode === 'ai' ? '&ai=1' : ''}` }), [q, mode]);
  const playAt = (i: number) => usePlayerStore.getState().playSongs(songs, i, context);
  const aiData = ai.data as (typeof ai.data & { reason?: string }) | undefined;

  return (
    <div className="animate-fade-in px-4 pt-2 sm:px-8">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); mode === 'ai' || looksLikeDescription(input) ? runAi() : setParams(input.trim() ? { q: input.trim() } : {}); }}
        className="sticky top-16 z-10 -mx-4 bg-gradient-to-b from-bg via-bg/95 to-transparent px-4 pt-1 pb-4 sm:-mx-8 sm:px-8 md:from-[#0c0c11] md:via-[#0c0c11]/95"
      >
        <div className={cn('flex items-center gap-2 rounded-full border bg-surface-2 p-1.5 pl-4 transition', mode === 'ai' ? 'border-accent/70' : 'border-line-strong focus-within:border-fg-3')}>
          {mode === 'ai' ? <Sparkles className="size-5 shrink-0 text-accent-fg" aria-hidden /> : <SearchIcon className="size-5 shrink-0 text-fg-3" aria-hidden />}
          <label htmlFor="search-input" className="sr-only">Rechercher</label>
          <input
            id="search-input"
            ref={inputRef}
            value={input}
            autoFocus={!q}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'ai' ? 'Décris la chanson ou l’ambiance… ex. « le tube de l’été 2010 qui fait waka waka »' : 'Titres, artistes…'}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-3"
          />
          {input && (
            <button type="button" aria-label="Effacer" onClick={() => { setInput(''); setParams({}); inputRef.current?.focus(); }} className="grid size-9 place-items-center rounded-full text-fg-3 hover:bg-fg/8 hover:text-fg">
              <X className="size-4" />
            </button>
          )}
          <Button
            type="button"
            variant={mode === 'ai' ? 'primary' : 'secondary'}
            size="sm"
            className="!h-11"
            icon={<Sparkles className="size-4" />}
            onClick={() => (mode === 'ai' ? setParams(input.trim() ? { q: input.trim() } : {}) : runAi())}
            aria-pressed={mode === 'ai'}
          >
            <span className="hidden sm:inline">{mode === 'ai' ? 'Recherche IA' : 'Demander à l’IA'}</span>
            <span className="sm:hidden">IA</span>
          </Button>
        </div>
        {mode === 'classic' && input.trim() && looksLikeDescription(input) && (
          <p className="mt-2 px-4 text-xs text-fg-2">
            Ça ressemble à une description. <button type="button" onClick={runAi} className="font-semibold text-accent-fg hover:underline">Demander à l’IA</button> de trouver la chanson ?
          </p>
        )}
      </form>

      {!q ? (
        <div className="space-y-10 pb-6">
          {history.length > 0 && (
            <section>
              <SectionTitle
                title="Recherches récentes"
                action={<Button variant="ghost" size="sm" onClick={() => { try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ } setHistory([]); }}>Effacer</Button>}
              />
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button key={h} onClick={() => setParams({ q: h })} className="inline-flex items-center gap-2 rounded-full bg-fg/[0.06] px-4 py-2 text-sm font-medium hover:bg-fg/[0.1]">
                    <Clock className="size-3.5 text-fg-3" aria-hidden /> {h}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionTitle title="Parcourir" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {GENRES.map((g) => (
                <button
                  key={g.label}
                  onClick={() => setParams({ q: g.q })}
                  className="relative h-28 overflow-hidden rounded-2xl p-4 text-left font-display text-xl font-bold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                >
                  {g.label}
                  <span className="absolute -right-4 -bottom-6 size-20 rotate-12 rounded-xl bg-fg/15" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : active.isLoading ? (
        <div className="pt-2">
          {mode === 'ai' && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-fg/[0.06] px-4 py-2 text-sm text-fg-2">
              <Sparkles className="size-4 animate-pulse text-accent-fg" aria-hidden /> L'IA réfléchit à ta description…
            </p>
          )}
          <SongListSkeleton />
        </div>
      ) : active.error ? (
        <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} />
      ) : songs.length === 0 ? (
        <EmptyState icon={<SearchIcon />} title={`Aucun résultat pour « ${q} »`} action={mode === 'classic' ? <Button variant="primary" icon={<Sparkles className="size-4" />} onClick={runAi}>Demander à l'IA</Button> : undefined}>
          Vérifie l'orthographe ou décris la chanson autrement.
        </EmptyState>
      ) : (
        <div className="space-y-8 pb-6">
          {mode === 'ai' && aiData && (
            aiData.fallback ? (
              <p className="rounded-2xl border border-line-strong bg-fg/[0.04] p-4 text-sm text-fg-2">
                {aiData.reason ?? 'L’IA est indisponible'} — voici les résultats d’une recherche classique.
              </p>
            ) : aiData.interpretation ? (
              <div className="flex gap-3 rounded-2xl border border-accent/30 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] p-4">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-fg" aria-hidden />
                <div>
                  <p className="text-xs font-bold tracking-wide text-accent-fg uppercase">Ce que l'IA a compris</p>
                  <p className="mt-1 text-sm text-fg">{aiData.interpretation}</p>
                </div>
              </div>
            ) : null
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
            <section className="flex flex-col">
              <SectionTitle title="Meilleur résultat" />
              <TopResult song={songs[0]} onPlay={() => {
                const p = usePlayerStore.getState();
                p.queue[p.index]?.id === songs[0].id ? p.togglePlay() : playAt(0);
              }} />
            </section>
            <section className="min-w-0">
              <SectionTitle title="Titres" />
              <SongList songs={songs.slice(1, 5)} onPlay={(i) => playAt(i + 1)} showIndex={false} showReason={mode === 'ai'} />
            </section>
          </div>
          {songs.length > 5 && (
            <section>
              <SectionTitle title="Plus de résultats" />
              <SongList songs={songs.slice(5)} onPlay={(i) => playAt(i + 5)} showReason={mode === 'ai'} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
