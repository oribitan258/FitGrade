import { Redirect } from 'expo-router';
import { getAccessToken } from '../lib/storage';

/**
 * Entry point: synchronously checks MMKV for a stored access token.
 * MMKV is synchronous so this renders without any loading state.
 * - Token present → go to the teacher dashboard
 * - No token      → go to the login screen
 */
export default function IndexScreen(): React.JSX.Element {
  const token = getAccessToken();
  return <Redirect href={token !== undefined ? '/(teacher)' : '/login'} />;
}
