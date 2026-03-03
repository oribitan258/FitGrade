import { redirect } from 'next/navigation';

// Root — redirect to teacher login.
// Auth middleware (added in a later phase) will redirect authenticated
// users to their dashboard before this page ever renders.
export default function RootPage(): never {
  redirect('/login');
}
