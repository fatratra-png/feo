import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, View } from 'react-native';
import { Platform as RNPlatform } from 'react-native';
import { formatTime } from '../lib/format';
import { usePlayerStore } from '../stores/player';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { navigationRef } from './sheets';
import { LikeButton } from './song';
import { Cover, IconButton, Press, T } from './ui';

/** Touch seek bar: drag to scrub (time updates live), seeks once on release. */
/** On web, a row that contains buttons must not itself be a <button> (invalid nesting). */
const OUTER_ROLE = RNPlatform.OS === 'web' ? undefined : ('button' as const);

export function ProgressBar() {
  const { c } = useTheme();
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration || s.queue[s.index]?.duration || 0);
  const [drag, setDrag] = useState<number | null>(null);
  const width = useRef(1);
  const durRef = useRef(duration);
  durRef.current = duration;

  const valueAt = (x: number) => Math.max(0, Math.min(1, x / width.current)) * durRef.current;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durRef.current > 0,
      onMoveShouldSetPanResponder: () => durRef.current > 0,
      onPanResponderGrant: (e) => setDrag(valueAt(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setDrag(valueAt(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => {
        usePlayerStore.getState().seek(valueAt(e.nativeEvent.locationX));
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  const shown = drag ?? position;
  const pct = duration ? Math.min(1, shown / duration) : 0;
  return (
    <View>
      <View
        {...pan.panHandlers}
        onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
        accessibilityRole="adjustable"
        accessibilityLabel="Position dans le titre"
        accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(shown), text: `${formatTime(shown)} sur ${formatTime(duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => usePlayerStore.getState().seek(Math.max(0, shown + (e.nativeEvent.actionName === 'increment' ? 10 : -10)))}
        style={{ height: 28, justifyContent: 'center' }}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.overlayStrong }}>
          <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: drag !== null ? c.accent : c.fg }} />
        </View>
        <View style={{ position: 'absolute', left: `${pct * 100}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: c.fg }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T tone="fg2" size={12}>{formatTime(shown)}</T>
        <T tone="fg2" size={12}>{formatTime(duration)}</T>
      </View>
    </View>
  );
}

export function PlayPause({ size = 64 }: { size?: number }) {
  const { c } = useTheme();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const buffering = usePlayerStore((s) => s.buffering && s.isPlaying);
  return (
    <Press
      onPress={() => usePlayerStore.getState().togglePlay()}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}
    >
      {buffering ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={size * 0.44} color={c.onAccent} style={{ marginLeft: isPlaying ? 0 : 3 }} />
      )}
    </Press>
  );
}

export function Transport() {
  const { c } = useTheme();
  const { shuffle, repeat, toggleShuffle, cycleRepeat, previous, next } = usePlayerStore();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton icon="shuffle" size={24} active={shuffle} label={shuffle ? 'Désactiver la lecture aléatoire' : 'Lecture aléatoire'} onPress={toggleShuffle} />
      <IconButton icon="play-skip-back" size={30} color={c.fg} label="Titre précédent" onPress={previous} />
      <PlayPause />
      <IconButton icon="play-skip-forward" size={30} color={c.fg} label="Titre suivant" onPress={() => next()} />
      <IconButton
        icon={repeat === 'one' ? 'repeat-outline' : 'repeat'}
        size={24}
        active={repeat !== 'off'}
        label={repeat === 'off' ? 'Répéter la file' : repeat === 'all' ? 'Répéter ce titre' : 'Désactiver la répétition'}
        onPress={cycleRepeat}
      />
    </View>
  );
}

/** Compact player pinned above the tab bar; tap opens the full-screen player. */
export function MiniPlayer() {
  const { c } = useTheme();
  const song = usePlayerStore((s) => s.queue[s.index] ?? null);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration || s.queue[s.index]?.duration || 0);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const buffering = usePlayerStore((s) => s.buffering && s.isPlaying);
  if (!song) return null;
  return (
    <Press
      onPress={() => navigationRef.isReady() && (navigationRef.navigate as (n: string) => void)('NowPlaying')}
      accessibilityRole={OUTER_ROLE}
      accessibilityLabel={`En cours : ${song.title}. Ouvrir le lecteur`}
      style={{ marginHorizontal: 8, marginBottom: 6, borderRadius: radius.md, backgroundColor: c.surface3, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 2 }}>
        <Cover id={song.id} size={42} rounded={radius.sm} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} size={14} weight="700">{song.title}</T>
          <T numberOfLines={1} tone="fg2" size={12}>{song.artist}</T>
        </View>
        <LikeButton song={song} />
        {buffering ? (
          <View style={{ width: 44, alignItems: 'center' }}><ActivityIndicator color={c.fg} /></View>
        ) : (
          <IconButton icon={isPlaying ? 'pause' : 'play'} size={26} color={c.fg} label={isPlaying ? 'Pause' : 'Lecture'} onPress={() => usePlayerStore.getState().togglePlay()} />
        )}
      </View>
      <View style={{ height: 2, marginHorizontal: 8, backgroundColor: c.overlayStrong }}>
        <View style={{ height: 2, width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%`, backgroundColor: c.fg }} />
      </View>
    </Press>
  );
}
