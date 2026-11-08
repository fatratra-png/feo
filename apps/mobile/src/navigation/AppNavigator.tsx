import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DarkTheme as NavDark, DefaultTheme as NavLight, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../components/player';
import { AddToPlaylistSheet, navigationRef, SongSheet, Toaster } from '../components/sheets';
import { Logo, Press, T } from '../components/ui';
import { LoginScreen, RegisterScreen } from '../screens/AuthScreens';
import { LikedScreen, MixScreen, PlaylistScreen } from '../screens/CollectionScreens';
import { CreateScreen } from '../screens/CreateScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { NowPlayingScreen } from '../screens/NowPlayingScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { useAuthStore } from '../stores/auth';
import { usePlayerStore } from '../stores/player';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TABS: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; active: React.ComponentProps<typeof Ionicons>['name'] }> = {
  Home: { label: 'Accueil', icon: 'home-outline', active: 'home' },
  Search: { label: 'Rechercher', icon: 'search-outline', active: 'search' },
  Create: { label: 'IA', icon: 'sparkles-outline', active: 'sparkles' },
  Library: { label: 'Bibliothèque', icon: 'library-outline', active: 'library' },
};

/** Tab bar with the mini player docked on top of it. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.bg, paddingBottom: insets.bottom }}>
      <MiniPlayer />
      <View style={{ flexDirection: 'row', height: 56 }} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const t = TABS[route.name];
          return (
            <Press
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t.label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
            >
              <Ionicons name={focused ? t.active : t.icon} size={24} color={focused ? c.fg : c.fg3} />
              <T size={11} weight={focused ? '700' : '500'} tone={focused ? 'fg' : 'fg3'}>{t.label}</T>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { c, name } = useTheme();
  const status = useAuthStore((s) => s.status);
  const hasPlayer = usePlayerStore((s) => s.index >= 0);
  const insets = useSafeAreaInsets();
  const base = name === 'dark' ? NavDark : NavLight;
  const [route, setRoute] = useState<string | undefined>();
  // Pages pushed above the tabs (playlist, mix, liked) get a floating mini player too.
  const floatingPlayer = hasPlayer && route !== undefined && ['Playlist', 'Liked', 'Mix'].includes(route);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Logo size={48} />
        <ActivityIndicator color={c.fg2} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => setRoute(navigationRef.getCurrentRoute()?.name)}
      theme={{ ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.fg, primary: c.accentFg, border: c.line } }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        {status === 'authenticated' ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Playlist" component={PlaylistScreen} />
            <Stack.Screen name="Liked" component={LikedScreen} />
            <Stack.Screen name="Mix" component={MixScreen} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
      {floatingPlayer && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 4 }} pointerEvents="box-none">
          <MiniPlayer />
        </View>
      )}
      {status === 'authenticated' && (
        <>
          <SongSheet />
          <AddToPlaylistSheet />
        </>
      )}
      <Toaster bottom={insets.bottom + (floatingPlayer ? 80 : hasPlayer ? 140 : 72)} />
    </NavigationContainer>
  );
}
