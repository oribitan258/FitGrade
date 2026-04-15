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
 */

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'fitgrade-storage' });

/** All MMKV storage keys in one place — prevents typo bugs and aids grep. */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  LAST_CLASS_ID: 'last_class_id',
  /** Stopwatch taps that failed to submit and need to be replayed on reconnect. */
  OFFLINE_TAP_QUEUE: 'offline_tap_queue',
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

// ─── Offline tap queue (stopwatch results that failed to submit) ────────────

/** A stopwatch tap that could not be submitted due to a network failure. */
export interface OfflineTapEntry {
  sessionId: string;
  studentId: string;
  /** Raw elapsed milliseconds captured at tap time — converted to seconds on submit. */
  elapsedMs: number;
  rawValue: number;
  queuedAt: number; // Date.now()
}

export function getOfflineQueue(): OfflineTapEntry[] {
  const raw = storage.getString(STORAGE_KEYS.OFFLINE_TAP_QUEUE);
  if (raw === undefined) return [];
  return JSON.parse(raw) as OfflineTapEntry[];
}

export function enqueueOfflineTap(entry: OfflineTapEntry): void {
  const queue = getOfflineQueue();
  queue.push(entry);
  storage.set(STORAGE_KEYS.OFFLINE_TAP_QUEUE, JSON.stringify(queue));
}

/** Removes the queue entry matching the given session + student pair. */
export function dequeueOfflineTap(sessionId: string, studentId: string): void {
  const filtered = getOfflineQueue().filter(
    (e) => !(e.sessionId === sessionId && e.studentId === studentId),
  );
  storage.set(STORAGE_KEYS.OFFLINE_TAP_QUEUE, JSON.stringify(filtered));
}
