import { useEffect, useState } from 'react';
import { extractAccent } from '../lib/color';

/** Colour of any cover (used by page headers for playlists and mixes). */
export function useCoverColor(songId: string | undefined) {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!songId) return setColor(null);
    extractAccent(songId).then((c) => alive && setColor(c?.accent ?? null));
    return () => { alive = false; };
  }, [songId]);
  return color;
}
