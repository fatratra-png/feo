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
      
      // If there's a next track in the manual queue, show it
      if (upcomingIndex < queue.length) {
        setNextTrack(queue[upcomingIndex]);
        setIsAIGenerated(false);
        return;
      }

      // Always try to fetch AI-generated next track
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
        console.error('Failed to fetch next track:', err);
        setNextTrack(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNextTrack();
  }, [currentTrack, queue, queueIndex, autoPlay]);

  if (!currentTrack) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-mint/20 bg-mint/5 mt-4">
        <div className="size-8 border-2 border-mint/30 border-t-mint rounded-full animate-spin" />
        <p className="text-xs font-mono text-mint/50">Preparing next song...</p>
      </div>
    );
  }

  if (!nextTrack) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-border/50 bg-muted/20 mt-4">
        <Music className="w-4 h-4 text-foreground/30" />
        <p className="text-xs font-mono text-foreground/40">No next song available</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-mint/30 bg-mint/5 hover:border-mint/50 transition-all mt-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ChevronRight className="w-4 h-4 text-mint/60 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-mono text-mint/60 tracking-wider uppercase flex items-center gap-1.5">
            {isAIGenerated ? (
              <>
                <Sparkles className="w-3 h-3 text-saffron" />
                AI Recommended Next
              </>
            ) : (
              'Up Next'
            )}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate text-foreground">{nextTrack.title}</p>
              <p className="text-xs font-mono text-foreground/50 truncate">{nextTrack.artist_name}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-shrink-0">
        <CD title={nextTrack.title} artist={nextTrack.artist_name} size="sm" />
      </div>
    </div>
  );
}
