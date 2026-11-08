import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AudioEngine } from './src/audio/AudioEngine';
import { ApiError, setSessionExpiredHandler } from './src/lib/api';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/auth';
import { hydratePlayerSettings, usePlayerStore } from './src/stores/player';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

function Root() {
  const { name } = useTheme();
  const status = useAuthStore((s) => s.status);
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      {status === 'authenticated' && <AudioEngine />}
    </>
  );
}

export default function App() {
  useEffect(() => {
    void useAuthStore.getState().init();
    void hydratePlayerSettings();
    setSessionExpiredHandler(() => {
      usePlayerStore.setState({ isPlaying: false });
      queryClient.clear();
      useAuthStore.getState().expire();
    });
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
