import { ListMusic, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/format';
import { usePlayerStore } from '../../stores/player';
import { LikeButton } from '../song/SongActions';
import { IconButton } from '../ui/Button';
import { Cover } from '../ui/Cover';
import { MiniProgress, PlayPauseButton, ProgressBar, RadioToggle, TransportControls, VolumeControl } from './Controls';

export function PlayerBar() {
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const context = usePlayerStore((s) => s.context);
  const open = usePlayerStore((s) => s.openNowPlaying);
  if (!song) return null;

  return (
    <>
      {/* Desktop */}
      <div role="region" aria-label="Lecteur" className="fixed inset-x-0 bottom-0 z-40 hidden h-[80px] grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 bg-bg px-4 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => open('about')} aria-label="Ouvrir le lecteur plein écran" className="group relative">
            <Cover id={song.id} className="size-14" rounded="rounded-md" />
            <span className="absolute inset-0 grid place-items-center rounded-lg bg-surface/80 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-4 text-fg" aria-hidden />
            </span>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{song.title}</p>
            <p className="truncate text-xs text-fg-2">
              {song.artist}
              {context && (
                <>
                  {' · '}
                  {context.href ? (
                    <Link to={context.href} className="hover:text-fg hover:underline">{context.label}</Link>
                  ) : (
                    context.label
                  )}
                </>
              )}
            </p>
          </div>
          <LikeButton song={song} />
        </div>

        <div className="flex flex-col items-center gap-1">
          <TransportControls />
          <ProgressBar />
        </div>

        <div className="flex items-center justify-end gap-1">
          <RadioToggle />
          <IconButton label="File d'attente" size="sm" onClick={() => open('queue')}>
            <ListMusic className="size-[18px]" />
          </IconButton>
          <VolumeControl />
          <IconButton label="Lecteur plein écran" size="sm" onClick={() => open('about')}>
            <Maximize2 className="size-[18px]" />
          </IconButton>
        </div>
      </div>

      {/* Mobile mini player (sits above the bottom navigation) */}
      <div className="fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 md:hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => open('about')}
          onKeyDown={(e) => e.key === 'Enter' && open('about')}
          aria-label={`En cours : ${song.title}. Ouvrir le lecteur`}
          className={cn(
            'relative flex items-center gap-3 overflow-hidden rounded-lg bg-surface-3 py-2 pr-2 pl-2',
          )}
        >
          <Cover id={song.id} className="size-11" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{song.title}</p>
            <p className="truncate text-xs text-fg-2">{song.artist}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="flex items-center">
            <LikeButton song={song} />
            <PlayPauseButton size="sm" />
          </div>
          <MiniProgress />
        </div>
      </div>
    </>
  );
}
