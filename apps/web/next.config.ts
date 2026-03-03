import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // All UI text is Hebrew — no i18n routing needed (single locale)
  // API_URL is consumed server-side; NEXT_PUBLIC_API_URL for client fetches
  env: {
    API_URL: process.env['API_URL'] ?? 'http://localhost:3001/api',
  },
};

export default nextConfig;
