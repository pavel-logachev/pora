import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const deviceIdKey = 'pora.sync.device-id.v1';

export async function getOrCreateDeviceId() {
  const existing =
    Platform.OS === 'web'
      ? typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(deviceIdKey)
      : await SecureStore.getItemAsync(deviceIdKey);
  if (existing) return existing;

  const created = randomUUID();
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(deviceIdKey, created);
  } else {
    await SecureStore.setItemAsync(deviceIdKey, created, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return created;
}
