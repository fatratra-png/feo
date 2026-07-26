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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
      className={`group relative flex flex-col rounded-xl border-[3px] border-black cursor-pointer transition-all duration-200 overflow-hidden ${
        isActive ? '' : 'hover:-translate-y-1'
      }`}
      style={{
        background: isActive ? '#141414' : '#111',
        boxShadow: isActive 
          ? `4px 4px 0 0 ${accent}` 
          : isHovered 
            ? '4px 4px 0 0 #000' 
            : '3px 3px 0 0 #000',
      }}
    >
      {/* Top accent line */}
      <div className="h-[3px] w-full" style={{ background: isActive ? accent : isHovered ? '#333' : '#1a1a1a' }} />

      {/* Visual area */}
      <div className="relative px-4 pt-4 pb-2 flex items-center gap-3">
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
          <p className={`font-display font-bold text-xs leading-tight truncate transition-colors ${
            isActive ? '' : 'text-white/90 group-hover:text-white'
          }`} style={{ color: isActive ? accent : undefined }}>
            {track.title}
          </p>
          <p className="text-[9px] font-mono text-white/30 mt-0.5 truncate group-hover:text-white/50 transition-colors">
            {track.artist_name}
          </p>
        </div>

        {/* Play indicator */}
        <div className={`flex-shrink-0 size-8 rounded-full border-2 border-black flex items-center justify-center transition-all duration-200 ${
          isCurrentlyPlaying ? 'scale-100' : 'scale-0 group-hover:scale-100'
        }`} style={{ 
          background: isCurrentlyPlaying ? accent : '#222',
          boxShadow: `2px 2px 0 0 #000`,
        }}>
          {isCurrentlyPlaying ? (
            <span className="flex gap-px">
              <span className="w-0.5 h-2.5 bg-black rounded-full" />
              <span className="w-0.5 h-2.5 bg-black rounded-full" />
            </span>
          ) : (
            <span className="text-white text-xs ml-0.5">&#9654;</span>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isYoutube && (
            <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-full border-2 border-black bg-blush text-white" style={{ boxShadow: '1px 1px 0 0 #000' }}>
              YT
            </span>
          )}
          <span className="text-[8px] font-mono text-white/25 tabular-nums">
            {formatDuration(track.duration)}
          </span>
        </div>
        
        {isYoutube && track.plays_count && (
          <span className="text-[8px] font-mono text-white/25 tabular-nums">
            {(track.plays_count / 1000000).toFixed(1)}M
          </span>
        )}
      </div>
    </div>
  );
}
