import { usePlayerStore } from '../../stores/playerStore';

interface CDProps {
  title?: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  spinning?: boolean;
}

const SIZE_MAP = { sm: 'size-12', md: 'size-20', lg: 'size-44' };

const PALETTES: [string, string, string][] = [
  ['#FFD700', '#FFA500', '#FF6347'],
  ['#FF6B9D', '#C71585', '#8B008B'],
  ['#0057FF', '#00BFFF', '#00CED1'],
  ['#00D68F', '#20B2AA', '#008B8B'],
  ['#B366FF', '#9370DB', '#6A5ACD'],
  ['#FF9500', '#FF8C00', '#FF4500'],
  ['#FF3B30', '#DC143C', '#8B0000'],
  ['#00C7BE', '#48D1CC', '#008B8B'],
];

function hashPalette(title: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export function CD({ title = '', artist = '', size = 'sm', className = '', spinning }: CDProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const [c1, c2, c3] = title ? hashPalette(title) : PALETTES[0];
  const isSpinning = spinning ?? isPlaying;
  const sz = size === 'lg' ? 176 : size === 'md' ? 80 : 48;
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-2 rounded-full"
          style={{ 
            background: `radial-gradient(circle, ${c1}50 0%, transparent 70%)`,
            filter: 'blur(10px)',
          }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          border: `${size === 'lg' ? '4px' : '3px'} solid #000`,
          boxShadow: `4px 4px 0 0 #000, inset 0 0 ${sz * 0.15}px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Dark vinyl base */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle at 30% 30%, #1a1a1a 0%, #0d0d0d 50%, #050505 100%)`,
        }} />

        {/* Holographic rainbow sweep */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `conic-gradient(from 0deg, 
            ${c1}18 0deg, transparent 30deg, 
            ${c2}12 90deg, transparent 120deg, 
            ${c3}18 180deg, transparent 210deg, 
            ${c1}12 270deg, transparent 300deg, 
            ${c2}18 360deg)`,
        }} />

        {/* Bold accent ring */}
        <div className="absolute rounded-full" style={{
          inset: '18%',
          border: `${size === 'lg' ? '3px' : '2px'} solid ${c1}`,
          boxShadow: `0 0 8px ${c1}40`,
        }} />

        {/* Thin groove lines */}
        {[28, 36, 44, 52, 60, 68].map((pct) => (
          <div key={pct} className="absolute rounded-full" style={{
            inset: `${pct}%`,
            border: `0.5px solid rgba(255,255,255,0.06)`,
          }} />
        ))}

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center z-10"
          style={{
            inset: size === 'lg' ? '30%' : size === 'md' ? '32%' : '30%',
            background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
            border: `${size === 'lg' ? '3px' : '2px'} solid #000`,
            boxShadow: `2px 2px 0 0 #000, inset 0 2px 4px rgba(255,255,255,0.3)`,
          }}
        >
          {/* Inner detail ring */}
          <div className="absolute rounded-full" style={{
            inset: '20%',
            border: `1px solid rgba(0,0,0,0.15)`,
          }} />

          {/* Center hole */}
          <div
            className="relative rounded-full z-20"
            style={{
              width: size === 'lg' ? '14px' : size === 'md' ? '9px' : '6px',
              height: size === 'lg' ? '14px' : size === 'md' ? '9px' : '6px',
              background: '#080808',
              border: `2px solid #000`,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
            }}
          />
        </div>

        {/* Metallic sheen */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: `linear-gradient(145deg, rgba(255,255,255,0.1) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.03) 100%)`,
        }} />
      </div>
    </div>
  );
}
