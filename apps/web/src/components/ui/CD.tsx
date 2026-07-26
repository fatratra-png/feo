import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-12', md: 'size-20', lg: 'size-44' };
const LABEL_MAP = { sm: 'size-5', md: 'size-8', lg: 'size-16' };
const HOLE_MAP = { sm: 'size-1.5', md: 'size-2', lg: 'size-3' };

const PALETTES = [
  ['#FFD700', '#FFA500', '#FF6347'],
  ['#FF6B9D', '#FF1493', '#C71585'],
  ['#0057FF', '#00BFFF', '#00CED1'],
  ['#00D68F', '#20B2AA', '#008B8B'],
  ['#B366FF', '#9370DB', '#6A5ACD'],
  ['#FF9500', '#FF8C00', '#FF7F50'],
  ['#FF3B30', '#DC143C', '#B22222'],
  ['#00C7BE', '#48D1CC', '#40E0D0'],
];

function hashPalette(title: string): string[] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const palette = title ? hashPalette(title) : PALETTES[0];
  const isSpinning = spinning ?? isPlaying;
  const grooveCount = size === 'lg' ? 12 : size === 'md' ? 8 : 5;
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-1 rounded-full animate-pulse-glow opacity-50 blur-sm"
          style={{ background: `radial-gradient(circle, ${palette[0]}40 0%, transparent 70%)` }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          background: `radial-gradient(circle at 35% 35%, #2a2a2a 0%, #111 40%, #0a0a0a 70%, #050505 100%)`,
          boxShadow: `inset 0 0 ${size === 'lg' ? '20px' : '10px'} rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Outer rim highlight */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.06) 20deg, transparent 40deg, rgba(255,255,255,0.04) 180deg, transparent 200deg, rgba(255,255,255,0.06) 340deg, transparent 360deg)`,
        }} />

        {/* Vinyl grooves */}
        {Array.from({ length: grooveCount }).map((_, i) => {
          const pct = 30 + (i * (size === 'lg' ? 4.5 : size === 'md' ? 5 : 6));
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                inset: `${pct}%`,
                border: `0.5px solid rgba(255,255,255,${0.04 + (i % 2) * 0.02})`,
              }}
            />
          );
        })}

        {/* Subtle rainbow refraction */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `conic-gradient(from 45deg, transparent 0deg, rgba(255,100,100,0.03) 60deg, rgba(100,255,100,0.03) 120deg, rgba(100,100,255,0.03) 180deg, rgba(255,255,100,0.03) 240deg, rgba(255,100,255,0.03) 300deg, transparent 360deg)`,
        }} />

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            inset: size === 'lg' ? '28%' : size === 'md' ? '30%' : '28%',
            background: `radial-gradient(circle at 40% 35%, ${palette[1]} 0%, ${palette[0]} 50%, ${palette[2]} 100%)`,
            boxShadow: `inset 0 1px 3px rgba(255,255,255,0.3), inset 0 -1px 3px rgba(0,0,0,0.3)`,
          }}
        >
          {/* Label texture lines */}
          <div className="absolute inset-0 rounded-full overflow-hidden" style={{
            background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)`,
          }} />
          
          {/* Center hole */}
          <div
            className="relative rounded-full z-10"
            style={{
              width: size === 'lg' ? '14px' : size === 'md' ? '8px' : '6px',
              height: size === 'lg' ? '14px' : size === 'md' ? '8px' : '6px',
              background: '#0a0a0a',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
            }}
          />
        </div>

        {/* Light reflection */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)`,
        }} />
      </div>
    </div>
  );
}
