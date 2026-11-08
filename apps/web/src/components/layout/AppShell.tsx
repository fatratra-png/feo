import { ChevronLeft, ChevronRight, Heart, Home, Library, LogOut, Monitor, Moon, Plus, Search, Sparkles, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLikedIds, usePlaylists } from '../../hooks/library';
import { useKeyboard } from '../../hooks/useKeyboard';
import { cn, pluralize } from '../../lib/format';
import { useAuthStore } from '../../stores/auth';
import { usePlayerStore } from '../../stores/player';
import { useThemeStore } from '../../stores/theme';
import { AudioEngine } from '../player/AudioEngine';
import { NowPlaying } from '../player/NowPlaying';
import { PlayerBar } from '../player/PlayerBar';
import { IconButton } from '../ui/Button';
import { Mosaic } from '../ui/Cover';
import { Toaster } from '../ui/Feedback';
import { Menu } from '../ui/Menu';
import { AddToPlaylistDialog, CreatePlaylistDialog } from './PlaylistDialogs';

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/create', label: 'Créer avec l’IA', short: 'IA', icon: Sparkles },
  { to: '/library', label: 'Bibliothèque', icon: Library },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('wordmark inline-block text-[30px] leading-none select-none', className)}>FEO<span className="dot">.</span></span>
  );
}

function Sidebar({ onCreate }: { onCreate: () => void }) {
  const { data: playlists } = usePlaylists();
  const likedCount = useLikedIds().size;
  const location = useLocation();

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-[280px] flex-col gap-2 p-2 md:flex [.has-player_&]:bottom-[80px]">
      <nav className="rounded-lg bg-surface px-3 pt-5 pb-3" aria-label="Navigation principale">
        <Link to="/" className="mb-5 block px-3" aria-label="FEO, accueil"><Logo /></Link>
        <ul className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-4 rounded-md px-3 py-2.5 text-[15px] font-bold transition-colors duration-150',
                    isActive ? 'text-fg' : 'text-fg-2 hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface" aria-label="Tes playlists">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg-2"><Library className="size-5" aria-hidden /> Ta bibliothèque</h2>
          <IconButton label="Nouvelle playlist" size="sm" onClick={onCreate}>
            <Plus className="size-5" />
          </IconButton>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          <li>
            <Link
              to="/liked"
              className={cn('flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-fg/[0.05]', location.pathname === '/liked' && 'bg-fg/[0.07]')}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-accent">
                <Heart className="size-4 fill-on-accent text-on-accent" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Titres likés</span>
                <span className="block truncate text-xs text-fg-3">{pluralize(likedCount, 'titre')}</span>
              </span>
            </Link>
          </li>
          {playlists?.map((p) => (
            <li key={p.id}>
              <Link
                to={`/playlist/${p.id}`}
                className={cn('flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-fg/[0.05]', location.pathname === `/playlist/${p.id}` && 'bg-fg/[0.07]')}
              >
                <Mosaic ids={p.coverIds} className="size-11" rounded="rounded-lg" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-fg-3">
                    {p.aiPrompt ? 'IA · ' : ''}{pluralize(p.songCount, 'titre')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {playlists && playlists.length === 0 && (
            <li className="mx-2 mt-2 rounded-xl bg-fg/[0.04] p-4 text-sm text-fg-2">
              Crée ta première playlist, ou demande-en une à l'IA.
              <Link to="/create" className="mt-3 flex items-center gap-2 font-semibold text-accent-fg hover:underline">
                <Sparkles className="size-4" aria-hidden /> Créer avec l'IA
              </Link>
            </li>
          )}
        </ul>
      </section>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg via-bg/95 to-bg/80 pb-safe md:hidden" aria-label="Navigation principale">
      <ul className="grid h-[4.25rem] grid-cols-4">
        {NAV.map(({ to, label, short, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors', isActive ? 'text-fg' : 'text-fg-3')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-6" strokeWidth={isActive ? 2.6 : 2} aria-hidden />
                  {short ?? label.split(' ')[0]}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One tap toggles light/dark; the account menu also offers "follow the system". */
function ThemeToggle() {
  const resolved = useThemeStore((s) => s.resolved);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = resolved === 'dark';
  return (
    <IconButton label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'} onClick={toggle} className="bg-fg/[0.08]">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </IconButton>
  );
}

function TopBar({ scrolled }: { scrolled: boolean }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  return (
    <div
      className={cn(
        'sticky top-0 z-20 flex h-16 items-center justify-between gap-3 px-4 transition-[background,backdrop-filter] duration-300 sm:px-6',
        scrolled ? 'glass border-b border-line' : 'bg-transparent',
      )}
    >
      <div className="flex items-center gap-1">
        <Link to="/" className="md:hidden" aria-label="FEO, accueil"><Logo className="text-2xl" /></Link>
        <div className="hidden gap-1 md:flex">
          <IconButton label="Page précédente" size="sm" className="bg-fg/[0.08]" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton label="Page suivante" size="sm" className="bg-fg/[0.08]" onClick={() => navigate(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      </div>
      <div className="flex items-center gap-2">
      <ThemeToggle />
      <Menu
        header={
          <div>
            <p className="text-sm font-semibold">{user?.displayName}</p>
            <p className="text-xs text-fg-3">{user?.email}</p>
          </div>
        }
        items={[
          { label: 'Thème clair', icon: <Sun />, onSelect: () => useThemeStore.getState().setPref('light') },
          { label: 'Thème sombre', icon: <Moon />, onSelect: () => useThemeStore.getState().setPref('dark') },
          { label: 'Suivre le système', icon: <Monitor />, onSelect: () => useThemeStore.getState().setPref('system') },
          'divider',
          { label: 'Se déconnecter', icon: <LogOut />, onSelect: () => { usePlayerStore.setState({ isPlaying: false, queue: [], index: -1 }); void logout(); }, danger: true },
        ]}
        trigger={(props) => (
          <button
            {...props}
            aria-label="Menu du compte"
            className="grid size-9 place-items-center rounded-full bg-fg/[0.08] p-1 transition hover:scale-105"
          >
            <span className="grid size-7 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">{user?.displayName?.[0]?.toUpperCase() ?? '?'}</span>
          </button>
        )}
      />
      </div>
    </div>
  );
}

export function AppShell() {
  useKeyboard();
  const hasPlayer = usePlayerStore((s) => s.index >= 0);
  const [creating, setCreating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const main = useRef<HTMLElement>(null);
  const location = useLocation();

  // Each navigation starts at the top, and screen readers land on the content.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={cn('min-h-dvh', hasPlayer && 'has-player')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        Aller au contenu
      </a>
      <Sidebar onCreate={() => setCreating(true)} />
      <div className={cn('md:pl-[280px]', hasPlayer ? 'pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-[88px]' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-2')}>
        <div className="md:pt-2 md:pr-2">
          <div className="relative min-h-[calc(100dvh-1rem)] overflow-hidden md:rounded-lg md:bg-surface">
            <TopBar scrolled={scrolled} />
            <main id="main" ref={main} tabIndex={-1} className="outline-none">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
      <PlayerBar />
      <MobileNav />
      <NowPlaying />
      <AudioEngine />
      <AddToPlaylistDialog />
      <CreatePlaylistDialog open={creating} onClose={() => setCreating(false)} />
      <Toaster />
    </div>
  );
}
