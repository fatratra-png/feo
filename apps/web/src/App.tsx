import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell, Logo } from './components/layout/AppShell';
import { ApiError, setSessionExpiredHandler } from './lib/api';
import { Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { useAuthStore } from './stores/auth';
import { usePlayerStore } from './stores/player';

// Secondary pages are split out of the initial bundle.
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })));
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const Create = lazy(() => import('./pages/Create').then((m) => ({ default: m.Create })));
const PlaylistPage = lazy(() => import('./pages/Collections').then((m) => ({ default: m.PlaylistPage })));
const LikedPage = lazy(() => import('./pages/Collections').then((m) => ({ default: m.LikedPage })));
const MixPage = lazy(() => import('./pages/Collections').then((m) => ({ default: m.MixPage })));

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
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="search" element={<Suspense fallback={null}><Search /></Suspense>} />
            <Route path="library" element={<Suspense fallback={null}><Library /></Suspense>} />
            <Route path="create" element={<Suspense fallback={null}><Create /></Suspense>} />
            <Route path="liked" element={<Suspense fallback={null}><LikedPage /></Suspense>} />
            <Route path="playlist/:id" element={<Suspense fallback={null}><PlaylistPage /></Suspense>} />
            <Route path="mix/:id" element={<Suspense fallback={null}><MixPage /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
