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
const BG = '#f5f0e8';

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
      className={`group relative flex flex-col rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden ${
        isActive ? '' : 'hover:-translate-y-1'
      }`}
      style={{
        background: isActive ? accent + '15' : BG,
        border: `4px solid ${isActive ? accent : '#1a1a1a'}`,
        boxShadow: isActive 
          ? `4px 4px 0 0 ${accent}` 
          : isHovered 
            ? `5px 5px 0 0 ${accent}60` 
            : '4px 4px 0 0 #1a1a1a',
      }}
    >
      {/* Top accent stripe */}
      <div className="h-2 w-full" style={{ background: accent }} />

      {/* Visual area */}
      <div className="relative px-4 pt-3 pb-2 flex items-center gap-3">
        <CD title={track.title} artist={track.artist_name} size="sm" />

        <div className="flex-1 min-w-0">
          <p className={`font-display font-bold text-xs leading-tight truncate ${
            isActive ? '' : 'text-[#1a1a1a]'
          }`} style={{ color: isActive ? '#1a1a1a' : undefined }}>
            {track.title}
          </p>
          <p className="text-[9px] font-mono text-[#1a1a1a]/40 mt-0.5 truncate">
            {track.artist_name}
          </p>
        </div>

        {/* Play indicator */}
        <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center transition-all duration-200 ${
          isCurrentlyPlaying ? 'scale-100' : 'scale-0 group-hover:scale-100'
        }`} style={{ 
          background: accent,
          border: '3px solid #1a1a1a',
          boxShadow: '2px 2px 0 0 #1a1a1a',
        }}>
          {isCurrentlyPlaying ? (
            <span className="flex gap-px">
              <span className="w-0.5 h-2.5 bg-[#1a1a1a] rounded-full" />
              <span className="w-0.5 h-2.5 bg-[#1a1a1a] rounded-full" />
            </span>
          ) : (
            <span className="text-[#1a1a1a] text-xs ml-0.5">&#9654;</span>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isYoutube && (
            <span className="text-[7px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#1a1a1a] text-white" style={{ boxShadow: '1px 1px 0 0 #1a1a1a' }}>
              YT
            </span>
          )}
          <span className="text-[8px] font-mono text-[#1a1a1a]/30 tabular-nums">
            {formatDuration(track.duration)}
          </span>
        </div>
        
        {isYoutube && track.plays_count && (
          <span className="text-[8px] font-mono text-[#1a1a1a]/30 tabular-nums">
            {(track.plays_count / 1000000).toFixed(1)}M
          </span>
        )}
      </div>
    </div>
  );
}
