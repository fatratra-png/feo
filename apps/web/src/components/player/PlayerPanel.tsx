import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { NextTrackDisplay } from './NextTrackDisplay';
import { CD } from '../ui/CD';
import { formatDuration } from '../../lib/utils';
import {
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  Music,
  ListMusic,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Loader,
} from 'lucide-react';

export function PlayerPanel() {
  const [showQueue, setShowQueue] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    currentTrack, isPlaying, volume, progress, queue, queueIndex,
    pause, next, previous, isLoadingAudio, repeat, autoPlay, shuffle, isMuted,
    setVolume, setProgress, cycleRepeat, toggleShuffle, toggleMute, toggleAutoPlay,
    removeFromQueue, clearQueue, playNext,
  } = usePlayerStore();

  const resume = useCallback(() => usePlayerStore.getState().resume(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => next();
    const onCanPlay = () => {
      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => {});
      }
    };
    const onError = (e: Event) => {
      console.error('Audio error:', (e.target as HTMLAudioElement).error);
      usePlayerStore.setState({ isLoadingAudio: false });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
  }, [next, setProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (currentTrack.file_url) {
      const srcChanged = audio.src !== currentTrack.file_url;
      if (srcChanged) {
        audio.src = currentTrack.file_url;
        audio.load();
      }
      audio.volume = isMuted ? 0 : volume;
      if (isPlaying && !isLoadingAudio) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.removeAttribute('src');
    }
  }, [currentTrack?.file_url, currentTrack?.id, isPlaying, isLoadingAudio, volume, isMuted]);

  useEffect(() => {
    if (currentTrack) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 500);
      return () => clearTimeout(timer);
    }
  }, [currentTrack?.id]);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  };

  const progressPct = currentTrack && currentTrack.duration > 0 ? (progress / currentTrack.duration) * 100 : 0;

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-6 right-6 z-[60] size-11 rounded-full border-[3px] border-[#1a1a1a] bg-[#f5f0e8] backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-[#1a1a1a]/40 hover:text-saffron hover:border-saffron"
        style={{ boxShadow: '3px 3px 0 0 #1a1a1a' }}
      >
        <Music className="size-4" />
      </button>
    );
  }

  if (!currentTrack) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] w-[260px] rounded-2xl border-[4px] border-[#1a1a1a] backdrop-blur-md overflow-hidden transition-all duration-300" style={{ boxShadow: '4px 4px 0 0 #1a1a1a', background: '#f5f0e8' }}>
        <div className="h-2 w-full bg-gradient-to-r from-saffron via-blush to-mint" />
        <div className="p-3">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="size-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="h-1 w-full rounded-full bg-muted animate-pulse mb-2" />
          <div className="flex items-center justify-center gap-2.5">
            <div className="size-7 rounded-full bg-muted animate-pulse" />
            <div className="size-9 rounded-full bg-muted animate-pulse" />
            <div className="size-7 rounded-full bg-muted animate-pulse" />
          </div>
          <p className="text-center text-[8px] font-mono text-foreground/20 mt-3 uppercase tracking-widest">
            Play a song
          </p>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] w-[260px] rounded-2xl border-[4px] border-[#1a1a1a] backdrop-blur-md overflow-hidden transition-all duration-300 group" style={{ boxShadow: '4px 4px 0 0 #1a1a1a', background: '#f5f0e8' }}>
        <div className="h-1.5 w-full bg-[#e8dfd0] relative">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-saffron to-blush transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5 p-3">
          <div className="relative flex-shrink-0">
            <CD title={currentTrack.title} artist={currentTrack.artist_name} size="sm" />
            {isPlaying && (
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-mint border-[3px] border-[#f5f0e8] animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold truncate text-[#1a1a1a]">{currentTrack.title}</p>
            <p className="text-[8px] font-mono text-[#1a1a1a]/40 truncate">{currentTrack.artist_name}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); previous(); }}
              className="size-7 flex items-center justify-center rounded-full text-[#1a1a1a]/30 hover:text-blush hover:bg-blush/10 transition-all active:scale-90"
            >
              <SkipBack className="size-3" />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); isPlaying ? pause() : resume(); }}
              className="size-9 flex items-center justify-center rounded-full bg-saffron text-[#1a1a1a] border-[3px] border-[#1a1a1a] transition-all active:scale-90"
              style={{ boxShadow: '2px 2px 0 0 #1a1a1a' }}
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <Loader className="size-3.5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-3.5 fill-[#1a1a1a]" />
              ) : (
                <Play className="size-3.5 fill-[#1a1a1a] ml-0.5" />
              )}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="size-7 flex items-center justify-center rounded-full text-[#1a1a1a]/30 hover:text-mint hover:bg-mint/10 transition-all active:scale-90"
            >
              <SkipForward className="size-3" />
            </button>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="size-7 flex items-center justify-center rounded-full text-[#1a1a1a]/30 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5 transition-all active:scale-90"
          >
            <ChevronUp className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-[300px] max-h-[calc(100vh-48px)] rounded-2xl border-[4px] border-[#1a1a1a] backdrop-blur-md overflow-hidden transition-all duration-300 flex flex-col animate-scaleIn" style={{ boxShadow: '4px 4px 0 0 #1a1a1a', background: '#f5f0e8' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b-[3px] border-[#1a1a1a] flex-shrink-0" style={{ background: '#e8dfd0' }}>
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-saffron animate-ping opacity-40" />
            <span className="relative rounded-full bg-saffron size-1.5" />
          </span>
          <span className="font-mono text-[7px] tracking-[0.2em] text-[#1a1a1a]/60 uppercase font-bold">Now Playing</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`size-6 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 ${showQueue ? 'border-saffron bg-saffron/15 text-saffron' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5'}`}
          >
            <ListMusic className="size-2.5" />
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="size-6 flex items-center justify-center rounded-full border-2 border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5 transition-all active:scale-90"
          >
            <ChevronDown className="size-2.5" />
          </button>
          <button
            onClick={() => setVisible(false)}
            className="size-6 flex items-center justify-center rounded-full border-2 border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:text-blush hover:border-blush hover:bg-blush/10 transition-all active:scale-90"
          >
            <X className="size-2.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex flex-col items-center px-4 py-4">
          <div className={`relative mb-4 transition-all duration-500 ${isTransitioning ? 'animate-scaleIn' : ''}`}>
            <CD title={currentTrack.title} artist={currentTrack.artist_name} size="md" />
          </div>

          <div className="text-center w-full max-w-[220px]">
            <p className="font-display text-sm font-extrabold tracking-tight leading-tight truncate text-[#1a1a1a]">{currentTrack.title}</p>
            <p className="text-[9px] font-mono text-[#1a1a1a]/40 mt-0.5">
              {currentTrack.artist_name}
            </p>
          </div>

          <div className="w-full max-w-[220px] mt-3 space-y-1">
            <div className="relative h-1.5 bg-[#e8dfd0] rounded-full border border-[#1a1a1a]/10">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-saffron to-blush rounded-full transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between relative">
              <span className="text-[7px] font-mono text-[#1a1a1a]/30 tabular-nums">{formatDuration(progress)}</span>
              <input
                type="range"
                min={0}
                max={currentTrack.duration || 100}
                value={progress}
                onChange={seek}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="text-[7px] font-mono text-[#1a1a1a]/30 tabular-nums">{formatDuration(currentTrack.duration)}</span>
            </div>
          </div>

          <div className="w-full max-w-[220px]">
            <NextTrackDisplay />
          </div>

          <div className="flex items-center justify-center gap-1 mt-3">
            <button
              onClick={toggleShuffle}
              className={`size-8 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 ${shuffle ? 'border-saffron bg-saffron/15 text-saffron' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:border-[#1a1a1a]/40'}`}
            >
              <Shuffle className="size-3" />
            </button>
            <button
              onClick={previous}
              className="size-9 flex items-center justify-center rounded-full border-[3px] border-[#1a1a1a] text-[#1a1a1a]/50 hover:text-blush hover:border-blush hover:bg-blush/10 transition-all active:scale-90"
              style={{ boxShadow: '2px 2px 0 0 #1a1a1a' }}
            >
              <SkipBack className="size-3.5" />
            </button>
            <button
              onClick={() => isPlaying ? pause() : resume()}
              className="size-11 flex items-center justify-center rounded-full bg-saffron text-[#1a1a1a] border-[3px] border-[#1a1a1a] transition-all active:scale-90"
              style={{ boxShadow: '3px 3px 0 0 #1a1a1a' }}
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <Loader className="size-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-5 fill-[#1a1a1a]" />
              ) : (
                <Play className="size-5 fill-[#1a1a1a] ml-0.5" />
              )}
            </button>
            <button
              onClick={next}
              className="size-9 flex items-center justify-center rounded-full border-[3px] border-[#1a1a1a] text-[#1a1a1a]/50 hover:text-mint hover:border-mint hover:bg-mint/10 transition-all active:scale-90"
              style={{ boxShadow: '2px 2px 0 0 #1a1a1a' }}
            >
              <SkipForward className="size-3.5" />
            </button>
            <button
              onClick={cycleRepeat}
              className={`size-8 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 relative ${repeat !== 'off' ? 'border-saffron bg-saffron/15 text-saffron' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:border-[#1a1a1a]/40'}`}
            >
              <Repeat className="size-3" />
              {repeat === 'one' && <span className="absolute text-[5px] font-mono font-bold mt-2">1</span>}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 px-2 py-1.5 rounded-full border-2 border-[#1a1a1a]/20 bg-[#e8dfd0] w-full max-w-[220px] justify-center">
            <button
              onClick={toggleMute}
              className={`size-6 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 ${isMuted ? 'border-blush bg-blush/15 text-blush' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:text-blush hover:border-blush'}`}
            >
              {isMuted || volume === 0 ? <VolumeX className="size-2.5" /> : <Volume2 className="size-2.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="brutal-slider w-16"
            />
            <button
              onClick={toggleAutoPlay}
              className={`size-6 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 ${autoPlay ? 'border-mint bg-mint/15 text-mint' : 'border-[#1a1a1a]/20 text-[#1a1a1a]/30 hover:text-mint hover:border-mint'}`}
            >
              <Music className="size-2.5" />
            </button>
          </div>
        </div>

        {showQueue && (
          <div className="border-t-[3px] border-[#1a1a1a] px-3 py-2 max-h-40 overflow-y-auto" style={{ background: '#e8dfd0' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="eyebrow">Up Next</span>
                <span className="text-[7px] font-mono px-1.5 py-0.5 rounded-full border-2 border-[#1a1a1a] bg-[#f5f0e8] text-[#1a1a1a]/60">{queue.length}</span>
              </span>
              <div className="flex gap-1">
                {queue.length > 0 && (
                  <button onClick={clearQueue} className="text-[7px] font-mono px-1.5 py-0.5 rounded-full border-2 border-[#1a1a1a] bg-blush text-white cursor-pointer hover:bg-blush/80 transition-colors" style={{ boxShadow: '1px 1px 0 0 #1a1a1a' }}>Clear</button>
                )}
                <button onClick={() => setShowQueue(false)} className="text-[7px] font-mono px-1.5 py-0.5 rounded-full border-2 border-[#1a1a1a] bg-[#f5f0e8] text-[#1a1a1a]/60 cursor-pointer">Close</button>
              </div>
            </div>
            <div className="space-y-1">
              {queue.map((track, i) => {
                const isCurrent = i === queueIndex;
                return (
                  <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all ${isCurrent ? 'border-[3px] border-saffron bg-saffron/10' : 'border-2 border-[#1a1a1a]/20 bg-[#f5f0e8] hover:border-[#1a1a1a]/40'}`} style={isCurrent ? { boxShadow: '2px 2px 0 0 #FFD700' } : { boxShadow: '2px 2px 0 0 #1a1a1a20' }}>
                    <span className={`font-mono text-[7px] tabular-nums w-3 flex-shrink-0 ${isCurrent ? 'text-saffron' : 'text-[#1a1a1a]/30'}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] truncate ${isCurrent ? 'font-semibold text-[#1a1a1a]' : 'text-[#1a1a1a]/70'}`}>{track.title}</p>
                      <p className="text-[7px] font-mono text-[#1a1a1a]/30 truncate">{track.artist_name}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {!isCurrent && (
                        <button onClick={() => playNext(track)} className="size-4 flex items-center justify-center rounded-full text-[#1a1a1a]/20 hover:text-mint transition-all">
                          <ChevronRight className="size-2.5" />
                        </button>
                      )}
                      <button onClick={() => removeFromQueue(track.id)} className="size-4 flex items-center justify-center rounded-full text-[#1a1a1a]/20 hover:text-blush transition-all">
                        <X className="size-2" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {queue.length === 0 && (
                <p className="text-[8px] font-mono text-[#1a1a1a]/20 py-3 text-center">
                  {autoPlay ? 'Auto-play is on' : 'Queue is empty'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
