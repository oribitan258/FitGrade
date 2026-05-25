import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/ui';

/**
 * Safety route for the OAuth deep link `fitgrade://auth/callback`.
 *
 * The normal flow uses WebBrowser.openAuthSessionAsync (see login.tsx), which
 * intercepts the redirect before it ever reaches a route — so this component
 * is not part of the happy path. It exists as a fallback for edge cases:
 *
 *  - OS cold-starts the app via the deep link (no active auth session to catch it)
 *  - Email confirmation or external link that points at the callback URL
 *  - A bug in openAuthSessionAsync that lets the redirect leak through
 *
 * In every fallback case we have no way to recover the one-time code (it was
 * consumed by the now-dead auth session), so we just bounce back to /login.
 */
export default function AuthCallbackScreen(): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.background,
  },
});
