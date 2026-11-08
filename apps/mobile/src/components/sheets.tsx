import { Ionicons } from '@expo/vector-icons';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAddToPlaylist, useLikedIds, usePlaylists, useToggleLike } from '../hooks/library';
import { api } from '../lib/api';
import type { Song } from '../lib/types';
import { usePlayerStore } from '../stores/player';
import { toast, useUiStore } from '../stores/ui';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';
import { Button, Cover, Field, Mosaic, Press, T, type IconName } from './ui';

export const navigationRef = createNavigationContainerRef<any>();
const navigate = (name: string, params?: object) => {
  if (navigationRef.isReady()) (navigationRef.navigate as (n: string, p?: object) => void)(name, params);
};

/** Bottom sheet: dimmed backdrop, tap outside or "back" to close. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={{ backgroundColor: c.surface2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 12, maxHeight: '85%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginTop: 10, marginBottom: 6 }} />
          {title ? <T size={18} style={[font.title, { paddingHorizontal: 20, paddingVertical: 10 }]} accessibilityRole="header">{title}</T> : null}
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetItem({ icon, label, onPress, danger, disabled }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon} size={22} color={danger ? c.danger : c.fg2} />
      <T size={15} weight="600" tone={danger ? 'danger' : 'fg'}>{label}</T>
    </Press>
  );
}

export function SongSheet() {
  const { c } = useTheme();
  const opts = useUiStore((s) => s.songSheet);
  const close = useUiStore((s) => s.closeSongSheet);
  const liked = useLikedIds().has(opts?.song.id ?? '');
  const toggleLike = useToggleLike();
  if (!opts) return <Sheet visible={false} onClose={close}><View /></Sheet>;
  const { song } = opts;
  const run = (fn: () => void) => () => { close(); fn(); };
  const mainArtist = song.artist.split(',')[0];

  const startRadio = async () => {
    toast(`Radio « ${song.title} » en préparation…`);
    try {
      const res = await api.radio([song], [], false, 20);
      usePlayerStore.getState().playSongs([song, ...res.songs], 0, { label: `Radio · ${song.title}` });
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  };

  return (
    <Sheet visible onClose={close}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Cover id={song.id} size={48} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={1} size={15} weight="700">{song.title}</T>
          <T numberOfLines={1} tone="fg2" size={13}>{song.artist}</T>
        </View>
      </View>
      <SheetItem icon={liked ? 'heart' : 'heart-outline'} label={liked ? 'Retirer des titres likés' : 'Ajouter aux titres likés'} onPress={run(() => toggleLike.mutate({ song, liked: !liked }))} />
      <SheetItem icon="add-circle-outline" label="Ajouter à une playlist" onPress={() => useUiStore.getState().openAddToPlaylist([song])} />
      <SheetItem icon="return-down-forward" label="Lire ensuite" onPress={run(() => { usePlayerStore.getState().playNext(song); toast('Lecture juste après le titre en cours'); })} />
      <SheetItem icon="list" label="Ajouter à la file d'attente" onPress={run(() => { usePlayerStore.getState().addToQueue([song]); toast("Ajouté à la file d'attente"); })} />
      <SheetItem icon="radio-outline" label="Lancer la radio du titre" onPress={run(startRadio)} />
      <SheetItem icon="person-outline" label={`Plus de ${mainArtist}`} onPress={run(() => navigate('Tabs', { screen: 'Search', params: { q: mainArtist } }))} />
      {opts.move?.up || opts.move?.down ? (
        <>
          <SheetItem icon="arrow-up" label="Monter" disabled={!opts.move.up} onPress={run(() => opts.move?.up?.())} />
          <SheetItem icon="arrow-down" label="Descendre" disabled={!opts.move.down} onPress={run(() => opts.move?.down?.())} />
        </>
      ) : null}
      {opts.onRemove ? <SheetItem icon="trash-outline" danger label={opts.removeLabel ?? 'Retirer de cette playlist'} onPress={run(opts.onRemove)} /> : null}
    </Sheet>
  );
}

export function CreatePlaylistSheet({
  visible,
  onClose,
  initialSongs,
  initialName = '',
  description: initialDescription = '',
  aiPrompt,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  initialSongs?: Song[];
  initialName?: string;
  description?: string;
  aiPrompt?: string;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) { setName(initialName); setDescription(initialDescription); setError(undefined); }
  }, [visible, initialName, initialDescription]);

  const create = useMutation({
    mutationFn: () => api.playlists.create({ name: name.trim(), description, aiPrompt, songs: initialSongs }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      toast(`Playlist « ${name.trim()} » créée`, { tone: 'success' });
      onClose();
      onCreated ? onCreated(id) : navigate('Playlist', { id });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Sheet visible={visible} onClose={onClose} title={initialSongs?.length ? 'Enregistrer comme playlist' : 'Nouvelle playlist'}>
      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 8 }}>
        <Field label="Nom" value={name} onChangeText={(v) => { setName(v); setError(undefined); }} placeholder="Ma playlist" maxLength={120} error={error} autoFocus returnKeyType="done" />
        <Field label="Description (facultatif)" value={description} onChangeText={setDescription} maxLength={500} />
        {initialSongs?.length ? <T tone="fg2" size={13}>{initialSongs.length} titre{initialSongs.length > 1 ? 's' : ''} seront ajoutés.</T> : null}
        <Button label="Créer" variant="primary" loading={create.isPending} onPress={() => (name.trim() ? create.mutate() : setError('Donne un nom à ta playlist'))} />
      </View>
    </Sheet>
  );
}

export function AddToPlaylistSheet() {
  const { c } = useTheme();
  const songs = useUiStore((s) => s.addToPlaylist);
  const close = useUiStore((s) => s.closeAddToPlaylist);
  const { data: playlists } = usePlaylists();
  const add = useAddToPlaylist();
  const [creating, setCreating] = useState(false);

  if (creating && songs) {
    return (
      <CreatePlaylistSheet
        visible
        onClose={() => { setCreating(false); close(); }}
        initialSongs={songs}
        initialName={songs.length === 1 ? songs[0].title : ''}
      />
    );
  }

  return (
    <Sheet visible={Boolean(songs)} onClose={close} title="Ajouter à une playlist">
      <Press onPress={() => setCreating(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 10 }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.overlayStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={26} color={c.fg} />
        </View>
        <T size={15} weight="700">Nouvelle playlist</T>
      </Press>
      {playlists?.map((p) => (
        <Press
          key={p.id}
          disabled={add.isPending}
          onPress={() => songs && add.mutate({ playlistId: p.id, songs, name: p.name }, { onSuccess: close })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 8 }}
        >
          <Mosaic ids={p.coverIds} size={52} />
          <View style={{ flex: 1 }}>
            <T numberOfLines={1} size={15} weight="600">{p.name}</T>
            <T tone="fg2" size={12}>{p.aiPrompt ? 'IA · ' : ''}{p.songCount} titre{p.songCount > 1 ? 's' : ''}</T>
          </View>
        </Press>
      ))}
    </Sheet>
  );
}

export function Toaster({ bottom }: { bottom: number }) {
  const { c } = useTheme();
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom, gap: 8 }}>
      {toasts.map((t) => (
        <View
          key={t.id}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.fg, borderRadius: radius.md, paddingVertical: 12, paddingLeft: 14, paddingRight: 6 }}
        >
          <Ionicons name={t.tone === 'success' ? 'checkmark-circle' : t.tone === 'error' ? 'alert-circle' : 'information-circle'} size={18} color={t.tone === 'success' ? '#f8d02e' : t.tone === 'error' ? '#ff8a7a' : c.bg} />
          <T size={14} weight="600" style={{ flex: 1, color: c.bg }}>{t.message}</T>
          {t.action && (
            <Press onPress={() => { t.action!.run(); dismiss(t.id); }} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
              <T size={14} weight="800" style={{ color: c.bg, textDecorationLine: 'underline' }}>{t.action.label}</T>
            </Press>
          )}
        </View>
      ))}
    </View>
  );
}
