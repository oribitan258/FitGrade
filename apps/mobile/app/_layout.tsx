import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OfflineBanner } from '../components/offline-banner';
import { useNetworkStatus } from '../hooks/use-network-status';
import { getOfflineQueue, dequeueOfflineTap, initStorage, warmTokenCache } from '../lib/storage';
import { api } from '../lib/api';

// ─── RTL enforcement — MUST be the first code that runs ──────────────────────
//
// These two calls configure React Native's layout engine to mirror all flex
// layouts, icons, and navigation animations for RTL (Hebrew) text direction.
//
// RULES (from .claude/rules/mobile.md):
//   • Call at MODULE LEVEL (here, before any component), not inside useEffect,
//     so they run synchronously before NavigationContainer mounts.
//   • Use start/end in StyleSheet instead of left/right everywhere in the app.
//   • Never set writingDirection: 'rtl' on Text — it conflicts with this global.
//   • Never remove these calls. The entire app UI depends on them.
//
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000, // 30 seconds
    },
  },
});

/**
 * Submits every entry in the MMKV offline tap queue to the API.
 * Called on app mount and whenever connectivity is restored.
 * Entries are removed from the queue only on successful submission.
 */
async function flushOfflineQueue(): Promise<void> {
  const queue = getOfflineQueue();
  for (const entry of queue) {
    try {
      await api.post(`/sessions/${entry.sessionId}/results`, {
        studentId: entry.studentId,
        rawValue: entry.rawValue,
      });
      dequeueOfflineTap(entry.sessionId, entry.studentId);
    } catch {
      // Submission still failing — leave in queue, retry on next reconnect.
    }
  }
}

/**
 * Flushes the offline tap queue whenever the device regains connectivity,
 * and once on initial mount to replay taps from previous sessions.
 */
function useOfflineQueueFlush(): void {
  const isConnected = useNetworkStatus();

  // Flush on mount (covers queue accumulated in a previous app session).
  useEffect(() => {
    void flushOfflineQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush each time we transition back online.
  useEffect(() => {
    if (isConnected) {
      void flushOfflineQueue();
    }
  }, [isConnected]);
}

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Re-assert on mount in case a hot reload partially reset the flag.
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);

    // Initialise encrypted MMKV store and warm the token cache so API calls
    // have the JWT available synchronously on the first render.
    void initStorage().then(() => warmTokenCache());
  }, []);

  useOfflineQueueFlush();

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(teacher)" />
      </Stack>
      {/* Absolutely positioned — overlays all screens when offline. */}
      <OfflineBanner />
    </QueryClientProvider>
  );
}
