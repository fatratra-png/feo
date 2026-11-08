import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'feo_theme';

const systemDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

function apply(pref: ThemePref) {
  const theme = pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12100d' : '#f7f1e1');
  return theme;
}

const read = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
};

interface ThemeState {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const pref = read();
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (get().pref === 'system') set({ resolved: apply('system') });
    });
  }
  return {
    pref,
    resolved: typeof document !== 'undefined' ? apply(pref) : 'light',
    setPref: (p) => {
      try { p === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p); } catch { /* ignore */ }
      set({ pref: p, resolved: apply(p) });
    },
    toggle: () => get().setPref(get().resolved === 'dark' ? 'light' : 'dark'),
  };
});
