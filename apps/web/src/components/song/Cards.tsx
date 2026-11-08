import { Heart, Pause, Play, Radio, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn, pluralize } from '../../lib/format';
import type { Mix, PlaylistSummary, Song } from '../../lib/types';
import { usePlayerStore } from '../../stores/player';
import { Cover, Mosaic } from '../ui/Cover';

/** Floating play button revealed on card hover (always visible on touch). */
function HoverPlay({ playing, onClick, label }: { playing: boolean; onClick: (e: React.MouseEvent) => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e); }}
      className={cn(
        'absolute right-2 bottom-2 grid size-12 place-items-center rounded-full bg-accent text-on-accent transition-all duration-200 hover:scale-105',
        playing ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100',
      )}
    >
      {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
    </button>
  );
}

export function MediaCard({
  to,
  cover,
  title,
  subtitle,
  badge,
  onPlay,
  playing = false,
}: {
  to: string;
  cover: ReactNode;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onPlay?: () => void;
  playing?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex w-full flex-col gap-3 rounded-lg p-3 transition-colors duration-200 hover:bg-fg/[0.06] focus-visible:bg-fg/[0.06]"
    >
      <div className="relative">
        {cover}
        {badge && <div className="absolute top-2 left-2">{badge}</div>}
        {onPlay && <HoverPlay playing={playing} onClick={onPlay} label={playing ? `Mettre ${title} en pause` : `Lire ${title}`} />}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate font-semibold text-fg">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-2">{subtitle}</p>
      </div>
    </Link>
  );
}

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">{children}</span>
);

export function MixCard({ mix, onPlay, playing }: { mix: Mix; onPlay: () => void; playing: boolean }) {
  return (
    <MediaCard
      to={`/mix/${encodeURIComponent(mix.id)}?t=${encodeURIComponent(mix.title)}&s=${encodeURIComponent(mix.subtitle)}`}
      cover={<Mosaic ids={mix.coverIds} className="w-full" rounded="rounded-md" />}
      title={mix.title}
      subtitle={mix.subtitle}
      onPlay={onPlay}
      playing={playing}
      badge={
        mix.kind === 'ai' ? (
          <Badge><Sparkles className="size-3" aria-hidden /> IA</Badge>
        ) : mix.kind === 'radio' ? (
          <Badge><Radio className="size-3" aria-hidden /> Radio</Badge>
        ) : undefined
      }
    />
  );
}

export function PlaylistCard({ playlist, onPlay, playing }: { playlist: PlaylistSummary; onPlay?: () => void; playing?: boolean }) {
  return (
    <MediaCard
      to={`/playlist/${playlist.id}`}
      cover={<Mosaic ids={playlist.coverIds} className="w-full" rounded="rounded-md" />}
      title={playlist.name}
      subtitle={playlist.aiPrompt ? `Créée par l'IA · ${pluralize(playlist.songCount, 'titre')}` : pluralize(playlist.songCount, 'titre')}
      onPlay={playlist.songCount ? onPlay : undefined}
      playing={playing}
      badge={playlist.aiPrompt ? <Badge><Sparkles className="size-3" aria-hidden /> IA</Badge> : undefined}
    />
  );
}

export function LikedCard({ count }: { count: number }) {
  return (
    <MediaCard
      to="/liked"
      cover={
        <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-gradient-to-br from-accent to-[#e8a317]">
          <Heart className="size-1/3 fill-on-accent text-on-accent" aria-hidden />
        </div>
      }
      title="Titres likés"
      subtitle={pluralize(count, 'titre')}
    />
  );
}

/** Compact horizontal tile for "pick up where you left off". */
export function QuickTile({ song, onPlay, active, playing }: { song: Song; onPlay: () => void; active: boolean; playing: boolean }) {
  return (
    <button
      onClick={onPlay}
      className={cn(
        'group relative flex h-14 items-center gap-3 overflow-hidden rounded-md bg-fg/[0.07] pr-3 text-left transition-colors duration-150 hover:bg-fg/[0.13]',
        active && 'bg-fg/[0.13]',
      )}
      aria-label={`Lire ${song.title} de ${song.artist}`}
    >
      <Cover id={song.id} className="h-14 w-14" rounded="rounded-none" />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', active ? 'text-accent-fg' : 'text-fg')}>{song.title}</p>
        <p className="truncate text-xs text-fg-2">{song.artist}</p>
      </div>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
        aria-hidden
      >
        {active && playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </span>
    </button>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{children}</div>;
}

/** Horizontal scroller on mobile, grid on desktop. */
export function CardRow({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-6 [&>*]:w-[42vw] [&>*]:max-w-[200px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto sm:[&>*]:max-w-none">
      {children}
    </div>
  );
}

export function usePlayingContext(label: string) {
  const ctx = usePlayerStore((s) => s.context?.label);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  return ctx === label && isPlaying;
}
