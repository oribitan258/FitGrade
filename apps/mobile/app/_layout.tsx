import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

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

export default function RootLayout(): React.JSX.Element {
  useEffect(() => {
    // Re-assert on mount in case a hot reload partially reset the flag.
    // The module-level calls above handle the first render; this handles
    // edge cases during development fast-refresh cycles.
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(teacher)" />
    </Stack>
  );
}
