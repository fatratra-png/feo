import { ChevronLeft, ChevronRight, Heart, Home, Library, LogOut, Monitor, Moon, Plus, Search, Sparkles, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLikedIds, usePlaylists } from '../../hooks/library';
import { prefetchAppPages, prefetchPath } from '../../lib/pages';
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
import { Equalizer, Toaster } from '../ui/Feedback';
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

/** Height of one main-nav row: the active pill slides by multiples of it. */
const NAV_ROW = 44;

/** Which main-nav entry the current path belongs to (-1: none, e.g. a playlist). */
function activeNavIndex(path: string) {
  return NAV.findIndex(({ to, end }) => (end ? path === to : path === to || path.startsWith(`${to}/`)));
}

/** A library row: cover, name, details, and a live equalizer when it is the one playing. */
function LibraryItem({ to, active, playing, index, cover, title, subtitle }: {
  to: string;
  active: boolean;
  playing: boolean | null;
  index: number;
  cover: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <Link
        to={to}
        onMouseEnter={() => prefetchPath(to)}
        onFocus={() => prefetchPath(to)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl p-2 transition-[background-color,transform] duration-200 ease-out-soft hover:bg-fg/[0.06] active:scale-[0.985]',
          active && 'bg-fg/[0.08] hover:bg-fg/[0.1]',
        )}
      >
        {/* Accent bar of the open collection: grows in rather than popping. */}
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-transform duration-300 ease-out-soft',
            active ? 'scale-y-100' : 'scale-y-0',
          )}
        />
        <span className="shrink-0 transition-transform duration-300 ease-out-soft group-hover:scale-[1.04]">{cover}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-semibold transition-colors', playing !== null && 'text-accent-fg')}>{title}</span>
          <span className="block truncate text-xs text-fg-3">{subtitle}</span>
        </span>
        {playing !== null && <Equalizer playing={playing} className="mr-2 shrink-0" />}
      </Link>
    </li>
  );
}

function Sidebar({ onCreate }: { onCreate: () => void }) {
  const { data: playlists, isLoading } = usePlaylists();
  const likedCount = useLikedIds().size;
  const location = useLocation();
  const activeIndex = activeNavIndex(location.pathname);
  // The collection the music is coming from gets a live equalizer.
  const playingFrom = usePlayerStore((s) => (s.index >= 0 ? s.context?.href ?? null : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playingState = (href: string) => (playingFrom === href ? isPlaying : null);

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-[280px] flex-col gap-2 p-2 md:flex [.has-player_&]:bottom-[80px]">
      <nav className="rounded-lg bg-surface px-3 pt-5 pb-3" aria-label="Navigation principale">
        <Link to="/" className="group mb-5 block px-3" aria-label="FEO, accueil">
          <Logo className="transition-transform duration-300 ease-out-soft group-hover:scale-[1.04]" />
        </Link>
        <ul className="relative">
          {/* One pill slides between entries instead of each entry lighting up on its own. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 rounded-md bg-fg/[0.07] transition-[transform,opacity] duration-300 ease-out-soft',
              activeIndex < 0 && 'opacity-0',
            )}
            style={{ height: NAV_ROW, transform: `translateY(${Math.max(0, activeIndex) * NAV_ROW}px)` }}
          >
            <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
          </span>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onMouseEnter={() => prefetchPath(to)}
                onFocus={() => prefetchPath(to)}
                style={{ height: NAV_ROW }}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-4 rounded-md px-3 text-[15px] font-bold transition-colors duration-200',
                    isActive ? 'text-fg' : 'text-fg-2 hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-[22px] transition-transform duration-300 ease-out-soft group-hover:scale-110 group-active:scale-95',
                        to === '/create' && 'group-hover:rotate-12',
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden
                    />
                    <span className="transition-transform duration-300 ease-out-soft group-hover:translate-x-0.5">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface" aria-label="Tes playlists">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <Link to="/library" onMouseEnter={() => prefetchPath('/library')} className="flex items-center gap-2 text-[15px] font-bold text-fg-2 transition-colors hover:text-fg">
            <Library className="size-5" aria-hidden /> Ta bibliothèque
          </Link>
          <IconButton label="Nouvelle playlist" size="sm" onClick={onCreate} className="transition-transform duration-300 ease-out-soft hover:rotate-90">
            <Plus className="size-5" />
          </IconButton>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          <LibraryItem
            to="/liked"
            index={0}
            active={location.pathname === '/liked'}
            playing={playingState('/liked')}
            cover={
              <span className="grid size-12 place-items-center rounded-md bg-accent">
                <Heart className="size-4 fill-on-accent text-on-accent" aria-hidden />
              </span>
            }
            title="Titres likés"
            subtitle={pluralize(likedCount, 'titre')}
          />
          {isLoading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 p-2" aria-hidden>
                <span className="skeleton size-11 rounded-lg" />
                <span className="flex-1 space-y-1.5">
                  <span className="skeleton block h-3 w-3/4 rounded" />
                  <span className="skeleton block h-2.5 w-1/3 rounded" />
                </span>
              </li>
            ))}
          {playlists?.map((p, i) => (
            <LibraryItem
              key={p.id}
              to={`/playlist/${p.id}`}
              index={i + 1}
              active={location.pathname === `/playlist/${p.id}`}
              playing={playingState(`/playlist/${p.id}`)}
              cover={<Mosaic ids={p.coverIds} className="size-11" rounded="rounded-lg" />}
              title={p.name}
              subtitle={`${p.aiPrompt ? 'IA · ' : ''}${pluralize(p.songCount, 'titre')}`}
            />
          ))}
          {playlists && playlists.length === 0 && (
            <li className="mx-2 mt-2 animate-fade-up rounded-xl bg-fg/[0.04] p-4 text-sm text-fg-2">
              Crée ta première playlist, ou demande-en une à l'IA.
              <Link to="/create" className="group mt-3 flex items-center gap-2 font-semibold text-accent-fg hover:underline">
                <Sparkles className="size-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden /> Créer avec l'IA
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
              onTouchStart={() => prefetchPath(to)}
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

  useEffect(() => prefetchAppPages(), []);

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
              {/* Keyed by path: each page enters with a short fade and rise. */}
              <div key={location.pathname} className="animate-page-in">
                <Outlet />
              </div>
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
