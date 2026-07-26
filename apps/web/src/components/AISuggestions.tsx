import { useState, useEffect } from 'react';
import { Sparkles, Search, Loader, AlertCircle } from 'lucide-react';
import { recommendationsApi } from '../lib/api';
import { searchApi } from '../lib/api';
import { usePlayerStore } from '../stores/playerStore';

interface Suggestion {
  query: string;
  explanation: string;
}

export function AISuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPreference, setUserPreference] = useState('relaxing');
  const [currentMood, setCurrentMood] = useState('chill');
  const [genre, setGenre] = useState('any');
  const { queue, currentTrack } = usePlayerStore();

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recommendationsApi.getAISuggestions(userPreference, currentMood, genre);
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      } else if (data.fallback) {
        setSuggestions(data.fallback);
        setError('AI service unavailable, showing default suggestions');
      } else {
        setSuggestions([
          { query: 'trending music', explanation: 'Popular tracks right now' },
          { query: 'relaxing ambient', explanation: 'Chill background music' },
          { query: 'focus beats', explanation: 'Music for concentration' }
        ]);
        setError('Using default suggestions');
      }
    } catch (err: any) {
      if (err.message?.includes('503') || err.message?.includes('unavailable')) {
        try {
          const fallbackData = await recommendationsApi.getAISuggestions(userPreference, currentMood, genre);
          if (fallbackData.fallback) {
            setSuggestions(fallbackData.fallback);
            setError('AI service unavailable, showing default suggestions');
            return;
          }
        } catch {}
      }
      setSuggestions([
        { query: 'trending music', explanation: 'Popular tracks right now' },
        { query: 'relaxing ambient', explanation: 'Chill background music' },
        { query: 'focus beats', explanation: 'Music for concentration' }
      ]);
      setError('Using default suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearching(true);
    try {
      const results = await searchApi.search(query);
      const tracks = results.tracks || [];
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        usePlayerStore.getState().play(firstTrack, tracks);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-gradient-to-b from-saffron/5 to-transparent rounded-xl border-2 border-border">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-saffron" />
        <h2 className="font-bold text-sm text-foreground">AI Suggestions</h2>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blush/10 border border-blush/20 text-blush text-[9px] font-mono">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label className="text-[9px] font-mono text-foreground/50 uppercase tracking-wider block mb-1">Preference</label>
          <select
            value={userPreference}
            onChange={(e) => setUserPreference(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border-2 border-border bg-card text-xs text-foreground"
          >
            <option value="relaxing">Relaxing</option>
            <option value="energetic">Energetic</option>
            <option value="focused">Focused</option>
            <option value="uplifting">Uplifting</option>
            <option value="melancholic">Melancholic</option>
          </select>
        </div>

        <div>
          <label className="text-[9px] font-mono text-foreground/50 uppercase tracking-wider block mb-1">Mood</label>
          <select
            value={currentMood}
            onChange={(e) => setCurrentMood(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border-2 border-border bg-card text-xs text-foreground"
          >
            <option value="chill">Chill</option>
            <option value="party">Party</option>
            <option value="workout">Workout</option>
            <option value="study">Study</option>
            <option value="sleep">Sleep</option>
          </select>
        </div>

        <div>
          <label className="text-[9px] font-mono text-foreground/50 uppercase tracking-wider block mb-1">Genre</label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border-2 border-border bg-card text-xs text-foreground"
          >
            <option value="any">Any</option>
            <option value="hip-hop">Hip-hop</option>
            <option value="electronic">Electronic</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
            <option value="indie">Indie</option>
            <option value="jazz">Jazz</option>
          </select>
        </div>

        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="w-full px-3 py-2 rounded-lg bg-saffron text-black font-bold text-xs hover:bg-saffron/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 brutal-shadow-sm active:translate-y-0.5"
        >
          {loading ? <Loader className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Generate
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(suggestion.query)}
              disabled={searching}
              className="w-full p-2 rounded-lg border-2 border-border bg-card/50 hover:border-foreground/30 transition-colors text-left group"
            >
              <div className="font-mono font-bold text-[10px] text-foreground flex items-center gap-1.5">
                {searching ? <Loader className="w-2.5 h-2.5 animate-spin" /> : <Search className="w-2.5 h-2.5 text-foreground/40" />}
                {suggestion.query}
              </div>
              <p className="text-[8px] text-foreground/40 mt-0.5 group-hover:text-foreground/60 transition-colors">{suggestion.explanation}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
