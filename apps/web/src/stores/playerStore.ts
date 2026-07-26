import { create } from 'zustand';
import { api, youtubeApi, recommendationsApi } from '../lib/api';

interface Track {
  id: string;
  title: string;
  duration: number;
  file_url: string | null;
  artist_name: string;
  album_title: string;
  album_cover_url: string | null;
  source?: 'local' | 'youtube';
  youtube_id?: string;
}

type RepeatMode = 'off' | 'one' | 'all';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  isPlaying: boolean;
  volume: number;
  previousVolume: number;
  isMuted: boolean;
  progress: number;
  queueIndex: number;
  isLoadingAudio: boolean;
  repeat: RepeatMode;
  autoPlay: boolean;
  shuffle: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  playHistory: Track[];
  gaplessPlayback: boolean;
  isPanelCollapsed: boolean;
  lastPrevClickTime: number;

  play: (track: Track, queue?: Track[]) => void;
  setTrackAudioUrl: (trackId: string, url: string) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  replay: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setProgress: (progress: number) => void;
  setQueue: (queue: Track[]) => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setRepeat: (mode: RepeatMode) => void;
  cycleRepeat: () => void;
  toggleAutoPlay: () => void;
  toggleShuffle: () => void;
  toggleCrossfade: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  getCurrentQueuePosition: () => number;
  getUpNext: () => Track[];
  populateQueueWithRecommendations: (track: Track) => Promise<void>;
  togglePanel: () => void;
  expandPanel: () => void;
}

function fetchAudio(track: Track): Promise<string | null> {
  if (track.source !== 'youtube' || !track.youtube_id) return Promise.resolve(null);
  return youtubeApi.getAudioUrl(track.youtube_id)
    .then((data: any) => data.audioUrl || null)
    .catch(() => null);
}

function needsAudioFetch(track: Track): boolean {
  return track.source === 'youtube' && !track.file_url;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  isPlaying: false,
  volume: parseFloat(localStorage.getItem('feo_volume') || '0.7'),
  previousVolume: 0.7,
  isMuted: false,
  progress: 0,
  queueIndex: -1,
  isLoadingAudio: false,
  repeat: (localStorage.getItem('feo_repeat') as RepeatMode) || 'off',
  autoPlay: localStorage.getItem('feo_autoplay') === 'true',
  shuffle: localStorage.getItem('feo_shuffle') === 'true',
  crossfade: localStorage.getItem('feo_crossfade') === 'true',
  crossfadeDuration: parseFloat(localStorage.getItem('feo_crossfade_duration') || '3'),
  playHistory: [],
  gaplessPlayback: true,
  isPanelCollapsed: false,
  lastPrevClickTime: 0,

  play: (track, queue) => {
    const state = get();
    let currentQueue;
    let index;

    if (queue) {
      currentQueue = [...queue];
      index = currentQueue.findIndex((t) => t.id === track.id);
      if (index === -1) index = 0;
    } else {
      currentQueue = [...state.queue];
      index = currentQueue.findIndex((t) => t.id === track.id);
      if (index === -1) {
        const insertAt = state.queueIndex >= 0 ? state.queueIndex + 1 : 0;
        currentQueue.splice(insertAt, 0, track);
        index = insertAt;
      }
    }

    const needsFetch = needsAudioFetch(track);

    const current = state.currentTrack;
    if (current && state.isPlaying && state.shuffle) {
      const history = [...state.playHistory];
      const existingIdx = history.findIndex(t => t.id === current.id);
      if (existingIdx === -1) history.push(current);
      set({ playHistory: history.slice(-50) });
    }

    set({
      currentTrack: track,
      queue: currentQueue,
      originalQueue: queue ? currentQueue : state.originalQueue,
      queueIndex: index,
      isPlaying: !needsFetch,
      progress: 0,
      isLoadingAudio: needsFetch,
    });

    if (needsFetch && track.youtube_id) {
      youtubeApi.getAudioUrl(track.youtube_id)
        .then((data: any) => {
          if (data.audioUrl) {
            get().setTrackAudioUrl(track.id, data.audioUrl);
            set({ isPlaying: true, isLoadingAudio: false });
          }
        })
        .catch(() => set({ isLoadingAudio: false }));
    }

    // Auto-populate queue with AI recommendations
    setTimeout(() => {
      get().populateQueueWithRecommendations(track);
    }, 500);
  },

  setTrackAudioUrl: (trackId, url) => {
    const { currentTrack, queue } = get();
    if (currentTrack?.id === trackId) {
      set({ currentTrack: { ...currentTrack, file_url: url } });
    }
    set({ queue: queue.map((t) => (t.id === trackId ? { ...t, file_url: url } : t)) });
  },

  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),

  replay: () => {
    const { currentTrack } = get();
    if (!currentTrack) return;
    set({ progress: 0, isPlaying: true });
    const audio = document.querySelector('audio');
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
  },

  seekTo: (time) => {
    set({ progress: time });
    const audio = document.querySelector('audio');
    if (audio) audio.currentTime = time;
  },

  next: () => {
    const { queue, queueIndex, repeat, autoPlay, currentTrack, shuffle, originalQueue } = get();
    const history = [...get().playHistory];

    if (currentTrack) {
      const existingIdx = history.findIndex(t => t.id === currentTrack.id);
      if (existingIdx === -1) history.push(currentTrack);
    }

    if (repeat === 'one' && currentTrack) {
      set({ playHistory: history.slice(-50) });
      get().replay();
      return;
    }

    let nextIndex = queueIndex + 1;

    if (nextIndex < queue.length) {
      const nextTrack = queue[nextIndex];
      const needsFetch = needsAudioFetch(nextTrack);
      set({
        currentTrack: nextTrack,
        queueIndex: nextIndex,
        isPlaying: !needsFetch,
        progress: 0,
        isLoadingAudio: needsFetch,
        playHistory: history.slice(-50),
      });
      if (needsFetch && nextTrack.youtube_id) {
        youtubeApi.getAudioUrl(nextTrack.youtube_id)
          .then((data: any) => {
            if (data.audioUrl) {
              get().setTrackAudioUrl(nextTrack.id, data.audioUrl);
              set({ isPlaying: true, isLoadingAudio: false });
            }
          })
          .catch(() => set({ isLoadingAudio: false }));
      }
      return;
    }

    if (repeat === 'all' && queue.length > 0) {
      const nextTrack = queue[0];
      const needsFetch = needsAudioFetch(nextTrack);
      set({
        currentTrack: nextTrack,
        queueIndex: 0,
        isPlaying: !needsFetch,
        progress: 0,
        isLoadingAudio: needsFetch,
        playHistory: history.slice(-50),
      });
      if (needsFetch && nextTrack.youtube_id) {
        youtubeApi.getAudioUrl(nextTrack.youtube_id)
          .then((data: any) => {
            if (data.audioUrl) {
              get().setTrackAudioUrl(nextTrack.id, data.audioUrl);
              set({ isPlaying: true, isLoadingAudio: false });
            }
          })
          .catch(() => set({ isLoadingAudio: false }));
      }
      return;
    }

    // Queue exhausted — fetch AI recommendations for next song
    if (currentTrack) {
      set({ isLoadingAudio: true, playHistory: history.slice(-50) });

      recommendationsApi.getUpNext(currentTrack.id, 5)
        .then((data: any) => {
          const tracks = data.tracks || [];
          const filtered = tracks.filter((t: any) => t.id !== currentTrack.id);

          if (filtered.length > 0) {
            const nextTrack = filtered[0];
            const newQueue = [...get().queue, nextTrack];
            const needsFetch = needsAudioFetch(nextTrack);
            set({
              currentTrack: nextTrack,
              queue: newQueue,
              originalQueue: originalQueue.length > 0 ? originalQueue : newQueue,
              queueIndex: newQueue.length - 1,
              isPlaying: !needsFetch,
              progress: 0,
              isLoadingAudio: needsFetch,
            });
            if (needsFetch && nextTrack.youtube_id) {
              youtubeApi.getAudioUrl(nextTrack.youtube_id)
                .then((d: any) => {
                  if (d.audioUrl) {
                    get().setTrackAudioUrl(nextTrack.id, d.audioUrl);
                    set({ isPlaying: true, isLoadingAudio: false });
                  }
                })
                .catch(() => set({ isLoadingAudio: false }));
            }
          } else {
            set({ isPlaying: false, isLoadingAudio: false });
          }
        })
        .catch(() => {
          set({ isPlaying: false, isLoadingAudio: false });
        });
      return;
    }

    set({ isPlaying: false, currentTrack: null, queueIndex: -1, playHistory: history.slice(-50) });
  },

  previous: () => {
    const { queue, queueIndex, playHistory, progress, lastPrevClickTime, currentTrack } = get();
    const now = Date.now();
    const timeSinceLastClick = now - lastPrevClickTime;
    
    // If progress is more than 3 seconds OR this is the first click in 2 seconds, replay from start
    if (progress > 3 || timeSinceLastClick > 2000) {
      set({ lastPrevClickTime: now });
      get().replay();
      return;
    }
    
    // Second click within 2 seconds and progress <= 3 seconds: go to previous track
    set({ lastPrevClickTime: now });
    
    const prevIndex = queueIndex - 1;
    if (prevIndex >= 0) {
      const prevTrack = queue[prevIndex];
      const needsFetch = needsAudioFetch(prevTrack);
      set({
        currentTrack: prevTrack,
        queueIndex: prevIndex,
        isPlaying: !needsFetch,
        progress: 0,
        isLoadingAudio: needsFetch,
      });
      if (needsFetch && prevTrack.youtube_id) {
        youtubeApi.getAudioUrl(prevTrack.youtube_id)
          .then((data: any) => {
            if (data.audioUrl) {
              get().setTrackAudioUrl(prevTrack.id, data.audioUrl);
              set({ isPlaying: true, isLoadingAudio: false });
            }
          })
          .catch(() => set({ isLoadingAudio: false }));
      }
    } else if (playHistory.length > 0) {
      const prevTrack = playHistory[playHistory.length - 1];
      const newHistory = playHistory.slice(0, -1);
      const needsFetch = needsAudioFetch(prevTrack);
      const currentQueue = [...queue];
      const cur = get().currentTrack;
      if (cur && !currentQueue.find(t => t.id === cur.id)) {
        currentQueue.splice(queueIndex >= 0 ? queueIndex : 0, 0, cur);
      }
      let newIndex = currentQueue.findIndex(t => t.id === prevTrack.id);
      if (newIndex === -1) {
        currentQueue.unshift(prevTrack);
        newIndex = 0;
      }
      set({
        currentTrack: prevTrack,
        queue: currentQueue,
        queueIndex: newIndex,
        isPlaying: !needsFetch,
        progress: 0,
        isLoadingAudio: needsFetch,
        playHistory: newHistory,
      });
      if (needsFetch && prevTrack.youtube_id) {
        youtubeApi.getAudioUrl(prevTrack.youtube_id)
          .then((data: any) => {
            if (data.audioUrl) {
              get().setTrackAudioUrl(prevTrack.id, data.audioUrl);
              set({ isPlaying: true, isLoadingAudio: false });
            }
          })
          .catch(() => set({ isLoadingAudio: false }));
      }
    } else {
      get().replay();
    }
  },

  setVolume: (volume) => {
    localStorage.setItem('feo_volume', String(volume));
    set({ volume, isMuted: volume === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume || 0.7 });
      localStorage.setItem('feo_volume', String(previousVolume || 0.7));
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 });
    }
  },

  setProgress: (progress) => set({ progress }),
  setQueue: (queue) => set({ queue, originalQueue: queue }),

  addToQueue: (track) => {
    const { queue } = get();
    if (!queue.find((t) => t.id === track.id)) {
      set({ queue: [...queue, track] });
    }
  },

  playNext: (track) => {
    const { queue, queueIndex } = get();
    const insertAt = queueIndex + 1;
    const newQueue = [...queue];
    if (!newQueue.find((t) => t.id === track.id)) {
      newQueue.splice(insertAt, 0, track);
      set({ queue: newQueue });
    }
  },

  removeFromQueue: (trackId) => {
    const { queue, queueIndex, currentTrack } = get();
    const newQueue = queue.filter((t) => t.id !== trackId);
    const removedIndex = queue.findIndex((t) => t.id === trackId);
    let newIndex = queueIndex;
    if (removedIndex >= 0 && removedIndex < queueIndex) newIndex--;
    if (currentTrack?.id === trackId) {
      set({
        queue: newQueue,
        currentTrack: newQueue[newIndex] || null,
        queueIndex: Math.min(newIndex, newQueue.length - 1),
        isPlaying: !!newQueue[newIndex],
      });
    } else {
      set({ queue: newQueue, queueIndex: newIndex });
    }
  },

  clearQueue: () => set({
    queue: [],
    originalQueue: [],
    queueIndex: -1,
    currentTrack: null,
    isPlaying: false,
    playHistory: [],
  }),

  reorderQueue: (fromIndex, toIndex) => {
    const { queue } = get();
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);
    let { queueIndex } = get();
    if (fromIndex === queueIndex) {
      queueIndex = toIndex;
    } else if (fromIndex < queueIndex && toIndex >= queueIndex) {
      queueIndex--;
    } else if (fromIndex > queueIndex && toIndex <= queueIndex) {
      queueIndex++;
    }
    set({ queue: newQueue, queueIndex });
  },

  setRepeat: (mode) => {
    localStorage.setItem('feo_repeat', mode);
    set({ repeat: mode });
  },

  cycleRepeat: () => {
    const { repeat } = get();
    const modes: RepeatMode[] = ['off', 'one', 'all'];
    const idx = modes.indexOf(repeat);
    const next = modes[(idx + 1) % modes.length];
    localStorage.setItem('feo_repeat', next);
    set({ repeat: next });
  },

  toggleAutoPlay: () => {
    const { autoPlay } = get();
    localStorage.setItem('feo_autoplay', String(!autoPlay));
    set({ autoPlay: !autoPlay });
  },

  toggleShuffle: () => {
    const { shuffle, queue, queueIndex, currentTrack } = get();
    const newShuffle = !shuffle;
    localStorage.setItem('feo_shuffle', String(newShuffle));

    if (newShuffle) {
      const remaining = queue.slice(queueIndex + 1);
      const shuffled = shuffleArray(remaining);
      const newQueue = [currentTrack!, ...shuffled].filter(Boolean);
      set({ shuffle: true, queue: newQueue, queueIndex: 0 });
    } else {
      set({ shuffle: false });
    }
  },

  toggleCrossfade: () => {
    const { crossfade } = get();
    localStorage.setItem('feo_crossfade', String(!crossfade));
    set({ crossfade: !crossfade });
  },

  setCrossfadeDuration: (seconds) => {
    localStorage.setItem('feo_crossfade_duration', String(seconds));
    set({ crossfadeDuration: seconds });
  },

  getCurrentQueuePosition: () => {
    return get().queueIndex;
  },

  getUpNext: () => {
    const { queue, queueIndex } = get();
    return queue.slice(queueIndex + 1);
  },

  populateQueueWithRecommendations: async (track: Track) => {
    try {
      // Use the recommendations API to get AI-based suggestions
      const response = await recommendationsApi.getUpNext(track.id, 15);
      const recommendedTracks = response.tracks || [];
      
      if (recommendedTracks.length === 0) {
        // If no recommendations from backend, try YouTube related tracks
        try {
          const ytResponse = await youtubeApi.related(`${track.title} ${track.artist_name}`);
          const ytTracks = (ytResponse as any).tracks || [];
          const filtered = ytTracks.filter((t: any) => t.id !== track.id);
          
          if (filtered.length > 0) {
            const currentQueue = get().queue;
            const newTracks = filtered.filter((t: any) => !currentQueue.find(q => q.id === t.id));
            
            if (newTracks.length > 0) {
              const updatedQueue = [...currentQueue, ...newTracks].slice(0, 50);
              set({ queue: updatedQueue });
            }
          }
        } catch (ytErr) {
          // YouTube related also failed, silently continue
        }
        return;
      }

      // Filter out current track
      const filtered = recommendedTracks.filter((t: any) => t.id !== track.id);

      if (filtered.length > 0) {
        // Merge with existing queue, avoiding duplicates
        const currentQueue = get().queue;
        const newTracks = filtered.filter((t: any) => !currentQueue.find(q => q.id === t.id));
        
        if (newTracks.length > 0) {
          const updatedQueue = [...currentQueue, ...newTracks].slice(0, 50);
          set({ queue: updatedQueue });
        }
      }
    } catch (err) {
      // Recommendation API failed, try YouTube as fallback
      try {
        const ytResponse = await youtubeApi.related(`${track.title} ${track.artist_name}`);
        const ytTracks = (ytResponse as any).tracks || [];
        const filtered = ytTracks.filter((t: any) => t.id !== track.id);
        
        if (filtered.length > 0) {
          const currentQueue = get().queue;
          const newTracks = filtered.filter((t: any) => !currentQueue.find(q => q.id === t.id));
          
          if (newTracks.length > 0) {
            const updatedQueue = [...currentQueue, ...newTracks].slice(0, 50);
            set({ queue: updatedQueue });
          }
        }
      } catch (ytErr) {
        // Both failed, queue will remain as is
      }
    }
  },

  togglePanel: () => set((s) => ({ isPanelCollapsed: !s.isPanelCollapsed })),
  expandPanel: () => set({ isPanelCollapsed: false }),
}));
