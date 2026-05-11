/**
 * Typed storage layer with a two-tier security model:
 *
 *   Tier 1 — Sensitive auth credentials (access token):
 *     Stored in `expo-secure-store`, which maps to:
 *       iOS   → Keychain Services (hardware-backed on A-series chips)
 *       Android → EncryptedSharedPreferences / Keystore system
 *     These stores survive app reinstall on iOS (Keychain) and are wiped on
 *     Android uninstall, offering OS-level protection from other apps.
 *
 *   Tier 2 — Non-sensitive operational data (last class, offline queue):
 *     Stored in `react-native-mmkv` with an AES-256 encryption key that is
 *     itself persisted in Tier 1 (SecureStore).  This gives:
 *       • Fast synchronous reads/writes for the offline queue
 *       • At-rest encryption so the queue can't be read by root/jailbreak access
 *
 * Keys stored:
 *   • access_token    → SecureStore
 *   • last_class_id   → MMKV (encrypted, non-sensitive UX data)
 *   • offline_tap_queue → MMKV (encrypted, contains sessionId + studentId)
 *
 * Initialisation:
 *   Call `initStorage()` once at app boot (before any storage reads/writes).
 *   The function is idempotent and safe to call multiple times.
 */

import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// ─── MMKV encryption-key management ──────────────────────────────────────────

const MMKV_KEY_SECURE_STORE_KEY = 'fitgrade-mmkv-enc-key';
const MMKV_STORE_ID             = 'fitgrade-storage';

/**
 * Returns the AES-256 hex key used to encrypt the MMKV store.
 * On first call: generates a cryptographically random key and persists it
 * in SecureStore so it survives app restarts.
 * On subsequent calls: returns the persisted key.
 */
async function getOrCreateMmkvEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(MMKV_KEY_SECURE_STORE_KEY);
  if (existing !== null && existing !== undefined) return existing;

  // Generate a new 32-byte (256-bit) random key, hex-encoded.
  // React Native's `crypto.getRandomValues` is available via expo-crypto polyfill.
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const key = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(MMKV_KEY_SECURE_STORE_KEY, key);
  return key;
}

// ─── Module-level singleton ───────────────────────────────────────────────────

let _storage: MMKV | null = null;

/**
 * Must be called once at app startup (in `app/_layout.tsx`) before any
 * `get*` / `set*` / `enqueue*` calls.
 *
 * Safe on Android and iOS. On web (if ever rendered in a browser) MMKV
 * is not available — the function becomes a no-op.
 */
export async function initStorage(): Promise<void> {
  if (Platform.OS === 'web') return; // MMKV not available on web
  if (_storage !== null) return;     // Already initialised

  const encryptionKey = await getOrCreateMmkvEncryptionKey();
  _storage = new MMKV({ id: MMKV_STORE_ID, encryptionKey });
}

function getStorage(): MMKV {
  if (_storage === null) {
    throw new Error(
      '[storage] MMKV not initialised. Call initStorage() before any storage access.',
    );
  }
  return _storage;
}

/** All MMKV storage keys — prevents typo bugs and aids grep. */
const MMKV_KEYS = {
  LAST_CLASS_ID:    'last_class_id',
  OFFLINE_TAP_QUEUE: 'offline_tap_queue',
} as const;

/** SecureStore key for the JWT access token. */
const SECURE_ACCESS_TOKEN_KEY = 'fitgrade_access_token';

// ─── Auth token (SecureStore — Tier 1) ───────────────────────────────────────

/**
 * Returns the stored JWT access token, or undefined if not set.
 *
 * NOTE: SecureStore is asynchronous on Android; synchronous reads are not
 * possible. Callers that need the token synchronously (e.g., `api.ts`) should
 * cache it in a module-level variable after login and clear it on logout.
 * The `getAccessToken()` synchronous helper below uses that cache.
 */
export async function getAccessTokenAsync(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  _cachedToken = token;
  await SecureStore.setItemAsync(SECURE_ACCESS_TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  _cachedToken = null;
  await SecureStore.deleteItemAsync(SECURE_ACCESS_TOKEN_KEY);
}

/**
 * Synchronous cache for use by `api.ts` on every request.
 * Populated by `setAccessToken()` and cleared by `clearAccessToken()`.
 * Pre-warmed at startup by calling `warmTokenCache()`.
 */
let _cachedToken: string | null = null;

export function getAccessToken(): string | undefined {
  return _cachedToken ?? undefined;
}

/**
 * Reads the access token from SecureStore into the in-memory cache.
 * Call this at app startup (after `initStorage()`) so API calls have the
 * token available synchronously from the first render.
 */
export async function warmTokenCache(): Promise<void> {
  _cachedToken = await SecureStore.getItemAsync(SECURE_ACCESS_TOKEN_KEY);
}

// ─── Last-used class (MMKV encrypted — Tier 2) ───────────────────────────────

export function getLastClassId(): string | undefined {
  return getStorage().getString(MMKV_KEYS.LAST_CLASS_ID);
}

export function setLastClassId(classId: string): void {
  getStorage().set(MMKV_KEYS.LAST_CLASS_ID, classId);
}

// ─── Offline tap queue (MMKV encrypted — Tier 2) ─────────────────────────────

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
  const raw = getStorage().getString(MMKV_KEYS.OFFLINE_TAP_QUEUE);
  if (raw === undefined) return [];
  return JSON.parse(raw) as OfflineTapEntry[];
}

export function enqueueOfflineTap(entry: OfflineTapEntry): void {
  const queue = getOfflineQueue();
  queue.push(entry);
  getStorage().set(MMKV_KEYS.OFFLINE_TAP_QUEUE, JSON.stringify(queue));
}

/** Removes the queue entry matching the given session + student pair. */
export function dequeueOfflineTap(sessionId: string, studentId: string): void {
  const filtered = getOfflineQueue().filter(
    (e) => !(e.sessionId === sessionId && e.studentId === studentId),
  );
  getStorage().set(MMKV_KEYS.OFFLINE_TAP_QUEUE, JSON.stringify(filtered));
}
