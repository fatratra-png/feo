import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar, Transport } from '../components/player';
import { LikeButton } from '../components/song';
import { Cover, Equalizer, IconButton, Press, T } from '../components/ui';
import { coverUrl } from '../lib/api';
import { formatTime } from '../lib/format';
import { usePlayerStore } from '../stores/player';
import { useUiStore } from '../stores/ui';
import { DarkTheme, useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

function Queue() {
  const { c } = useTheme();
  const { queue, index, isPlaying, jumpTo, removeAt, move, clearUpcoming, radio, radioLoading } = usePlayerStore();
  const upcoming = queue.slice(index + 1);
  const current = queue[index];
  return (
    <View style={{ gap: 4 }}>
      {current && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: radius.md, backgroundColor: c.overlay, marginBottom: 12 }}>
          <Cover id={current.id} size={44} />
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} size={14} weight="700" tone="accentFg">{current.title}</T>
            <T numberOfLines={1} size={12} tone="fg2">{current.artist}</T>
          </View>
          <Equalizer playing={isPlaying} />
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <T size={12} weight="800" tone="fg2" style={{ textTransform: 'uppercase' }}>À suivre · {upcoming.length}</T>
        {upcoming.length > 0 && <Press onPress={clearUpcoming}><T size={13} weight="700" tone="fg2">Vider</T></Press>}
      </View>
      {upcoming.map((item, k) => {
        const i = index + 1 + k;
        return (
          <Press
            key={item.uid}
            onPress={() => jumpTo(i)}
            onLongPress={() => useUiStore.getState().openSongSheet({
              song: item,
              onRemove: () => removeAt(i),
              removeLabel: "Retirer de la file d'attente",
              move: { up: k > 0 ? () => move(i, i - 1) : undefined, down: k < upcoming.length - 1 ? () => move(i, i + 1) : undefined },
            })}
            accessibilityLabel={`Lire ${item.title}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
          >
            <Cover id={item.id} size={44} />
            <View style={{ flex: 1 }}>
              <T numberOfLines={1} size={14} weight="600">{item.title}</T>
              <T numberOfLines={1} size={12} tone="fg2">
                {item.from === 'radio' ? <Ionicons name="radio" size={11} color={c.accentFg} /> : null}{item.from === 'radio' ? ' ' : ''}{item.artist}{item.duration ? ` · ${formatTime(item.duration)}` : ''}
              </T>
            </View>
            <IconButton icon="close" size={18} label={`Retirer ${item.title}`} onPress={() => removeAt(i)} />
          </Press>
        );
      })}
      {radioLoading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <ActivityIndicator size="small" color={c.accentFg} />
          <T tone="fg2" size={13}>La radio IA choisit la suite…</T>
        </View>
      )}
      {!upcoming.length && !radioLoading && (
        <T tone="fg2" size={13} style={{ paddingVertical: 12 }}>
          {radio ? 'La radio IA ajoutera des titres automatiquement.' : 'La file est vide. Active la radio IA pour ne jamais t’arrêter.'}
        </T>
      )}
    </View>
  );
}

function Content({ navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const context = usePlayerStore((s) => s.context);
  const radio = usePlayerStore((s) => s.radio);
  const [tab, setTab] = useState<'song' | 'queue'>('song');

  useEffect(() => {
    if (!song && navigation.canGoBack()) navigation.goBack();
  }, [song, navigation]);
  if (!song) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Image source={{ uri: coverUrl(song.id) }} style={{ position: 'absolute', inset: 0, opacity: 0.55 }} blurRadius={60} contentFit="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)', '#000']} style={{ position: 'absolute', inset: 0 }} />

      <View style={{ flex: 1, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="chevron-down" size={28} color={c.fg} label="Réduire le lecteur" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T size={11} weight="700" tone="fg2" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>En lecture depuis</T>
            <T numberOfLines={1} size={13} weight="700">{context?.label ?? 'Ta sélection'}</T>
          </View>
          <IconButton icon={tab === 'queue' ? 'disc-outline' : 'list'} size={24} color={c.fg} label={tab === 'queue' ? 'Voir le titre' : "File d'attente"} onPress={() => setTab(tab === 'queue' ? 'song' : 'queue')} />
        </View>

        {tab === 'queue' ? (
          <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <Queue />
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Cover key={song.id} id={song.id} hd rounded={radius.md} />
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} size={22} style={font.title}>{song.title}</T>
            <T numberOfLines={1} size={15} tone="fg2" style={{ marginTop: 2 }}>{song.artist}</T>
          </View>
          <LikeButton song={song} size={26} />
          <IconButton icon="ellipsis-horizontal" size={24} color={c.fg} label="Plus d'options" onPress={() => useUiStore.getState().openSongSheet({ song })} />
        </View>
        {song.reason ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Ionicons name="sparkles" size={13} color={c.accentFg} />
            <T size={12} tone="fg2">Choisi par l'IA : {song.reason}</T>
          </View>
        ) : null}

        <View style={{ marginTop: 14 }}><ProgressBar /></View>
        <View style={{ marginTop: 6 }}><Transport /></View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
          <Press
            onPress={() => usePlayerStore.getState().toggleRadio()}
            accessibilityRole="switch"
            accessibilityState={{ checked: radio }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: radius.full, backgroundColor: radio ? c.overlayStrong : 'transparent' }}
          >
            <Ionicons name="radio" size={15} color={radio ? c.accentFg : c.fg2} />
            <T size={12} weight="700" tone={radio ? 'accentFg' : 'fg2'}>Radio IA {radio ? 'activée' : 'désactivée'}</T>
          </Press>
        </View>
      </View>
    </View>
  );
}

/** Full-screen player — always dark, like the web version. */
export function NowPlayingScreen(props: any) {
  return (
    <DarkTheme>
      <Content {...props} />
    </DarkTheme>
  );
}
