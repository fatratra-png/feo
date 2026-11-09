import { Music2 } from 'lucide-react';
import { useState } from 'react';
import { coverUrl } from '../../lib/api';
import { cn } from '../../lib/format';

interface CoverProps {
  id?: string;
  size?: 'sm' | 'lg';
  className?: string;
  alt?: string;
  rounded?: string;
}

/** Square crop of a YouTube thumbnail with a graceful placeholder. */
export function Cover({ id, size = 'sm', className, alt = '', rounded = 'rounded-lg' }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-surface-3 shrink-0', rounded, className)}>
      {id && !failed ? (
        <img
          src={coverUrl(id, size)}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          // Fades in over the placeholder instead of popping in line by line.
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-3 to-surface-2">
          <Music2 className="size-1/3 text-fg-3" aria-hidden />
        </div>
      )}
    </div>
  );
}

/** 2×2 mosaic for playlists and mixes (falls back to a single cover). */
export function Mosaic({ ids, className, rounded = 'rounded-xl' }: { ids: string[]; className?: string; rounded?: string }) {
  if (ids.length < 4) return <Cover id={ids[0]} className={className} rounded={rounded} />;
  return (
    <div className={cn('grid aspect-square grid-cols-2 overflow-hidden bg-surface-3 shrink-0', rounded, className)}>
      {ids.slice(0, 4).map((id) => (
        <Cover key={id} id={id} rounded="rounded-none" />
      ))}
    </div>
  );
}
