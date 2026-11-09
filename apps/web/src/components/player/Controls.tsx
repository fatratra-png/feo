import { Loader2, Pause, Play, Radio, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn, formatTime } from '../../lib/format';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../../stores/player';
import { IconButton } from '../ui/Button';

export function PlayPauseButton({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const buffering = usePlayerStore((s) => s.buffering && s.isPlaying);
  const hasSong = usePlayerStore((s) => s.index >= 0);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const dims = { sm: 'size-10', md: 'size-11', lg: 'size-16' }[size];
  const icon = { sm: 'size-4', md: 'size-5', lg: 'size-7' }[size];
  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!hasSong}
      aria-label={isPlaying ? 'Pause' : 'Lecture'}
      className={cn(
        'sticker press grid shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40',
        dims,
        className,
      )}
    >
      {buffering ? (
        <Loader2 className={cn(icon, 'animate-spin')} aria-hidden />
      ) : isPlaying ? (
        <Pause className={cn(icon, 'fill-current')} aria-hidden />
      ) : (
        <Play className={cn(icon, 'ml-0.5 fill-current')} aria-hidden />
      )}
    </button>
  );
}

export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { shuffle, repeat, toggleShuffle, cycleRepeat, previous, next } = usePlayerStore(
    useShallow((s) => ({ shuffle: s.shuffle, repeat: s.repeat, toggleShuffle: s.toggleShuffle, cycleRepeat: s.cycleRepeat, previous: s.previous, next: s.next })),
  );
  const hasSong = usePlayerStore((s) => s.index >= 0);
  const big = size === 'lg';
  const iconCls = big ? 'size-7' : 'size-5';
  return (
    <div className={cn('flex items-center', big ? 'justify-between gap-2' : 'gap-2')}>
      <IconButton label={shuffle ? 'Désactiver la lecture aléatoire' : 'Activer la lecture aléatoire'} aria-pressed={shuffle} active={shuffle} onClick={toggleShuffle} size={big ? 'lg' : 'sm'}>
        <Shuffle className={big ? 'size-6' : 'size-[18px]'} />
      </IconButton>
      <IconButton label="Titre précédent" onClick={previous} disabled={!hasSong} size={big ? 'lg' : 'sm'} className="!text-fg">
        <SkipBack className={cn(iconCls, 'fill-current')} />
      </IconButton>
      <PlayPauseButton size={big ? 'lg' : 'sm'} />
      <IconButton label="Titre suivant" onClick={() => next()} disabled={!hasSong} size={big ? 'lg' : 'sm'} className="!text-fg">
        <SkipForward className={cn(iconCls, 'fill-current')} />
      </IconButton>
      <IconButton
        label={repeat === 'off' ? 'Répéter la file' : repeat === 'all' ? 'Répéter ce titre' : 'Désactiver la répétition'}
        aria-pressed={repeat !== 'off'}
        active={repeat !== 'off'}
        onClick={cycleRepeat}
        size={big ? 'lg' : 'sm'}
      >
        {repeat === 'one' ? <Repeat1 className={big ? 'size-6' : 'size-[18px]'} /> : <Repeat className={big ? 'size-6' : 'size-[18px]'} />}
      </IconButton>
    </div>
  );
}

/** Seek bar: dragging updates the label live and seeks once on release. */
export function ProgressBar({ compact = false }: { compact?: boolean }) {
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration || s.queue[s.index]?.duration || 0);
  const seek = usePlayerStore((s) => s.seek);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;

  return (
    <div className="flex w-full items-center gap-2.5 text-[11px] font-medium tabular-nums text-fg-3">
      {!compact && <span className="w-10 text-right">{formatTime(shown)}</span>}
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.5}
        value={shown}
        disabled={!duration}
        aria-label="Position dans le titre"
        aria-valuetext={`${formatTime(shown)} sur ${formatTime(duration)}`}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => { if (drag !== null) { seek(drag); setDrag(null); } }}
        onKeyUp={() => { if (drag !== null) { seek(drag); setDrag(null); } }}
        className={cn('range flex-1', compact && 'always-thumb')}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {!compact && <span className="w-10">{formatTime(duration)}</span>}
    </div>
  );
}

export function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayerStore(
    useShallow((s) => ({ volume: s.volume, muted: s.muted, setVolume: s.setVolume, toggleMute: s.toggleMute })),
  );
  const v = muted ? 0 : volume;
  const Icon = v === 0 ? VolumeX : v < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1">
      <IconButton label={muted ? 'Réactiver le son' : 'Couper le son'} size="sm" onClick={toggleMute}>
        <Icon className="size-[18px]" />
      </IconButton>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={v}
        aria-label="Volume"
        onChange={(e) => { setVolume(Number(e.target.value)); if (muted) toggleMute(); }}
        className="range w-24"
        style={{ ['--pct' as string]: `${v * 100}%` }}
      />
    </div>
  );
}

export function RadioToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const radio = usePlayerStore((s) => s.radio);
  const loading = usePlayerStore((s) => s.radioLoading);
  const toggle = usePlayerStore((s) => s.toggleRadio);
  return (
    <IconButton
      label={radio ? 'Radio IA activée : la musique continue après la file' : 'Activer la radio IA'}
      aria-pressed={radio}
      active={radio}
      size={size}
      onClick={toggle}
    >
      {loading ? <Loader2 className="size-[18px] animate-spin" /> : <Radio className="size-[18px]" />}
    </IconButton>
  );
}

/** Re-renders at most once per animation frame: cheap smooth progress line. */
export function MiniProgress() {
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration || s.queue[s.index]?.duration || 0);
  const [pct, setPct] = useState(0);
  useEffect(() => { setPct(duration ? (position / duration) * 100 : 0); }, [position, duration]);
  return (
    <div className="absolute inset-x-3 bottom-0 h-[3px] overflow-hidden rounded-full bg-fg/15" aria-hidden>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}
