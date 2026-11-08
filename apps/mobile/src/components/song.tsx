import { Ionicons } from '@expo/vector-icons';
import { memo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Platform as RNPlatform } from 'react-native';
import { useLikedIds, useToggleLike } from '../hooks/library';
import { formatTime } from '../lib/format';
import type { Mix, PlaylistSummary, Song } from '../lib/types';
import { usePlayerStore, type PlayContext } from '../stores/player';
import { useUiStore, type SongSheetOptions } from '../stores/ui';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';
import { Cover, Equalizer, IconButton, Mosaic, Press, T } from './ui';

/** On web, a row that contains buttons must not itself be a <button> (invalid nesting). */
const OUTER_ROLE = RNPlatform.OS === 'web' ? undefined : ('button' as const);

export function LikeButton({ song, size = 22 }: { song: Song; size?: number }) {
  const { c } = useTheme();
  const liked = useLikedIds().has(song.id);
  const toggle = useToggleLike();
  return (
    <IconButton
      icon={liked ? 'heart' : 'heart-outline'}
      size={size}
      color={liked ? c.accentFg : c.fg2}
      label={liked ? 'Retirer des titres likés' : 'Ajouter aux titres likés'}
      onPress={() => toggle.mutate({ song, liked: !liked })}
    />
  );
}

interface RowProps {
  song: Song;
  index: number;
  active: boolean;
  playing: boolean;
  onPress: () => void;
  showIndex?: boolean;
  showReason?: boolean;
  sheet?: Omit<SongSheetOptions, 'song'>;
}

export const SongRow = memo(function SongRow({ song, index, active, playing, onPress, showIndex, showReason, sheet }: RowProps) {
  const { c } = useTheme();
  const openSheet = () => useUiStore.getState().openSongSheet({ song, ...sheet });
  return (
    <Press
      onPress={onPress}
      onLongPress={openSheet}
      accessibilityRole={OUTER_ROLE}
      accessibilityLabel={`${song.title}, ${song.artist}`}
      accessibilityHint="Appui long pour plus d'options"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
    >
      {showIndex && (
        <View style={{ width: 22, alignItems: 'center' }}>
          {active ? <Equalizer playing={playing} /> : <T tone="fg3" size={14}>{index + 1}</T>}
        </View>
      )}
      <View>
        <Cover id={song.id} size={50} />
        {active && !showIndex && (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm }}>
            <Equalizer playing={playing} color="#f8d02e" />
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} size={15} weight="600" tone={active ? 'accentFg' : 'fg'}>{song.title}</T>
        <T numberOfLines={1} tone="fg2" size={13} style={{ marginTop: 2 }}>
          {song.artist}
          {song.duration ? ` · ${formatTime(song.duration)}` : ''}
        </T>
        {showReason && song.reason ? (
          <T numberOfLines={1} tone="fg3" size={12} style={{ marginTop: 2 }}>
            <Ionicons name="sparkles" size={11} color={c.accentFg} /> {song.reason}
          </T>
        ) : null}
      </View>
      <IconButton icon="ellipsis-vertical" size={18} label={`Plus d'options pour ${song.title}`} onPress={openSheet} />
    </Press>
  );
});

/** Plays in context on tap; knows which song is currently playing. */
export function SongList({
  songs,
  context,
  showIndex,
  showReason,
  onPlay,
  sheetFor,
}: {
  songs: Song[];
  context?: PlayContext | null;
  showIndex?: boolean;
  showReason?: boolean;
  onPlay?: (index: number) => void;
  sheetFor?: (song: Song, index: number) => Omit<SongSheetOptions, 'song'>;
}) {
  const currentId = usePlayerStore((s) => s.queue[s.index]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  return (
    <View>
      {songs.map((song, i) => (
        <SongRow
          key={`${song.id}-${i}`}
          song={song}
          index={i}
          active={song.id === currentId}
          playing={isPlaying}
          showIndex={showIndex}
          showReason={showReason}
          sheet={sheetFor?.(song, i)}
          onPress={() => {
            const p = usePlayerStore.getState();
            if (song.id === currentId) return p.togglePlay();
            if (onPlay) return onPlay(i);
            p.playSongs(songs, i, context ?? null);
          }}
        />
      ))}
    </View>
  );
}

/* ---------------- cards ---------------- */

export function MediaCard({
  cover,
  title,
  subtitle,
  onPress,
  badge,
  width = 150,
}: {
  cover: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  badge?: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string };
  width?: number;
}) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`} style={{ width }}>
      <View>
        {cover}
        {badge && (
          <View style={{ position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.accent, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Ionicons name={badge.icon} size={10} color={c.onAccent} />
            <T size={10} weight="800" tone="onAccent">{badge.label}</T>
          </View>
        )}
      </View>
      <T numberOfLines={1} size={14} weight="700" style={{ marginTop: 8 }}>{title}</T>
      {subtitle ? <T numberOfLines={2} tone="fg2" size={12} style={{ marginTop: 2 }}>{subtitle}</T> : null}
    </Press>
  );
}

export const MixCard = ({ mix, onPress }: { mix: Mix; onPress: () => void }) => (
  <MediaCard
    cover={<Mosaic ids={mix.coverIds} />}
    title={mix.title}
    subtitle={mix.subtitle}
    onPress={onPress}
    badge={mix.kind === 'ai' ? { icon: 'sparkles', label: 'IA' } : mix.kind === 'radio' ? { icon: 'radio', label: 'Radio' } : undefined}
  />
);

export const PlaylistCard = ({ playlist, onPress, width }: { playlist: PlaylistSummary; onPress: () => void; width?: number }) => (
  <MediaCard
    width={width}
    cover={<Mosaic ids={playlist.coverIds} />}
    title={playlist.name}
    subtitle={`${playlist.aiPrompt ? 'IA · ' : ''}${playlist.songCount} titre${playlist.songCount > 1 ? 's' : ''}`}
    onPress={onPress}
    badge={playlist.aiPrompt ? { icon: 'sparkles', label: 'IA' } : undefined}
  />
);

export function LikedTile({ size }: { size?: number }) {
  return (
    <View style={{ width: size ?? '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: '#f8d02e', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="heart" size={(size ?? 150) * 0.33} color="#121212" />
    </View>
  );
}

export function QuickTile({ song, onPress, active, playing }: { song: Song; onPress: () => void; active: boolean; playing: boolean }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lire ${song.title}`}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: active ? c.overlayStrong : c.overlay }}
    >
      <Cover id={song.id} size={56} rounded={0} />
      <T numberOfLines={2} size={13} weight="700" tone={active ? 'accentFg' : 'fg'} style={{ flex: 1, paddingRight: 8 }}>{song.title}</T>
      {active && <View style={{ paddingRight: 10 }}><Equalizer playing={playing} /></View>}
    </Press>
  );
}

export function CardRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
      {children}
    </ScrollView>
  );
}

export function SectionGap() {
  return <View style={{ height: 28 }} />;
}

export const titleStyle = font.title;
