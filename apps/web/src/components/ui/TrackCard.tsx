import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { CD } from './CD';
import { formatDuration } from '../../lib/utils';

interface TrackCardProps {
  track: {
    id: string;
    title: string;
    duration: number;
    file_url?: string | null;
    artist_name: string;
    album_title: string;
    album_cover_url: string | null;
    source?: 'local' | 'youtube';
    plays_count?: number;
  };
  index?: number;
}

const COLORS = ['#FFD700', '#FF6B9D', '#0057FF', '#00D68F', '#B366FF', '#FF9500', '#FF3B30', '#00C7BE'];

function hashColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function TrackCard({ track, index }: TrackCardProps) {
  const { play, currentTrack, isPlaying, pause, resume } = usePlayerStore();
  const [isHovered, setIsHovered] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const isActive = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isActive && isPlaying;
  const isYoutube = track.source === 'youtube';
  const accent = hashColor(track.title);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipple({ x, y });
    setTimeout(() => setRipple(null), 600);

    if (isActive) {
      isPlaying ? pause() : resume();
    } else {
      play(track as any);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col rounded-xl border-2 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 active:translate-y-0 overflow-hidden ${
        isActive ? 'border-saffron bg-saffron/8 brutal-shadow-saffron' : 'border-border bg-card hover:border-foreground/30'
      }`}
      style={{
        boxShadow: isHovered && !isActive ? `3px 3px 0 0 ${accent}30` : undefined,
      }}
    >
      {ripple && (
        <span
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
          style={{ left: ripple.x - 20, top: ripple.y - 20, width: 40, height: 40 }}
        />
      )}

      <div className="relative aspect-square flex items-center justify-center bg-muted/20 overflow-hidden" style={{ background: isActive ? undefined : `linear-gradient(135deg, ${accent}06, transparent)` }}>
        <CD title={track.title} artist={track.artist_name} size="md" />
        
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          isCurrentlyPlaying ? 'opacity-100 bg-foreground/20' : 'opacity-0 group-hover:opacity-100 bg-foreground/10'
        }`}>
          <span 
            className={`size-12 rounded-full border-2 border-background flex items-center justify-center backdrop-blur-sm transition-all duration-300 ${
              isCurrentlyPlaying ? 'scale-100' : 'scale-90 group-hover:scale-105'
            }`}
            style={{ backgroundColor: `${accent}70` }}
          >
            {isCurrentlyPlaying ? (
              <span className="flex gap-0.5">
                <span className="w-0.5 h-4 bg-background rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-background rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
              </span>
            ) : (
              <span className="text-background text-base ml-0.5">&#9654;</span>
            )}
          </span>
        </div>

        {isYoutube && (
          <span className="absolute top-1.5 right-1.5 chip text-[5px] px-1 py-0 bg-blush text-white border-white z-10">
            YT
          </span>
        )}

        {isCurrentlyPlaying && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 z-10">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-saffron rounded-full animate-pulse"
                style={{ height: `${6 + Math.random() * 6}px`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-2.5 py-2 min-w-0">
        <p className={`font-display font-bold text-[10px] leading-tight truncate transition-colors ${
          isActive ? 'text-saffron' : 'text-foreground/90 group-hover:text-foreground'
        }`}>
          {track.title}
        </p>
        <p className="text-[8px] font-mono text-foreground/40 mt-0.5 truncate group-hover:text-foreground/60 transition-colors">
          {track.artist_name}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {isYoutube && track.plays_count ? (
            <span className="chip text-[5px] border-saffron/30 text-saffron">
              {(track.plays_count / 1000000).toFixed(1)}M
            </span>
          ) : null}
          <span className="chip text-[5px] tabular-nums">{formatDuration(track.duration)}</span>
        </div>
      </div>
    </div>
  );
}
