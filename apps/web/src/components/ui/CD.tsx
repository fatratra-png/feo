import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-14', md: 'size-24', lg: 'size-48' };
const HOLE_SIZES = { sm: 'size-4', md: 'size-7', lg: 'size-12' };
const INNER_SIZES = { sm: 'size-1.5', md: 'size-2.5', lg: 'size-5' };

const COLORS = ['#FFD700', '#FF6B9D', '#0057FF', '#00D68F', '#B366FF', '#FF9500', '#FF3B30', '#00C7BE'];

function hashColor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const accent = title ? hashColor(title) : '#FFD700';
  const isSpinning = spinning ?? isPlaying;
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {/* Glow effect when spinning */}
      {isSpinning && (
        <div 
          className="absolute inset-0 rounded-full animate-pulse-glow opacity-50"
          style={{ backgroundColor: `${accent}30` }}
        />
      )}
      <div
        className={`relative w-full h-full rounded-full border-2 border-foreground flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          background: `conic-gradient(${accent} 0deg, #fff 90deg, ${accent} 180deg, #ddd 270deg, ${accent} 360deg)`,
        }}
      >
        {/* Vinyl grooves effect */}
        <div className="absolute inset-2 rounded-full border border-foreground/10" />
        <div className="absolute inset-4 rounded-full border border-foreground/10" />
        <div className="absolute inset-6 rounded-full border border-foreground/10" />
        
        <div className={`${HOLE_SIZES[size]} rounded-full bg-background border-2 border-foreground flex items-center justify-center z-10`}>
          <div className={`${INNER_SIZES[size]} rounded-full`} style={{ backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
}
