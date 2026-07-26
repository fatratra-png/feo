import { useEffect, useState } from 'react';
import { ChevronRight, Sparkles, Music } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { recommendationsApi } from '../../lib/api';
import { CD } from '../ui/CD';

export function NextTrackDisplay() {
  const { currentTrack, queue, queueIndex, autoPlay } = usePlayerStore();
  const [nextTrack, setNextTrack] = useState<any>(null);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNextTrack = async () => {
      if (!currentTrack) {
        setNextTrack(null);
        return;
      }

      const upcomingIndex = queueIndex + 1;
      if (upcomingIndex < queue.length) {
        setNextTrack(queue[upcomingIndex]);
        setIsAIGenerated(false);
        return;
      }

      setLoading(true);
      try {
        const result = await recommendationsApi.getUpNext(currentTrack.id, 1);
        if (result.tracks && result.tracks.length > 0) {
          setNextTrack(result.tracks[0]);
          setIsAIGenerated(result.source === 'llm');
        } else {
          setNextTrack(null);
        }
      } catch (err) {
        setNextTrack(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNextTrack();
  }, [currentTrack, queue, queueIndex, autoPlay]);

  if (!currentTrack) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-mint/20 bg-mint/5 mt-3">
        <div className="size-6 border-2 border-mint/30 border-t-mint rounded-full animate-spin" />
        <p className="text-[8px] font-mono text-mint/50">Preparing next...</p>
      </div>
    );
  }

  if (!nextTrack) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-border/50 bg-muted/20 mt-3">
        <Music className="w-3 h-3 text-foreground/30" />
        <p className="text-[8px] font-mono text-foreground/40">No next song</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-mint/30 bg-mint/5 hover:border-mint/50 transition-all mt-3">
      <div className="min-w-0 flex-1">
        <p className="text-[7px] font-mono text-mint/60 tracking-wider uppercase flex items-center gap-1">
          {isAIGenerated ? (
            <>
              <Sparkles className="w-2 h-2 text-saffron" />
              AI Next
            </>
          ) : (
            'Up Next'
          )}
        </p>
        <p className="text-[9px] font-bold truncate text-foreground mt-0.5">{nextTrack.title}</p>
        <p className="text-[7px] font-mono text-foreground/50 truncate">{nextTrack.artist_name}</p>
      </div>
      <div className="flex-shrink-0">
        <CD title={nextTrack.title} artist={nextTrack.artist_name} size="sm" />
      </div>
    </div>
  );
}
