/**
 * Typed MMKV storage wrapper.
 *
 * All persistent local state (JWT token, last-used class, offline queue)
 * is stored here — never in AsyncStorage or localStorage.
 *
 * MMKV is synchronous and encrypted, making it suitable for auth tokens.
 *
 * Note: react-native-mmkv requires a native build (Dev Client or EAS Build).
 * It is NOT available in Expo Go. Use `expo run:android` / `expo run:ios`
 * or an EAS Dev Build for full functionality.
 *
 * Full implementation (token read/write, offline queue) added in auth phase.
 */

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'fitgrade-storage' });

/** All MMKV storage keys in one place — prevents typo bugs and aids grep. */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  LAST_CLASS_ID: 'last_class_id',
} as const;

// ─── Auth ──────────────────────────────────────────────────────────────────

export function getAccessToken(): string | undefined {
  return storage.getString(STORAGE_KEYS.ACCESS_TOKEN);
}

export function setAccessToken(token: string): void {
  storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
}

export function clearAccessToken(): void {
  storage.delete(STORAGE_KEYS.ACCESS_TOKEN);
}

// ─── Last-used class (for faster app open) ─────────────────────────────────

export function getLastClassId(): string | undefined {
  return storage.getString(STORAGE_KEYS.LAST_CLASS_ID);
}

export function setLastClassId(classId: string): void {
  storage.set(STORAGE_KEYS.LAST_CLASS_ID, classId);
}
