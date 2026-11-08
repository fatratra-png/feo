import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { T } from './ui';

/** Stable, pleasant hue per collection (native has no canvas to read cover colours). */
export function hueFor(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * Collection header: a vertical gradient tinted by the collection, big
 * centred cover, title and meta — same structure as the web header.
 */
export function CollectionHeader({
  eyebrow,
  title,
  description,
  meta,
  cover,
  seed,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: string;
  cover?: ReactNode;
  seed?: string;
  actions?: ReactNode;
}) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const hue = seed === undefined ? null : hueFor(seed);
  const top = hue === null ? (name === 'dark' ? '#5b4a0f' : '#fbe58a') : name === 'dark' ? `hsl(${hue}, 40%, 32%)` : `hsl(${hue}, 60%, 84%)`;
  return (
    <LinearGradient colors={[top, c.bg]} locations={[0, 0.95]} style={{ paddingTop: insets.top + 56, paddingHorizontal: 16, paddingBottom: 8 }}>
      {cover ? <View style={{ alignSelf: 'center', width: 210, marginBottom: 20 }}>{cover}</View> : null}
      <T size={12} weight="800" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{eyebrow}</T>
      <T size={30} style={[font.display, { marginTop: 6 }]} accessibilityRole="header">{title}</T>
      {description ? <T tone="fg2" size={14} style={{ marginTop: 6 }}>{description}</T> : null}
      {meta ? <T size={13} weight="600" style={{ marginTop: 6 }}>{meta}</T> : null}
      {actions ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>{actions}</View> : null}
    </LinearGradient>
  );
}
