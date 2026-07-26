import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-12', md: 'size-20', lg: 'size-44' };

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
  const grooves = size === 'lg' ? 10 : size === 'md' ? 7 : 4;
  const borderW = size === 'lg' ? '4px' : size === 'md' ? '3px' : '2px';
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-1.5 rounded-full opacity-60"
          style={{ 
            backgroundColor: accent,
            boxShadow: `0 0 0 3px #000, 0 0 20px ${accent}60`,
          }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          border: `${borderW} solid #000`,
          boxShadow: isSpinning 
            ? `4px 4px 0 0 #000, inset 0 0 10px rgba(0,0,0,0.5)` 
            : `3px 3px 0 0 #000, inset 0 0 8px rgba(0,0,0,0.4)`,
          background: '#111',
        }}
      >
        {/* Bold concentric rings */}
        {Array.from({ length: grooves }).map((_, i) => {
          const inset = 22 + (i * (size === 'lg' ? 5.5 : size === 'md' ? 6.5 : 8));
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                inset: `${inset}%`,
                border: `${size === 'lg' ? '1.5px' : '1px'} solid ${i % 2 === 0 ? '#222' : '#1a1a1a'}`,
              }}
            />
          );
        })}

        {/* Conic accent reflection */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `conic-gradient(from 0deg, ${accent}15 0deg, transparent 30deg, ${accent}10 180deg, transparent 210deg, ${accent}15 360deg)`,
        }} />

        {/* Center label - solid neo-brutal */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            inset: size === 'lg' ? '26%' : size === 'md' ? '28%' : '26%',
            background: accent,
            border: `${size === 'lg' ? '3px' : '2px'} solid #000`,
            boxShadow: `2px 2px 0 0 #000`,
          }}
        >
          {/* Inner ring on label */}
          <div className="absolute rounded-full" style={{
            inset: '15%',
            border: `1px solid rgba(0,0,0,0.2)`,
          }} />

          {/* Center hole */}
          <div
            className="relative rounded-full z-10"
            style={{
              width: size === 'lg' ? '16px' : size === 'md' ? '10px' : '7px',
              height: size === 'lg' ? '16px' : size === 'md' ? '10px' : '7px',
              background: '#080808',
              border: `2px solid #000`,
            }}
          />
        </div>

        {/* Top-left highlight */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 40%)`,
        }} />
      </div>
    </div>
  );
}
