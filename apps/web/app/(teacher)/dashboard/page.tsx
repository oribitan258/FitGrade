import { redirect } from 'next/navigation';

// /dashboard redirects to /classes — classes is the primary landing view.
export default function DashboardPage(): never {
  redirect('/classes');
}
