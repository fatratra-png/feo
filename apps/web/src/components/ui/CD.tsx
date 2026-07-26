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
  
  return (
    <div className={`relative flex-shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {isSpinning && (
        <div 
          className="absolute -inset-1 rounded-full"
          style={{ 
            background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          }}
        />
      )}
      
      <div
        className={`relative w-full h-full rounded-full overflow-hidden transition-all duration-300 ${
          isSpinning ? 'cd-spin' : ''
        }`}
        style={{
          border: '2px solid #2a2a2a',
          background: 'linear-gradient(135deg, #1a1a1a, #111)',
        }}
      >
        {/* Accent ring */}
        <div className="absolute rounded-full" style={{
          inset: '12%',
          border: `2px solid ${accent}60`,
        }} />

        {/* Center label */}
        <div
          className="absolute rounded-full flex items-center justify-center z-10"
          style={{
            inset: size === 'lg' ? '30%' : '32%',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            border: '2px solid #1a1a1a',
          }}
        >
          {/* Center hole */}
          <div
            className="relative rounded-full z-20"
            style={{
              width: size === 'lg' ? '10px' : size === 'md' ? '7px' : '5px',
              height: size === 'lg' ? '10px' : size === 'md' ? '7px' : '5px',
              background: '#111',
              border: '1px solid #2a2a2a',
            }}
          />
        </div>

        {/* Sheen */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
        }} />
      </div>
    </div>
  );
}
