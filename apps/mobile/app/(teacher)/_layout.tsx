import { Redirect, Stack } from 'expo-router';
import { getAccessToken } from '../../lib/storage';
import { ErrorBoundary } from '../../components/error-boundary';

/**
 * Teacher route group layout.
 *
 * Auth guard: getAccessToken() is synchronous (MMKV), so we can check the
 * token inline and render a <Redirect> without any loading state.
 * If no token is found, the user is sent to /login before any teacher
 * screen renders.
 *
 * ErrorBoundary wraps the entire Stack so any unhandled render error in a
 * teacher screen surfaces a Hebrew recovery screen instead of a blank crash.
 */
export default function TeacherLayout(): React.JSX.Element {
  const token = getAccessToken();

  if (token === undefined) {
    return <Redirect href="/login" />;
  }

  return (
    <ErrorBoundary>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="classes/[id]"
          options={{
            headerShown: false, // Custom header rendered inside the screen
          }}
        />
        <Stack.Screen
          name="session/[sessionId]"
          options={{
            headerShown: false, // Custom header rendered inside the screen
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
