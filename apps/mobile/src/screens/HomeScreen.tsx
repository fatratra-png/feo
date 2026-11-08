import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardRow, MixCard, PlaylistCard, QuickTile, SectionGap } from '../components/song';
import { Sheet } from '../components/sheets';
import { Button, Chip, ErrorState, IconButton, Logo, Press, SectionTitle, Skeleton, T } from '../components/ui';
import { api } from '../lib/api';
import { greeting } from '../lib/format';
import type { Mix } from '../lib/types';
import { useAuthStore } from '../stores/auth';
import { usePlayerStore } from '../stores/player';
import { toast } from '../stores/ui';
import { useTheme, type ThemePref } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

const PROMPTS = ['Afro chill pour un dimanche', 'Hira gasy classiques', 'Motivation sport', 'R&B des années 2000'];

function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { pref, setPref, c } = useTheme();
  const { user, logout } = useAuthStore();
  const options: { value: ThemePref; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { value: 'light', label: 'Clair', icon: 'sunny-outline' },
    { value: 'dark', label: 'Sombre', icon: 'moon-outline' },
    { value: 'system', label: 'Système', icon: 'phone-portrait-outline' },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title={user?.displayName ?? 'Compte'}>
      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 8 }}>
        <T tone="fg2" size={13}>{user?.email}</T>
        <T size={14} weight="700">Thème</T>
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
          {options.map((o) => (
            <Press
              key={o.value}
              onPress={() => setPref(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: pref === o.value }}
              style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: pref === o.value ? c.accent : c.overlay }}
            >
              <Ionicons name={o.icon} size={20} color={pref === o.value ? c.onAccent : c.fg} />
              <T size={13} weight="700" tone={pref === o.value ? 'onAccent' : 'fg'}>{o.label}</T>
            </Press>
          ))}
        </View>
        <Button
          label="Se déconnecter"
          variant="secondary"
          icon="log-out-outline"
          onPress={() => { onClose(); usePlayerStore.setState({ isPlaying: false, queue: [], index: -1 }); void logout(); }}
        />
      </View>
    </Sheet>
  );
}

async function playMix(mix: Mix) {
  const p = usePlayerStore.getState();
  if (p.context?.label === mix.title) return p.togglePlay();
  try {
    const { songs } = await api.mix(mix.id);
    if (!songs.length) return toast('Ce mix est vide pour le moment', { tone: 'error' });
    p.playSongs(songs, 0, { label: mix.title });
  } catch (err) {
    toast((err as Error).message, { tone: 'error' });
  }
}

export function HomeScreen({ navigation }: any) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [account, setAccount] = useState(false);
  const [prompt, setPrompt] = useState('');
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['home'],
    queryFn: api.home,
    refetchInterval: (q) => (q.state.data?.aiPending ? 8000 : false),
  });

  const regenerate = useMutation({
    mutationFn: api.refreshHome,
    onSuccess: () => { toast("L'IA recompose tes mix, environ une minute"); setTimeout(() => qc.invalidateQueries({ queryKey: ['home'] }), 8000); },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });

  const goCreate = (p: string) => p.trim() && navigation.navigate('Create', { prompt: p.trim() });
  const isNew = data && data.recent.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={c.fg2} />} contentContainerStyle={{ paddingBottom: 24 }}>
        <LinearGradient colors={[name === 'dark' ? '#4a3d0c' : '#fbe58a', c.bg]} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Logo size={28} />
            <Press onPress={() => setAccount(true)} accessibilityRole="button" accessibilityLabel="Compte et thème" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <T size={15} weight="900" tone="onAccent">{user?.displayName?.[0]?.toUpperCase() ?? '?'}</T>
            </Press>
          </View>
          <T size={30} style={[font.display, { marginTop: 22 }]} accessibilityRole="header">{greeting()}, {user?.displayName.split(' ')[0]}</T>
          <T tone="fg2" size={14} style={{ marginTop: 4 }}>{isNew ? 'Lance quelques titres : FEO apprend tes goûts.' : 'Que veux-tu écouter aujourd’hui ?'}</T>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, backgroundColor: c.surface, borderRadius: radius.full, paddingLeft: 16, paddingRight: 4, height: 50 }}>
            <Ionicons name="sparkles" size={18} color={c.accentFg} />
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              onSubmitEditing={() => goCreate(prompt)}
              placeholder="Décris ce que tu veux écouter…"
              placeholderTextColor={c.fg3}
              returnKeyType="go"
              accessibilityLabel="Décris ce que tu veux écouter"
              style={{ flex: 1, color: c.fg, fontSize: 15 }}
            />
            <IconButton icon="arrow-forward-circle" size={34} color={c.accentFg} label="Créer la playlist" disabled={!prompt.trim()} onPress={() => goCreate(prompt)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
            {PROMPTS.map((p) => <Chip key={p} label={p} onPress={() => goCreate(p)} />)}
          </ScrollView>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {error ? (
            <ErrorState message={(error as Error).message} onRetry={refetch} />
          ) : isLoading || !data ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ flexDirection: 'row', gap: 8 }}><Skeleton style={{ flex: 1, height: 56 }} /><Skeleton style={{ flex: 1, height: 56 }} /></View>)}
            </View>
          ) : (
            <>
              {data.aiPausedUntil && (
                <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.overlay, marginBottom: 20 }}>
                  <Ionicons name="moon-outline" size={16} color={c.fg2} />
                  <T tone="fg2" size={13} style={{ flex: 1 }}>
                    L'IA se repose jusqu'à {new Date(data.aiPausedUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (quota du jour). La musique continue normalement.
                  </T>
                </View>
              )}

              {data.recent.length > 0 && (
                <>
                  <View style={{ gap: 8 }}>
                    {Array.from({ length: Math.ceil(Math.min(6, data.recent.length) / 2) }, (_, r) => (
                      <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
                        {data.recent.slice(r * 2, r * 2 + 2).map((song, k) => (
                          <QuickTile
                            key={song.id}
                            song={song}
                            active={song.id === currentId}
                            playing={isPlaying}
                            onPress={() => {
                              const p = usePlayerStore.getState();
                              song.id === currentId ? p.togglePlay() : p.playSongs(data.recent, r * 2 + k, { label: 'Écoutés récemment' });
                            }}
                          />
                        ))}
                        {data.recent.slice(r * 2, r * 2 + 2).length === 1 && <View style={{ flex: 1 }} />}
                      </View>
                    ))}
                  </View>
                  <SectionGap />
                </>
              )}

              <SectionTitle
                title={data.aiReady ? 'Pour toi' : isNew ? 'Pour commencer' : 'Tes mix'}
                subtitle={data.aiReady ? 'Composés par l’IA à partir de tes écoutes' : data.aiPending ? 'L’IA prépare des mix personnalisés…' : undefined}
                action={data.aiEnabled && !data.aiPausedUntil && data.topArtists.length > 0 && !data.aiPending ? (
                  <IconButton icon="refresh" label="Régénérer les mix" onPress={() => regenerate.mutate()} disabled={regenerate.isPending} />
                ) : undefined}
              />
              <CardRow>
                {data.aiPending && (
                  <View style={{ width: 150 }} accessibilityLabel="L'IA compose tes mix">
                    <View style={{ aspectRatio: 1, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: c.accentFg, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="sparkles" size={30} color={c.accentFg} />
                    </View>
                    <T size={14} weight="700" style={{ marginTop: 8 }}>L'IA compose…</T>
                  </View>
                )}
                {data.mixes.map((m) => (
                  <MixCard key={m.id} mix={m} onPress={() => navigation.navigate('Mix', { id: m.id, title: m.title, subtitle: m.subtitle })} />
                ))}
              </CardRow>

              {data.playlists.length > 0 && (
                <>
                  <SectionGap />
                  <SectionTitle title="Tes playlists" />
                  <CardRow>
                    {data.playlists.map((p) => <PlaylistCard key={p.id} playlist={p} onPress={() => navigation.navigate('Playlist', { id: p.id })} />)}
                  </CardRow>
                </>
              )}

              {data.topArtists.length > 0 && (
                <>
                  <SectionGap />
                  <SectionTitle title="Tes artistes du moment" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {data.topArtists.map((a) => <Chip key={a.name} label={a.name} onPress={() => navigation.navigate('Search', { q: a.name })} />)}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <AccountSheet visible={account} onClose={() => setAccount(false)} />
    </View>
  );
}

export { playMix };
