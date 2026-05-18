import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { setAccessToken } from '../lib/storage';
import { api } from '../lib/api';
import { ApiError } from '@fitgrade/types';
import { COLORS, FONT_SIZE_BODY, FONT_SIZE_BUTTON, MIN_TOUCH_TARGET } from '../constants/ui';

/**
 * Teacher Google OAuth login screen.
 *
 * Flow:
 * 1. Tap "כניסה עם Google" → WebBrowser.openAuthSessionAsync opens an in-app browser.
 * 2. Browser navigates to GET /api/auth/google/mobile on the backend, which sets
 *    a short-lived cookie and redirects to the standard Google OAuth route.
 * 3. After Google auth, the backend callback detects the cookie and redirects to
 *    fitgrade://auth/callback?code=<oneTimeCode> (64-char hex, 2-min TTL, single-use).
 * 4. The OS intercepts the fitgrade:// deep-link scheme, closes the browser, and
 *    openAuthSessionAsync returns with the redirect URL.
 * 5. App extracts the one-time code and POSTs it to POST /auth/mobile-exchange to
 *    receive the actual JWT access token, then stores it in MMKV.
 */
export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin(): Promise<void> {
    setLoading(true);
    try {
      // The redirect URL uses the app's registered deep-link scheme (app.json: "scheme": "fitgrade")
      const redirectUrl = Linking.createURL('auth/callback');
      const apiBase = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';
      const result = await WebBrowser.openAuthSessionAsync(
        `${apiBase}/auth/google/mobile`,
        redirectUrl,
      );

      if (result.type === 'success') {
        const parsed = Linking.parse(result.url);
        const code = parsed.queryParams?.['code'];
        // Validate code format: must be a 64-char hex string (server-issued single-use code)
        if (typeof code === 'string' && /^[a-f0-9]{64}$/.test(code)) {
          // Exchange the one-time code for the actual JWT via a server-side call.
          // The code is single-use and expires after 2 minutes.
          const { accessToken } = await api.post<{ accessToken: string }>(
            '/auth/mobile-exchange',
            { code },
          );
          setAccessToken(accessToken);
          router.replace('/(teacher)');
        } else {
          Alert.alert('שגיאה', 'לא התקבל קוד אימות מהשרת — נסה שוב');
        }
      } else if (result.type === 'cancel') {
        // User closed the browser — no error shown, just re-enable the button
      } else {
        Alert.alert('שגיאה', 'הכניסה נכשלה — נסה שוב');
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'שגיאת חיבור — בדוק את חיבור האינטרנט';
      Alert.alert('שגיאת כניסה', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* App header */}
      <View style={styles.header}>
        <Text style={styles.appName}>FitGrade</Text>
        <Text style={styles.appSubtitle}>מערכת ציונים לחינוך גופני</Text>
      </View>

      {/* Login section */}
      <View style={styles.loginSection}>
        <Text style={styles.loginHeading}>כניסת מורים</Text>

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={() => {
            void handleGoogleLogin();
          }}
          disabled={loading}
          accessibilityLabel="כניסה עם חשבון Google"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.googleButtonText}>כניסה עם Google</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          כניסה מיועדת למורים בלבד. תלמידים יכנסו דרך אתר האינטרנט.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingStart: 32,
    paddingEnd: 32,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 64,
  },
  appName: {
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'right',
    color: COLORS.foreground,
  },
  appSubtitle: {
    fontSize: FONT_SIZE_BODY,
    textAlign: 'right',
    color: COLORS.muted,
    marginTop: 6,
  },
  loginSection: {
    gap: 16,
  },
  loginHeading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'right',
    color: COLORS.foreground,
  },
  googleButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minHeight: Math.max(MIN_TOUCH_TARGET, 56),
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: FONT_SIZE_BUTTON,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 13,
    textAlign: 'right',
    color: COLORS.muted,
    lineHeight: 20,
  },
});
