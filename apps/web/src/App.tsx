import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell, Logo } from './components/layout/AppShell';
import { ApiError, setSessionExpiredHandler } from './lib/api';
import { pages } from './lib/pages';
import { Home } from './pages/Home';
import { useAuthStore } from './stores/auth';
import { usePlayerStore } from './stores/player';

// Secondary pages are split out of the initial bundle (and prefetched when idle, see lib/pages).
const Search = lazy(() => pages.search().then((m) => ({ default: m.Search })));
const Library = lazy(() => pages.library().then((m) => ({ default: m.Library })));
const Create = lazy(() => pages.create().then((m) => ({ default: m.Create })));
const PlaylistPage = lazy(() => pages.collections().then((m) => ({ default: m.PlaylistPage })));
const LikedPage = lazy(() => pages.collections().then((m) => ({ default: m.LikedPage })));
const MixPage = lazy(() => pages.collections().then((m) => ({ default: m.MixPage })));
// Signed-in users (most visits) never download the login pages.
const Login = lazy(() => pages.auth().then((m) => ({ default: m.Login })));
const Register = lazy(() => pages.auth().then((m) => ({ default: m.Register })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Chargement">
      <Logo className="animate-pulse text-5xl" />
    </div>
  );
}

/** Shown only if a page chunk is not prefetched yet: a quiet skeleton, not a blank page. */
function PageFallback() {
  return (
    <div className="space-y-4 px-4 pt-4 sm:px-6" role="status" aria-label="Chargement">
      <div className="skeleton h-9 w-56 rounded-lg" />
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <Splash />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
    setSessionExpiredHandler(() => {
      usePlayerStore.setState({ isPlaying: false });
      queryClient.clear();
      useAuthStore.getState().expire();
    });
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><Suspense fallback={<Splash />}><Login /></Suspense></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Suspense fallback={<Splash />}><Register /></Suspense></GuestOnly>} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="search" element={<Suspense fallback={<PageFallback />}><Search /></Suspense>} />
            <Route path="library" element={<Suspense fallback={<PageFallback />}><Library /></Suspense>} />
            <Route path="create" element={<Suspense fallback={<PageFallback />}><Create /></Suspense>} />
            <Route path="liked" element={<Suspense fallback={<PageFallback />}><LikedPage /></Suspense>} />
            <Route path="playlist/:id" element={<Suspense fallback={<PageFallback />}><PlaylistPage /></Suspense>} />
            <Route path="mix/:id" element={<Suspense fallback={<PageFallback />}><MixPage /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
