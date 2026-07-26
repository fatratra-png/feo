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

const ACCENTS = ['#FFD700', '#FF6B9D', '#00D68F', '#0057FF', '#B366FF', '#FF9500'];

function hashAccent(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export function TrackCard({ track, index }: TrackCardProps) {
  const { play, currentTrack, isPlaying, pause, resume } = usePlayerStore();
  const [isHovered, setIsHovered] = useState(false);
  const isActive = currentTrack?.id === track.id;
  const isCurrentlyPlaying = isActive && isPlaying;
  const isYoutube = track.source === 'youtube';
  const accent = hashAccent(track.title);

  const handleClick = () => {
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
      className="group relative flex flex-col rounded-xl cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        background: isActive ? `${accent}12` : '#161616',
        border: `1px solid ${isActive ? `${accent}50` : '#252525'}`,
        transform: isHovered ? 'translateY(-2px)' : undefined,
      }}
    >
      {/* Visual area */}
      <div className="relative p-4 pb-2 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <CD title={track.title} artist={track.artist_name} size="sm" />
          {isCurrentlyPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex gap-0.5">
                <span className="w-0.5 h-3 rounded-full animate-pulse" style={{ background: accent }} />
                <span className="w-0.5 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '0.15s' }} />
                <span className="w-0.5 h-3 rounded-full animate-pulse" style={{ background: accent, animationDelay: '0.3s' }} />
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-display font-bold text-[11px] leading-tight truncate transition-colors ${
            isActive ? 'text-white' : 'text-white/80 group-hover:text-white'
          }`}>
            {track.title}
          </p>
          <p className="text-[9px] font-mono text-white/30 mt-0.5 truncate group-hover:text-white/40 transition-colors">
            {track.artist_name}
          </p>
        </div>

        {/* Play indicator */}
        <div className={`flex-shrink-0 size-7 rounded-full flex items-center justify-center transition-all duration-200 ${
          isCurrentlyPlaying ? 'scale-100' : 'scale-0 group-hover:scale-100'
        }`} style={{ 
          background: isCurrentlyPlaying ? accent : '#252525',
          border: '1px solid #333',
        }}>
          {isCurrentlyPlaying ? (
            <span className="flex gap-px">
              <span className="w-0.5 h-2 bg-black/70 rounded-full" />
              <span className="w-0.5 h-2 bg-black/70 rounded-full" />
            </span>
          ) : (
            <span className="text-white/60 text-[10px] ml-0.5">&#9654;</span>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isYoutube && (
            <span className="text-[7px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/30">
              YT
            </span>
          )}
          <span className="text-[8px] font-mono text-white/20 tabular-nums">
            {formatDuration(track.duration)}
          </span>
        </div>
        
        {isYoutube && track.plays_count && (
          <span className="text-[8px] font-mono text-white/20 tabular-nums">
            {(track.plays_count / 1000000).toFixed(1)}M
          </span>
        )}
      </div>

      {/* Active indicator line */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: accent }} />
      )}
    </div>
  );
}
