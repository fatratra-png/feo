import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { CD } from '../ui/CD';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

export function PlayerBar() {
  const { currentTrack, progress, isPanelCollapsed, expandPanel, isPlaying, pause, resume, next, previous } = usePlayerStore();
  const [isHovered, setIsHovered] = useState(false);

  if (!currentTrack) return null;

  const progressPct = currentTrack.duration > 0 ? (progress / currentTrack.duration) * 100 : 0;
  const isActive = true;
  const isCurrentlyPlaying = isActive && isPlaying;

  if (!isPanelCollapsed) return null;

  return (
    <div
      onClick={expandPanel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-0 left-0 right-0 z-40 cursor-pointer group"
    >
      <div className={`flex items-center gap-3 px-4 py-3 bg-card/95 backdrop-blur-md border-t-2 border-border transition-all duration-300 ${
        isHovered ? 'py-4' : ''
      }`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <CD title={currentTrack.title} artist={currentTrack.artist_name} size="sm" />
            {isCurrentlyPlaying && (
              <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-saffron border-2 border-card animate-pulse" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate text-foreground group-hover:text-saffron transition-colors">
              {currentTrack.title}
            </p>
            <p className="text-[9px] font-mono text-foreground/50 truncate">{currentTrack.artist_name}</p>
          </div>
        </div>

        {/* Control buttons - show on hover */}
        <div className={`flex items-center gap-2 transition-all duration-300 ${
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              previous();
            }}
            className="size-7 flex items-center justify-center rounded-full border-2 border-border text-foreground/40 hover:text-blush hover:border-blush hover:bg-blush/10 transition-all active:scale-90"
          >
            <SkipBack className="size-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              isPlaying ? pause() : resume();
            }}
            className="size-9 flex items-center justify-center rounded-full border-2 border-saffron text-saffron hover:bg-saffron hover:text-black transition-all active:scale-90 brutal-shadow-sm"
          >
            {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current ml-0.5" />}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="size-7 flex items-center justify-center rounded-full border-2 border-border text-foreground/40 hover:text-mint hover:border-mint hover:bg-mint/10 transition-all active:scale-90"
          >
            <SkipForward className="size-3" />
          </button>
        </div>

        {/* Play button - always visible when not hovered */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            isPlaying ? pause() : resume();
          }}
          className={`size-8 flex items-center justify-center rounded-full border-2 border-saffron text-saffron hover:bg-saffron hover:text-black transition-all active:translate-y-[1px] ${
            isHovered ? 'opacity-0 scale-75 absolute' : 'opacity-100'
          }`}
        >
          {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
        </button>
      </div>

      {/* Progress bar with interactive seek */}
      <div className="relative h-1.5 bg-muted cursor-pointer group/progress">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-saffron to-blush transition-all duration-100"
          style={{ width: `${progressPct}%` }}
        />
        {/* Progress indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-saffron border-2 border-card transition-all ${
            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{ left: `calc(${progressPct}% - 6px)` }}
        />
      </div>
    </div>
  );
}
