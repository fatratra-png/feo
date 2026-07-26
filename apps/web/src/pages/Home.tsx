import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import { youtubeApi } from '../lib/api';
import { TrackCard } from '../components/ui/TrackCard';
import { AISuggestions } from '../components/AISuggestions';
import { DotGrid } from '../components/ui/DotGrid';
import { Search, Music } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

const SUGGESTIONS = ['pop hits 2024', 'hip hop vibes', 'jazz relax', 'rock classics', 'electronic dance', 'afrobeat', 'latin party', 'reggae chill'];

const PILL_COLORS = [
  { bg: 'bg-saffron/10', border: 'border-saffron/40', text: 'text-saffron' },
  { bg: 'bg-blush/10', border: 'border-blush/40', text: 'text-blush' },
  { bg: 'bg-mint/10', border: 'border-mint/40', text: 'text-mint' },
  { bg: 'bg-saffron/10', border: 'border-saffron/40', text: 'text-saffron' },
  { bg: 'bg-blush/10', border: 'border-blush/40', text: 'text-blush' },
  { bg: 'bg-mint/10', border: 'border-mint/40', text: 'text-mint' },
  { bg: 'bg-saffron/10', border: 'border-saffron/40', text: 'text-saffron' },
  { bg: 'bg-blush/10', border: 'border-blush/40', text: 'text-blush' },
];

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const debouncedQuery = useDebounce(query, 600);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => youtubeApi.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const searching = isLoading || isFetching;
  const hasQuery = query.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 sm:px-6 pt-16 sm:pt-20 pb-20 dot-grid">
      <DotGrid />
      <div className={`w-full flex flex-col items-center ${hasQuery ? 'max-w-6xl' : 'max-w-lg'}`}>
        <div className="w-full flex flex-col items-center max-w-lg">
          <div className="mb-8 sm:mb-10 text-center relative animate-fadeInUp">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-saffron via-blush to-mint rounded-full" />
            <h1 className="font-body font-black text-7xl sm:text-8xl md:text-9xl tracking-[-0.08em] leading-[0.85] text-white brutal-shadow-ink inline-block px-4 py-1 -rotate-1 hover:rotate-0 transition-all duration-500 hover-glow">
              F<span className="text-white/80">E</span><span className="text-white/60">O</span><span className="text-white/40">.</span>
            </h1>
            <p className="mt-3 font-mono text-[9px] sm:text-[10px] tracking-[0.3em] text-foreground/25 uppercase animate-fadeInUp" style={{ animationDelay: '0.2s' }}>Henoy ara</p>
          </div>

          <div className={`relative w-full mb-6 animate-fadeInUp ${isSearchFocused ? 'animate-bounce-subtle' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-saffron/15 via-blush/15 to-mint/15 rounded-full blur-sm transition-all duration-300" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-foreground/20 pointer-events-none z-10" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search millions of songs..."
              className="relative w-full rounded-full border-2 border-border bg-card pl-11 pr-12 py-3 text-sm sm:text-base font-display font-bold tracking-tight placeholder:text-foreground/20 text-foreground outline-none focus:border-saffron focus:brutal-shadow-saffron transition-all duration-300"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono text-foreground/20 pointer-events-none hidden sm:block bg-muted/30 px-1.5 py-0.5 rounded border border-border">&#8984;K</span>
          </div>

          {!hasQuery && !searching && (
            <>
              <p className="font-mono text-[9px] text-foreground/30 uppercase tracking-[0.2em] mb-4 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>Try searching</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mb-6">
                {SUGGESTIONS.map((s, i) => {
                  const c = PILL_COLORS[i];
                  const rotation = i % 3 === 0 ? '-rotate-1' : i % 3 === 1 ? 'rotate-1' : 'rotate-0';
                  return (
                    <button
                      key={s}
                      onClick={() => setSearchParams({ q: s }, { replace: true })}
                      className={`rounded-full border-2 ${c.border} ${c.bg} ${c.text} px-3.5 py-1.5 sm:px-4 sm:py-2 text-[9px] font-mono font-semibold transition-all btn-press ${rotation} animate-fadeInUp hover:opacity-80`}
                      style={{ animationDelay: `${0.5 + i * 0.08}s` }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <AISuggestions />
            </>
          )}
        </div>

        {searching && (
          <div className="flex items-center gap-3 py-10 animate-fadeInUp">
            <span className="size-8 rounded-full border-2 border-border flex items-center justify-center brutal-shadow-sm bg-card">
              <span className="size-3.5 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
            </span>
            <p className="font-mono text-xs text-foreground/50">Searching worldwide...</p>
          </div>
        )}

        {data?.tracks?.length > 0 && (
          <div className="w-full mt-4 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-4">
              <span className="section-number brutal-shadow-saffron -rotate-1">01</span>
              <h2 className="font-display text-base font-extrabold tracking-[-0.02em]">Results</h2>
              <span className="chip text-[6px] bg-saffron/15 text-saffron border-saffron rotate-0.5">{data.tracks.length} tracks</span>
              <span className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-saffron via-blush to-mint" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {data.tracks.map((track: any, i: number) => (
                <div key={track.id} className="animate-fadeInUp" style={{ animationDelay: `${i * 40}ms` }}>
                  <TrackCard track={track} index={i} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!searching && hasQuery && data?.tracks?.length === 0 && (
          <div className="rounded-xl border-2 border-foreground bg-saffron text-black p-8 sm:p-10 text-center max-w-sm mx-auto -rotate-1 mt-8 brutal-shadow-ink animate-scaleIn">
            <p className="font-display text-xl sm:text-2xl font-extrabold">No Results</p>
            <p className="text-[10px] sm:text-xs font-mono mt-3 text-black/70">Try a different search term</p>
            <div className="mt-4 h-0.5 w-8 bg-black mx-auto rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}
