import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../lib/storage';
import { palettes, type Palette, type ThemeName } from './tokens';

export type ThemePref = ThemeName | 'system';

interface ThemeCtx {
  c: Palette;
  name: ThemeName;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'feo_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'light' ? 'light' : 'dark';
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    storage.get(KEY).then((v) => { if (v === 'light' || v === 'dark') setPrefState(v); });
  }, []);

  const value = useMemo<ThemeCtx>(() => {
    const name: ThemeName = pref === 'system' ? system : pref;
    return {
      c: palettes[name],
      name,
      pref,
      setPref: (p) => {
        setPrefState(p);
        void (p === 'system' ? storage.remove(KEY) : storage.set(KEY, p));
      },
    };
  }, [pref, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Forces the dark palette for a subtree (the full-screen player is always dark). */
export function DarkTheme({ children }: { children: ReactNode }) {
  const parent = useTheme();
  return <Ctx.Provider value={{ ...parent, c: palettes.dark, name: 'dark' }}>{children}</Ctx.Provider>;
}
