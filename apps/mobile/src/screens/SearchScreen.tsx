import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SongList } from '../components/song';
import { Button, EmptyState, ErrorState, IconButton, Press, SectionTitle, SongListSkeleton, T } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { usePlayerStore } from '../stores/player';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

const GENRES = [
  { label: 'Gasy', q: 'musique malagasy hits', colors: '#c2410c' },
  { label: 'Afrobeats', q: 'afrobeats hits', colors: '#b45309' },
  { label: 'Hip-hop', q: 'hip hop hits', colors: '#4338ca' },
  { label: 'R&B', q: 'rnb soul hits', colors: '#9d174d' },
  { label: 'Pop', q: 'pop hits official audio', colors: '#0e7490' },
  { label: 'Amapiano', q: 'amapiano hits', colors: '#047857' },
  { label: 'Gospel', q: 'gospel malagasy', colors: '#a16207' },
  { label: 'Zouk & Kompa', q: 'zouk kompa hits', colors: '#be123c' },
];

const looksLikeDescription = (q: string) => q.trim().split(/\s+/).length >= 5 || /\b(qui|comme|chanson|ambiance|années)\b/i.test(q);

export function SearchScreen({ route, navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [ai, setAi] = useState(false);

  // Deep link from "More from <artist>" / artist chips.
  useEffect(() => {
    const param = route.params?.q;
    if (param) { setInput(param); setQ(param); setAi(false); navigation.setParams({ q: undefined }); }
  }, [route.params?.q]);

  // Debounced classic search while typing.
  useEffect(() => {
    if (ai) return;
    const t = setTimeout(() => setQ(input.trim()), 450);
    return () => clearTimeout(t);
  }, [input, ai]);

  const classic = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: !ai && q.length > 0, staleTime: 10 * 60_000 });
  const smart = useQuery({
    queryKey: ['smart-search', q],
    queryFn: async () => {
      try {
        return { ...(await api.smartSearch(q)), fallback: false as const, reason: '' };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 503 || err.status === 429)) {
          return { interpretation: '', songs: (await api.search(q)).songs, model: '', fallback: true as const, reason: err.message };
        }
        throw err;
      }
    },
    enabled: ai && q.length >= 3,
    retry: false,
    staleTime: 30 * 60_000,
  });
  const active = ai ? smart : classic;
  const songs = active.data?.songs ?? [];
  const context = useMemo(() => ({ label: `Recherche « ${q} »` }), [q]);

  const runAi = () => { if (input.trim().length >= 3) { setAi(true); setQ(input.trim()); } };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <T size={28} style={font.display} accessibilityRole="header">Rechercher</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: c.surface, borderRadius: radius.md, paddingLeft: 12, height: 48, borderWidth: ai ? 1.5 : 0, borderColor: c.accentFg }}>
          <Ionicons name={ai ? 'sparkles' : 'search'} size={18} color={ai ? c.accentFg : c.fg2} />
          <TextInput
            value={input}
            onChangeText={(v) => { setInput(v); if (ai && !v) setAi(false); }}
            onSubmitEditing={() => (ai || looksLikeDescription(input) ? runAi() : setQ(input.trim()))}
            placeholder={ai ? 'Décris la chanson ou l’ambiance…' : 'Titres, artistes…'}
            placeholderTextColor={c.fg3}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Rechercher"
            style={{ flex: 1, color: c.fg, fontSize: 16 }}
          />
          {input ? <IconButton icon="close" size={18} label="Effacer" onPress={() => { setInput(''); setQ(''); setAi(false); }} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Press
            onPress={() => (ai ? (setAi(false), setQ(input.trim())) : runAi())}
            accessibilityRole="switch"
            accessibilityState={{ checked: ai }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: radius.full, backgroundColor: ai ? c.accent : c.overlay }}
          >
            <Ionicons name="sparkles" size={14} color={ai ? c.onAccent : c.fg} />
            <T size={13} weight="700" tone={ai ? 'onAccent' : 'fg'}>{ai ? 'Recherche IA' : 'Demander à l’IA'}</T>
          </Press>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {!q ? (
          <>
            <SectionTitle title="Parcourir" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {GENRES.map((g) => (
                <Press
                  key={g.label}
                  onPress={() => { setAi(false); setInput(g.label); setQ(g.q); }}
                  accessibilityRole="button"
                  style={{ width: '48%', flexGrow: 1, height: 96, borderRadius: radius.md, backgroundColor: g.colors, padding: 14, overflow: 'hidden' }}
                >
                  <T size={18} weight="800" style={{ color: '#fff' }}>{g.label}</T>
                  <View style={{ position: 'absolute', right: -14, bottom: -14, width: 64, height: 64, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '20deg' }] }} />
                </Press>
              ))}
            </View>
          </>
        ) : active.isLoading ? (
          <>
            {ai && <T tone="fg2" size={13} style={{ marginVertical: 8 }}><Ionicons name="sparkles" size={13} color={c.accentFg} /> L'IA réfléchit à ta description…</T>}
            <SongListSkeleton />
          </>
        ) : active.error ? (
          <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} />
        ) : songs.length === 0 ? (
          <EmptyState icon="search" title={`Aucun résultat pour « ${q} »`} body="Vérifie l'orthographe ou décris la chanson autrement." action={!ai ? <Button label="Demander à l'IA" variant="primary" icon="sparkles" onPress={runAi} /> : undefined} />
        ) : (
          <>
            {ai && smart.data && (smart.data.fallback ? (
              <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: c.overlay, marginBottom: 12 }}>
                <T tone="fg2" size={13}>{smart.data.reason || 'IA indisponible'} — résultats d'une recherche classique.</T>
              </View>
            ) : smart.data.interpretation ? (
              <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: c.overlay, marginBottom: 12, gap: 4 }}>
                <T tone="accentFg" size={11} weight="800" style={{ textTransform: 'uppercase' }}>Ce que l'IA a compris</T>
                <T size={14}>{smart.data.interpretation}</T>
              </View>
            ) : null)}
            <SongList songs={songs} context={context} showReason={ai} onPlay={(i) => usePlayerStore.getState().playSongs(songs, i, context)} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
