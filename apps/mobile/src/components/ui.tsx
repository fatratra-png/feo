import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { coverUrl } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------------- text ---------------- */

type Tone = 'fg' | 'fg2' | 'fg3' | 'accentFg' | 'onAccent' | 'danger';

export function T({ tone = 'fg', size = 15, weight, style, ...rest }: TextProps & { tone?: Tone; size?: number; weight?: TextStyle['fontWeight'] }) {
  const { c } = useTheme();
  return <Text {...rest} style={[{ color: c[tone], fontSize: size, fontWeight: weight }, style]} />;
}

export function Logo({ size = 30 }: { size?: number }) {
  const { c, name } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontSize: size, ...font.display, color: name === 'dark' ? c.accent : c.fg }}>
      FEO<Text style={{ color: c.accent }}>.</Text>
    </Text>
  );
}

/* ---------------- buttons ---------------- */

/** Pressable with a subtle scale on press (no shadows: flat design). */
export function Press({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? '#fff' : c.fg;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        {
          height: size === 'sm' ? 36 : 46,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          borderRadius: radius.full,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.lineStrong,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: size === 'sm' ? 14 : 15, ...font.bold }}>{label}</Text>
    </Press>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 22,
  active,
  color,
  disabled,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  active?: boolean;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={6}
      style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? (active ? c.accentFg : c.fg2)} />
      {active && <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: c.accentFg }} />}
    </Press>
  );
}

export function PlayButton({ playing, onPress, size = 56, label }: { playing: boolean; onPress: () => void; size?: number; label?: string }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? (playing ? 'Pause' : 'Lecture')}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={playing ? 'pause' : 'play'} size={size * 0.42} color={c.onAccent} style={{ marginLeft: playing ? 0 : 3 }} />
    </Press>
  );
}

/* ---------------- covers ---------------- */

export function Cover({ id, size, rounded = radius.sm, hd = false, style }: { id?: string; size?: number; rounded?: number; hd?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ width: size ?? '100%', aspectRatio: 1, borderRadius: rounded, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }, style]}>
      {id ? (
        <Image source={{ uri: coverUrl(id, hd ? 'lg' : 'sm') }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} cachePolicy="memory-disk" accessibilityIgnoresInvertColors />
      ) : (
        <Ionicons name="musical-notes" size={(size ?? 120) * 0.35} color={c.fg3} />
      )}
    </View>
  );
}

/** 2×2 mosaic for playlists and mixes. */
export function Mosaic({ ids, size, rounded = radius.sm }: { ids: string[]; size?: number; rounded?: number }) {
  const { c } = useTheme();
  if (ids.length < 4) return <Cover id={ids[0]} size={size} rounded={rounded} />;
  return (
    <View style={{ width: size ?? '100%', aspectRatio: 1, borderRadius: rounded, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.surface3 }}>
      {ids.slice(0, 4).map((id) => (
        <View key={id} style={{ width: '50%', height: '50%' }}>
          <Cover id={id} rounded={0} />
        </View>
      ))}
    </View>
  );
}

/* ---------------- feedback ---------------- */

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T size={22} style={font.title} accessibilityRole="header">{title}</T>
        {subtitle ? <T tone="fg2" size={13} style={{ marginTop: 2 }}>{subtitle}</T> : null}
      </View>
      {action}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name={icon} size={28} color={c.accentFg} />
      </View>
      <T size={19} style={[font.title, { textAlign: 'center' }]}>{title}</T>
      {body ? <T tone="fg2" size={14} style={{ marginTop: 6, textAlign: 'center' }}>{body}</T> : null}
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <EmptyState icon="alert-circle-outline" title="Oups, ça n'a pas marché" body={message} action={onRetry && <Button label="Réessayer" onPress={onRetry} />} />;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: c.surface3, borderRadius: radius.sm, opacity }, style]} />;
}

export function SongListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Chargement" style={{ gap: 14, paddingVertical: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton style={{ width: 48, height: 48 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 13, width: '55%' }} />
            <Skeleton style={{ height: 11, width: '35%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Three animated bars shown on the song that is playing. */
export function Equalizer({ playing, color }: { playing: boolean; color?: string }) {
  const { c } = useTheme();
  const bars = [useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.8)).current, useRef(new Animated.Value(0.5)).current];
  useEffect(() => {
    if (!playing) {
      bars.forEach((b) => b.setValue(0.4));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(b, { toValue: 1, duration: 380 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(b, { toValue: 0.25, duration: 380 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 14, gap: 2 }} accessibilityElementsHidden>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color ?? c.accentFg, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

/* ---------------- inputs ---------------- */

export function Field({ label, error, hint, ...rest }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="700">{label}</T>
      <TextInput
        placeholderTextColor={c.fg3}
        accessibilityLabel={label}
        {...rest}
        style={[{ height: 50, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: error ? c.danger : c.line, paddingHorizontal: 16, fontSize: 16, color: c.fg }, rest.style]}
      />
      {error ? <T tone="danger" size={13} accessibilityLiveRegion="polite">{error}</T> : hint ? <T tone="fg3" size={12}>{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, onPress, icon, active }: { label: string; onPress: () => void; icon?: IconName; active?: boolean }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: radius.full, backgroundColor: active ? c.accent : c.overlay }}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? c.onAccent : c.fg2} />}
      <T size={13} weight="600" tone={active ? 'onAccent' : 'fg'}>{label}</T>
    </Press>
  );
}
