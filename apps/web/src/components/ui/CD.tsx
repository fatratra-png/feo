import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-12', md: 'size-20', lg: 'size-44' };

const ACCENTS = ['#FFD700', '#FF6B9D', '#00D68F', '#0057FF', '#B366FF', '#FF9500'];

function hashAccent(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const accent = title ? hashAccent(title) : '#FFD700';
  const isSpinning = spinning ?? isPlaying;
  const r = size === 'lg' ? 88 : size === 'md' ? 40 : 24;
  const bw = size === 'lg' ? '4px' : '3px';
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-1 rounded-full"
          style={{ 
            background: accent,
            opacity: 0.25,
            filter: 'blur(6px)',
          }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          border: `${bw} solid #000`,
          boxShadow: `3px 3px 0 0 #000`,
        }}
      >
        {/* Base vinyl */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(circle at 35% 35%, #1c1c1c, #0a0a0a 70%)`,
        }} />

        {/* Three-tone rings: outer/mid/inner using accent */}
        <div className="absolute rounded-full" style={{ inset: '8%', border: `2px solid ${accent}40` }} />
        <div className="absolute rounded-full" style={{ inset: '20%', border: `1.5px solid ${accent}25` }} />
        <div className="absolute rounded-full" style={{ inset: '32%', border: `1px solid ${accent}15` }} />

        {/* Fine grooves */}
        {[40, 48, 56, 64].map((p) => (
          <div key={p} className="absolute rounded-full" style={{ inset: `${p}%`, border: '0.5px solid rgba(255,255,255,0.04)' }} />
        ))}

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center z-10"
          style={{
            inset: size === 'lg' ? '28%' : '30%',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            border: `${size === 'lg' ? '3px' : '2px'} solid #000`,
            boxShadow: `2px 2px 0 0 #000`,
          }}
        >
          {/* Spindle ring */}
          <div className="absolute rounded-full" style={{ inset: '25%', border: '1px solid rgba(0,0,0,0.2)' }} />
          
          {/* Center hole */}
          <div
            className="relative rounded-full z-20"
            style={{
              width: size === 'lg' ? '12px' : size === 'md' ? '8px' : '5px',
              height: size === 'lg' ? '12px' : size === 'md' ? '8px' : '5px',
              background: '#080808',
              border: '2px solid #000',
            }}
          />
        </div>

        {/* Sheen */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, transparent 40%)',
        }} />
      </div>
    </div>
  );
}
