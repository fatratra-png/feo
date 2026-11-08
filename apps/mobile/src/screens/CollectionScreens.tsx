import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CollectionHeader } from '../components/CollectionHeader';
import { CreatePlaylistSheet, Sheet } from '../components/sheets';
import { LikedTile, SongList } from '../components/song';
import { Button, EmptyState, ErrorState, Field, IconButton, Mosaic, PlayButton, SongListSkeleton } from '../components/ui';
import { api } from '../lib/api';
import { formatTotal, relativeTime } from '../lib/format';
import type { Playlist, Song } from '../lib/types';
import { usePlayerStore, type PlayContext } from '../stores/player';
import { toast, useUiStore } from '../stores/ui';
import { useTheme } from '../theme/ThemeProvider';

function BackButton({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }} pointerEvents="box-none">
      <IconButton icon="chevron-back" size={26} label="Retour" onPress={() => navigation.goBack()} style={{ marginTop: insets.top + 6, marginLeft: 4 }} />
    </View>
  );
}

function PlayActions({ songs, context, extra }: { songs: Song[]; context: PlayContext; extra?: React.ReactNode }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying && s.context?.label === context.label);
  const active = usePlayerStore((s) => s.context?.label === context.label);
  return (
    <>
      <IconButton icon="shuffle" size={26} label="Lecture aléatoire" disabled={!songs.length} onPress={() => usePlayerStore.getState().playShuffled(songs, context)} />
      <IconButton icon="add-circle-outline" size={26} label="Tout ajouter à une playlist" disabled={!songs.length} onPress={() => useUiStore.getState().openAddToPlaylist(songs)} />
      {extra}
      <View style={{ flex: 1 }} />
      <PlayButton
        playing={isPlaying}
        label={isPlaying ? 'Pause' : `Lire ${context.label}`}
        onPress={() => (active ? usePlayerStore.getState().togglePlay() : songs.length && usePlayerStore.getState().playSongs(songs, 0, context))}
      />
    </>
  );
}

const confirm = (title: string, message: string, onOk: () => void) => {
  if (Platform.OS === 'web') { if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk(); return; }
  Alert.alert(title, message, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: onOk }]);
};

/* ------------------------------------------------------------------ */

export function PlaylistScreen({ route, navigation }: any) {
  const { c } = useTheme();
  const id: string = route.params.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: pl, isLoading, error, refetch } = useQuery({ queryKey: ['playlist', id], queryFn: () => api.playlists.get(id) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['playlist', id] });
    qc.invalidateQueries({ queryKey: ['playlists'] });
    qc.invalidateQueries({ queryKey: ['home'] });
  };

  const remove = useMutation({
    mutationFn: (song: Song) => api.playlists.removeSong(id, song.id),
    onMutate: (song) => qc.setQueryData<Playlist>(['playlist', id], (p) => (p ? { ...p, songs: p.songs.filter((s) => s.id !== song.id), songCount: p.songCount - 1 } : p)),
    onSuccess: (_d, song) => {
      invalidate();
      toast(`« ${song.title} » retiré`, { action: { label: 'Annuler', run: () => api.playlists.addSongs(id, [song]).then(invalidate) } });
    },
    onError: (err: Error) => { toast(err.message, { tone: 'error' }); invalidate(); },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.playlists.reorder(id, ids),
    onSuccess: invalidate,
    onError: (err: Error) => { toast(err.message, { tone: 'error' }); invalidate(); },
  });
  const move = (from: number, to: number) => {
    if (!pl) return;
    const songs = [...pl.songs];
    const [s] = songs.splice(from, 1);
    songs.splice(to, 0, s);
    qc.setQueryData<Playlist>(['playlist', id], { ...pl, songs });
    reorder.mutate(songs.map((x) => x.id));
  };

  const del = useMutation({
    mutationFn: () => api.playlists.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      toast('Playlist supprimée');
      navigation.goBack();
    },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });

  if (error) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 80 }}><BackButton navigation={navigation} /><ErrorState message={(error as Error).message} onRetry={refetch} /></View>;
  if (isLoading || !pl) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 16, paddingTop: 100 }}><BackButton navigation={navigation} /><SongListSkeleton /></View>;

  const context = { label: pl.name };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackButton navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <CollectionHeader
          eyebrow={pl.aiPrompt ? 'Playlist créée par l’IA' : 'Playlist'}
          title={pl.name}
          description={pl.description || (pl.aiPrompt ? `« ${pl.aiPrompt} »` : undefined)}
          meta={`${pl.songCount} titre${pl.songCount > 1 ? 's' : ''}${pl.duration ? ` · ${formatTotal(pl.duration)}` : ''} · modifiée ${relativeTime(pl.updatedAt)}`}
          cover={<Mosaic ids={pl.coverIds} />}
          seed={pl.id}
          actions={
            <PlayActions
              songs={pl.songs}
              context={context}
              extra={
                <>
                  <IconButton icon="create-outline" size={24} label="Modifier les détails" onPress={() => setEditing(true)} />
                  <IconButton icon="trash-outline" size={24} label="Supprimer la playlist" onPress={() => confirm('Supprimer la playlist ?', `« ${pl.name} » sera définitivement supprimée.`, () => del.mutate())} />
                </>
              }
            />
          }
        />
        <View style={{ paddingHorizontal: 16 }}>
          {pl.songs.length === 0 ? (
            <EmptyState icon="musical-notes-outline" title="Cette playlist est vide" body="Ajoute des titres depuis la recherche avec le menu ⋮." action={<Button label="Chercher des titres" variant="primary" onPress={() => navigation.navigate('Tabs', { screen: 'Search' })} />} />
          ) : (
            <SongList
              songs={pl.songs}
              context={context}
              sheetFor={(_song, i) => ({
                onRemove: () => remove.mutate(pl.songs[i]),
                move: { up: i > 0 ? () => move(i, i - 1) : undefined, down: i < pl.songs.length - 1 ? () => move(i, i + 1) : undefined },
              })}
            />
          )}
        </View>
      </ScrollView>
      <EditSheet visible={editing} onClose={() => setEditing(false)} playlist={pl} onSaved={invalidate} />
    </View>
  );
}

function EditSheet({ visible, onClose, playlist, onSaved }: { visible: boolean; onClose: () => void; playlist: Playlist; onSaved: () => void }) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description);
  const save = useMutation({
    mutationFn: () => api.playlists.update(playlist.id, { name: name.trim(), description }),
    onSuccess: () => { onSaved(); onClose(); toast('Modifications enregistrées', { tone: 'success' }); },
    onError: (err: Error) => toast(err.message, { tone: 'error' }),
  });
  return (
    <Sheet visible={visible} onClose={onClose} title="Modifier la playlist">
      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 8 }}>
        <Field label="Nom" value={name} onChangeText={setName} maxLength={120} />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={500} />
        <Button label="Enregistrer" variant="primary" disabled={!name.trim()} loading={save.isPending} onPress={() => save.mutate()} />
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

export function LikedScreen({ navigation }: any) {
  const { c } = useTheme();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['likes'], queryFn: api.likes.list });
  const songs = data?.songs ?? [];
  const context = { label: 'Titres likés' };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackButton navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <CollectionHeader
          eyebrow="Collection"
          title="Titres likés"
          meta={`${songs.length} titre${songs.length > 1 ? 's' : ''}${songs.length ? ` · ${formatTotal(songs.reduce((n, s) => n + s.duration, 0))}` : ''}`}
          cover={<LikedTile />}
          actions={songs.length ? <PlayActions songs={songs} context={context} /> : undefined}
        />
        <View style={{ paddingHorizontal: 16 }}>
          {error ? (
            <ErrorState message={(error as Error).message} onRetry={refetch} />
          ) : isLoading ? (
            <SongListSkeleton />
          ) : songs.length === 0 ? (
            <EmptyState icon="heart-outline" title="Aucun titre liké" body="Touche le cœur sur un titre pour le retrouver ici. Tes likes aident aussi l'IA." />
          ) : (
            <SongList songs={songs} context={context} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */

export function MixScreen({ route, navigation }: any) {
  const { c } = useTheme();
  const { id, title = 'Mix', subtitle = '' } = route.params as { id: string; title?: string; subtitle?: string };
  const [saving, setSaving] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['mix', id], queryFn: () => api.mix(id), staleTime: 30 * 60_000 });
  const songs = data?.songs ?? [];
  const isAi = id.startsWith('ai-');
  const context = { label: title };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackButton navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <CollectionHeader
          eyebrow={isAi ? 'Mix IA personnalisé' : id.startsWith('radio-') ? 'Radio' : 'Mix'}
          title={title}
          description={subtitle}
          meta={songs.length ? `${songs.length} titres · ${formatTotal(songs.reduce((n, s) => n + s.duration, 0))}` : undefined}
          cover={<Mosaic ids={songs.slice(0, 4).map((s) => s.id)} />}
          seed={id}
          actions={songs.length ? <PlayActions songs={songs} context={context} extra={<IconButton icon="bookmark-outline" size={24} label="Enregistrer comme playlist" onPress={() => setSaving(true)} />} /> : undefined}
        />
        <View style={{ paddingHorizontal: 16 }}>
          {error ? <ErrorState message={(error as Error).message} onRetry={refetch} /> : isLoading ? <SongListSkeleton /> : <SongList songs={songs} context={context} showReason />}
        </View>
      </ScrollView>
      <CreatePlaylistSheet visible={saving} onClose={() => setSaving(false)} initialSongs={songs} initialName={title} description={subtitle} aiPrompt={isAi ? title : undefined} />
    </View>
  );
}
