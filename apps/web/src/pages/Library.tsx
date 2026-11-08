import { useQuery } from '@tanstack/react-query';
import { Clock, Library as LibraryIcon, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreatePlaylistDialog } from '../components/layout/PlaylistDialogs';
import { CardGrid, LikedCard, PlaylistCard } from '../components/song/Cards';
import { SongList } from '../components/song/SongList';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, Skeleton, SongListSkeleton } from '../components/ui/Feedback';
import { usePlaylists, useLikedIds } from '../hooks/library';
import { api } from '../lib/api';
import { cn, relativeTime } from '../lib/format';
import type { PlaylistSummary } from '../lib/types';
import { usePlayerStore } from '../stores/player';
import { toast } from '../stores/ui';

const TABS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'history', label: 'Historique' },
] as const;

async function playPlaylist(pl: PlaylistSummary) {
  const p = usePlayerStore.getState();
  if (p.context?.label === pl.name) return p.togglePlay();
  try {
    const full = await api.playlists.get(pl.id);
    p.playSongs(full.songs, 0, { label: pl.name, href: `/playlist/${pl.id}` });
  } catch (err) {
    toast((err as Error).message, { tone: 'error' });
  }
}

function History() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['history'], queryFn: api.history });
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading) return <SongListSkeleton />;
  if (!data?.songs.length) return <EmptyState icon={<Clock />} title="Rien écouté pour l'instant">Tes écoutes apparaîtront ici.</EmptyState>;
  return (
    <SongList
      songs={data.songs}
      context={{ label: 'Écoutés récemment', href: '/library?tab=history' }}
      showIndex={false}
      meta={(s) => <span className="hidden lg:inline">{relativeTime((s as (typeof data.songs)[number]).playedAt)}</span>}
    />
  );
}

export function Library() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'playlists';
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { data: playlists, isLoading, error, refetch } = usePlaylists();
  const likedCount = useLikedIds().size;
  const ctxLabel = usePlayerStore((s) => s.context?.label);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <div className="animate-fade-in px-4 pt-2 pb-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Bibliothèque</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nouvelle</Button>
          <Button variant="primary" size="sm" icon={<Sparkles className="size-4" />} onClick={() => navigate('/create')}>Créer avec l'IA</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Sections de la bibliothèque" className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'playlists' ? {} : { tab: t.id }, { replace: true })}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors', tab === t.id ? 'bg-fg text-bg' : 'bg-fg/[0.07] text-fg hover:bg-fg/[0.12]')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'history' ? (
          <div className="-mx-2 sm:-mx-3"><History /></div>
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
          </div>
        ) : (
          <>
            <CardGrid>
              <LikedCard count={likedCount} />
              {playlists?.map((p) => (
                <PlaylistCard key={p.id} playlist={p} playing={ctxLabel === p.name && isPlaying} onPlay={() => playPlaylist(p)} />
              ))}
            </CardGrid>
            {playlists?.length === 0 && (
              <EmptyState icon={<LibraryIcon />} title="Aucune playlist pour l'instant" action={<Button variant="primary" icon={<Sparkles className="size-4" />} onClick={() => navigate('/create')}>Demander à l'IA</Button>}>
                Crée-en une toi-même, ou décris une ambiance et laisse l'IA la composer.
              </EmptyState>
            )}
          </>
        )}
      </div>
      <CreatePlaylistDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
