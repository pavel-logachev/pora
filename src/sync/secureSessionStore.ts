import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession, SessionStore } from './apiClient';

const sessionKey = 'pora.auth.session.v1';
const webSessionKey = 'pora-auth-session';

export class SecureSessionStore implements SessionStore {
  async load(): Promise<AuthSession | null> {
    const value =
      Platform.OS === 'web'
        ? typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(webSessionKey)
        : await SecureStore.getItemAsync(sessionKey);
    if (!value) return null;
    try {
      return JSON.parse(value) as AuthSession;
    } catch {
      await this.clear();
      return null;
    }
  }

  async save(session: AuthSession) {
    const value = JSON.stringify(session);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(webSessionKey, value);
      return;
    }
    await SecureStore.setItemAsync(sessionKey, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async clear() {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(webSessionKey);
      return;
    }
    await SecureStore.deleteItemAsync(sessionKey);
  }
}
