/**
 * Same design tokens as the web app (apps/web/src/styles/index.css):
 * flat, content-first, FEO yellow as the single accent.
 */
export const palettes = {
  light: {
    bg: '#ebebeb',
    surface: '#ffffff',
    surface2: '#f4f4f4',
    surface3: '#e6e6e6',
    fg: '#121212',
    fg2: '#5c5c5c',
    fg3: '#737373',
    line: 'rgba(0,0,0,0.08)',
    lineStrong: 'rgba(0,0,0,0.2)',
    overlay: 'rgba(0,0,0,0.06)',
    overlayStrong: 'rgba(0,0,0,0.12)',
    accent: '#f8d02e',
    accentFg: '#7d5800',
    onAccent: '#121212',
    danger: '#c62828',
    scrim: 'rgba(0,0,0,0.45)',
  },
  dark: {
    bg: '#000000',
    surface: '#121212',
    surface2: '#1f1f1f',
    surface3: '#2a2a2a',
    fg: '#ffffff',
    fg2: '#b3b3b3',
    fg3: '#8f8f8f',
    line: 'rgba(255,255,255,0.08)',
    lineStrong: 'rgba(255,255,255,0.2)',
    overlay: 'rgba(255,255,255,0.07)',
    overlayStrong: 'rgba(255,255,255,0.13)',
    accent: '#f8d02e',
    accentFg: '#f8d02e',
    onAccent: '#121212',
    danger: '#ff6b5e',
    scrim: 'rgba(0,0,0,0.7)',
  },
};

export type Palette = typeof palettes.light;
export type ThemeName = keyof typeof palettes;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 999 };
export const space = (n: number) => n * 4;

export const font = {
  /** System fonts keep the app light; weights carry the hierarchy. */
  display: { fontWeight: '900' as const, letterSpacing: -0.8 },
  title: { fontWeight: '800' as const, letterSpacing: -0.4 },
  bold: { fontWeight: '700' as const },
  semibold: { fontWeight: '600' as const },
};
