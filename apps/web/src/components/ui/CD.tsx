import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-12', md: 'size-20', lg: 'size-44' };

const PALETTES: [string, string][] = [
  ['#FFD700', '#f5f0e8'],
  ['#FF6B9D', '#f5f0e8'],
  ['#00D68F', '#f5f0e8'],
  ['#0057FF', '#f5f0e8'],
  ['#B366FF', '#f5f0e8'],
  ['#FF9500', '#f5f0e8'],
];

function hashPalette(title: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [accent, bg] = title ? hashPalette(title) : PALETTES[0];
  const isSpinning = spinning ?? isPlaying;
  const bw = size === 'lg' ? '5px' : '4px';
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-1.5 rounded-full"
          style={{ 
            background: accent,
            opacity: 0.3,
            filter: 'blur(8px)',
          }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          border: `${bw} solid #1a1a1a`,
          boxShadow: `3px 3px 0 0 #1a1a1a`,
          background: bg,
        }}
      >
        {/* Accent ring */}
        <div className="absolute rounded-full" style={{
          inset: '10%',
          border: `${size === 'lg' ? '4px' : '3px'} solid ${accent}`,
          boxShadow: `inset 0 0 0 2px ${bg}`,
        }} />

        {/* Inner accent ring */}
        <div className="absolute rounded-full" style={{
          inset: '25%',
          border: `${size === 'lg' ? '2px' : '1.5px'} solid ${accent}80`,
        }} />

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center z-10"
          style={{
            inset: size === 'lg' ? '32%' : '34%',
            background: accent,
            border: `${size === 'lg' ? '4px' : '3px'} solid #1a1a1a`,
            boxShadow: `2px 2px 0 0 #1a1a1a`,
          }}
        >
          {/* Center hole */}
          <div
            className="relative rounded-full z-20"
            style={{
              width: size === 'lg' ? '14px' : size === 'md' ? '9px' : '6px',
              height: size === 'lg' ? '14px' : size === 'md' ? '9px' : '6px',
              background: bg,
              border: `2px solid #1a1a1a`,
            }}
          />
        </div>

        {/* Sheen */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, transparent 40%)',
        }} />
      </div>
    </div>
  );
}
