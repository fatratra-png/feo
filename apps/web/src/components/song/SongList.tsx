import { GripVertical, Play, Sparkles } from 'lucide-react';
import { memo, useState, type ReactNode } from 'react';
import { cn, formatTime } from '../../lib/format';
import type { Song } from '../../lib/types';
import { usePlayerStore, type PlayContext } from '../../stores/player';
import { Cover } from '../ui/Cover';
import type { MenuItem } from '../ui/Menu';
import { Equalizer } from '../ui/Feedback';
import { LikeButton, SongMenu, moveActions } from './SongActions';

interface RowProps {
  song: Song;
  index: number;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  showIndex?: boolean;
  showReason?: boolean;
  meta?: ReactNode;
  extraActions?: (MenuItem | 'divider')[];
  onRemove?: () => void;
  draggable?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
}

export const SongRow = memo(function SongRow({
  song, index, active, playing, onPlay, showIndex = true, showReason, meta, extraActions, onRemove,
  draggable, dragOver, onDragStart, onDragEnter, onDragEnd,
}: RowProps) {
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDragEnd={onDragEnd}
      onDoubleClick={onPlay}
      className={cn(
        'group relative grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors sm:grid-cols-[2rem_auto_1fr_auto_auto] sm:px-3',
        active ? 'bg-fg/[0.07]' : 'hover:bg-fg/[0.045]',
        dragOver && 'ring-1 ring-accent/60',
      )}
    >
      <div className="hidden w-8 justify-center text-sm tabular-nums text-fg-3 sm:flex">
        {active ? (
          <Equalizer playing={playing} />
        ) : draggable ? (
          <span className="cursor-grab active:cursor-grabbing" aria-hidden>
            <GripVertical className="size-4" />
          </span>
        ) : showIndex ? (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <Play className="hidden size-4 fill-current text-fg group-hover:block" aria-hidden />
          </>
        ) : (
          <Play className="hidden size-4 fill-current text-fg group-hover:block" aria-hidden />
        )}
      </div>

      <button onClick={onPlay} className="relative" aria-label={`Lire ${song.title} de ${song.artist}`}>
        <Cover id={song.id} className="size-11 sm:size-12" rounded="rounded-md" />
        {active && (
          <span className="absolute inset-0 grid place-items-center rounded-md bg-black/45 sm:hidden">
            <Equalizer playing={playing} />
          </span>
        )}
      </button>

      <button onClick={onPlay} className="min-w-0 text-left" tabIndex={-1}>
        <p className={cn('truncate text-[15px] font-semibold leading-tight', active ? 'text-accent-fg' : 'text-fg')}>{song.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-fg-2">
          {song.artist}
          {showReason && song.reason && (
            <span className="ml-2 inline-flex items-center gap-1 text-fg-3">
              <Sparkles className="size-3 text-accent-fg" aria-hidden />
              {song.reason}
            </span>
          )}
        </p>
      </button>

      <div className="hidden items-center gap-4 text-[13px] text-fg-3 sm:flex">
        {meta}
        <span className="w-10 text-right tabular-nums">{song.duration ? formatTime(song.duration) : ''}</span>
      </div>

      <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:[&:has([aria-pressed=true])]:opacity-100">
        <LikeButton song={song} className="hidden sm:inline-grid" />
        <SongMenu song={song} extra={extraActions} onRemove={onRemove} />
      </div>
    </li>
  );
});

interface ListProps {
  songs: Song[];
  context?: PlayContext | null;
  showIndex?: boolean;
  showReason?: boolean;
  meta?: (song: Song, index: number) => ReactNode;
  onRemove?: (song: Song, index: number) => void;
  /** Enables drag & drop + "move up/down" actions (keyboard-accessible reorder). */
  onMove?: (from: number, to: number) => void;
  /** Overrides what clicking a row plays (e.g. when the list is a slice of a bigger one). */
  onPlay?: (index: number) => void;
  className?: string;
}

/** A song list that knows which song is playing and plays in context on click. */
export function SongList({ songs, context, showIndex = true, showReason, meta, onRemove, onMove, onPlay, className }: ListProps) {
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  const play = (i: number) => {
    const p = usePlayerStore.getState();
    if (songs[i].id === currentId) return p.togglePlay();
    if (onPlay) return onPlay(i);
    p.playSongs(songs, i, context ?? null);
  };

  return (
    <ul className={cn('flex flex-col', className)}>
      {songs.map((song, i) => (
        <SongRow
          key={`${song.id}-${i}`}
          song={song}
          index={i}
          active={song.id === currentId}
          playing={isPlaying}
          onPlay={() => play(i)}
          showIndex={showIndex}
          showReason={showReason}
          meta={meta?.(song, i)}
          onRemove={onRemove ? () => onRemove(song, i) : undefined}
          extraActions={onMove ? moveActions(i, songs.length, onMove) : undefined}
          draggable={Boolean(onMove)}
          dragOver={dragTo === i && dragFrom !== i}
          onDragStart={() => setDragFrom(i)}
          onDragEnter={() => setDragTo(i)}
          onDragEnd={() => {
            if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) onMove?.(dragFrom, dragTo);
            setDragFrom(null);
            setDragTo(null);
          }}
        />
      ))}
    </ul>
  );
}
