import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'FitGrade — מערכת ציונים לחינוך גופני',
  description: 'מערכת דיגיטלית לניהול ציונים ונוכחות בשיעורי חינוך גופני',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    // lang="he" dir="rtl" — MANDATORY. Never remove. Sets RTL layout for the entire app.
    // All Tailwind classes must use logical properties (ms-/me-/ps-/pe-/text-start/text-end).
    // Physical directional classes (ml-/mr-/pl-/pr-/text-left/text-right) are BANNED.
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} overflow-x-hidden`}>{children}</body>
    </html>
  );
}
