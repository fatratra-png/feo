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
  ['#FFD700', '#FF6B9D'],
  ['#0057FF', '#00D68F'],
  ['#B366FF', '#FF9500'],
  ['#FF3B30', '#00C7BE'],
  ['#FF6B9D', '#B366FF'],
  ['#00D68F', '#FFD700'],
  ['#FF9500', '#0057FF'],
  ['#00C7BE', '#FF3B30'],
];

function hashPalette(title: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [c1, c2] = title ? hashPalette(title) : PALETTES[0];
  const isSpinning = spinning ?? isPlaying;
  const ringCount = size === 'lg' ? 5 : size === 'md' ? 4 : 3;
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-2 rounded-full"
          style={{ 
            background: `conic-gradient(${c1}, ${c2}, ${c1})`,
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
          border: `${size === 'lg' ? '5px' : '4px'} solid #000`,
          boxShadow: `5px 5px 0 0 #000`,
        }}
      >
        {/* Bold alternating rings */}
        {Array.from({ length: ringCount }).map((_, i) => {
          const inset = 8 + i * (size === 'lg' ? 12 : size === 'md' ? 14 : 16);
          const ringSize = size === 'lg' ? 12 : size === 'md' ? 14 : 16;
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                inset: `${inset}%`,
                background: i % 2 === 0 ? c1 : c2,
                border: '3px solid #000',
              }}
            />
          );
        })}

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center z-10"
          style={{
            inset: size === 'lg' ? '32%' : size === 'md' ? '34%' : '32%',
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            border: `${size === 'lg' ? '4px' : '3px'} solid #000`,
            boxShadow: `3px 3px 0 0 #000`,
          }}
        >
          {/* Cross pattern on label */}
          <div className="absolute" style={{
            width: '60%',
            height: '2px',
            background: '#000',
            opacity: 0.2,
          }} />
          <div className="absolute" style={{
            width: '2px',
            height: '60%',
            background: '#000',
            opacity: 0.2,
          }} />

          {/* Center hole */}
          <div
            className="relative rounded-full z-20"
            style={{
              width: size === 'lg' ? '18px' : size === 'md' ? '12px' : '8px',
              height: size === 'lg' ? '18px' : size === 'md' ? '12px' : '8px',
              background: '#080808',
              border: `3px solid #000`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
