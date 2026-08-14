import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-react-native';

/**
 * Adapts `@react-native-async-storage/async-storage` to the `Storage`
 * interface Reown AppKit needs for persisting sessions/preferences, so
 * WalletConnect sessions survive an app restart.
 */
export const appKitStorage: Storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  },

  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.getMany(keys);
    return keys.map(key => {
      const value = values[key];
      return [key, value ? (JSON.parse(value) as T) : undefined] as [string, T];
    });
  },

  async getItem<T = unknown>(key: string) {
    const value = await AsyncStorage.getItem(key);
    return value === null ? undefined : (JSON.parse(value) as T);
  },

  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};
