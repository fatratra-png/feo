import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small key/value store: SecureStore on devices, localStorage on web. */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch { return null; }
  },
  async set(key: string, value: string) {
    try {
      if (Platform.OS === 'web') return void globalThis.localStorage?.setItem(key, value);
      await SecureStore.setItemAsync(key, value);
    } catch { /* ignore */ }
  },
  async remove(key: string) {
    try {
      if (Platform.OS === 'web') return void globalThis.localStorage?.removeItem(key);
      await SecureStore.deleteItemAsync(key);
    } catch { /* ignore */ }
  },
};
