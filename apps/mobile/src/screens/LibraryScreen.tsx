import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreatePlaylistSheet } from '../components/sheets';
import { LikedTile, SongList } from '../components/song';
import { Chip, EmptyState, ErrorState, IconButton, Mosaic, Press, SongListSkeleton, T } from '../components/ui';
import { useLikedIds, usePlaylists } from '../hooks/library';
import { api } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';

function Row({ cover, title, subtitle, onPress }: { cover: React.ReactNode; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      {cover}
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} size={15} weight="600">{title}</T>
        <T numberOfLines={1} tone="fg2" size={13} style={{ marginTop: 2 }}>{subtitle}</T>
      </View>
    </Press>
  );
}

function History() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['history'], queryFn: api.history });
  if (error) return <ErrorState message={(error as Error).message} onRetry={refetch} />;
  if (isLoading) return <SongListSkeleton />;
  if (!data?.songs.length) return <EmptyState icon="time-outline" title="Rien écouté pour l'instant" body="Tes écoutes apparaîtront ici." />;
  return <SongList songs={data.songs} context={{ label: 'Écoutés récemment' }} />;
}

export function LibraryScreen({ navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'playlists' | 'history'>('playlists');
  const [creating, setCreating] = useState(false);
  const { data: playlists, isLoading, error, refetch } = usePlaylists();
  const likedCount = useLikedIds().size;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <T size={28} style={font.display} accessibilityRole="header">Bibliothèque</T>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="sparkles-outline" label="Créer avec l'IA" onPress={() => navigation.navigate('Create')} />
          <IconButton icon="add" size={28} label="Nouvelle playlist" onPress={() => setCreating(true)} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10, marginBottom: 6 }} accessibilityRole="tablist">
        <Chip label="Playlists" active={tab === 'playlists'} onPress={() => setTab('playlists')} />
        <Chip label="Historique" active={tab === 'history'} onPress={() => setTab('history')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {tab === 'history' ? (
          <History />
        ) : error ? (
          <ErrorState message={(error as Error).message} onRetry={refetch} />
        ) : isLoading ? (
          <SongListSkeleton rows={5} />
        ) : (
          <>
            <Row cover={<LikedTile size={56} />} title="Titres likés" subtitle={`Playlist · ${likedCount} titre${likedCount > 1 ? 's' : ''}`} onPress={() => navigation.navigate('Liked')} />
            {playlists?.map((p) => (
              <Row
                key={p.id}
                cover={<Mosaic ids={p.coverIds} size={56} />}
                title={p.name}
                subtitle={`${p.aiPrompt ? 'Créée par l’IA' : 'Playlist'} · ${p.songCount} titre${p.songCount > 1 ? 's' : ''}`}
                onPress={() => navigation.navigate('Playlist', { id: p.id })}
              />
            ))}
            {playlists?.length === 0 && (
              <View style={{ marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: c.overlay, gap: 8 }}>
                <T size={15} weight="700">Crée ta première playlist</T>
                <T tone="fg2" size={13}>Ou décris une ambiance et laisse l'IA la composer.</T>
                <Press onPress={() => navigation.navigate('Create')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="sparkles" size={16} color={c.accentFg} />
                  <T tone="accentFg" size={14} weight="700">Créer avec l'IA</T>
                </Press>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <CreatePlaylistSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}
