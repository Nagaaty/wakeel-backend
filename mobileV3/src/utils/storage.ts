/**
 * Secure storage utility — uses expo-secure-store for sensitive data (tokens),
 * falls back to AsyncStorage for non-sensitive data.
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEYS = ['wakeel_token', 'wakeel_biometric_enabled'];

export const storage = {
  async get(key: string): Promise<string | null> {
    if (SECURE_KEYS.includes(key)) {
      return SecureStore.getItemAsync(key);
    }
    return AsyncStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (SECURE_KEYS.includes(key)) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    if (SECURE_KEYS.includes(key)) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => this.remove(k)));
  },

  async getUser(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem('wakeel_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem('wakeel_user', JSON.stringify(user));
  },
};

export default storage;
