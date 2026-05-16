/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js webpack to transpile the TypeScript source of @fitgrade/types
  // (workspace package — no separate build step needed in development)
  transpilePackages: ['@fitgrade/types'],

  // All UI text is Hebrew — no i18n routing needed (single locale)
  // API_URL is consumed server-side; NEXT_PUBLIC_API_URL for client fetches
  env: {
    API_URL: process.env['API_URL'] ?? 'http://localhost:3001/api',
  },

  // Skip ESLint and TypeScript type-checking during `next build`.
  // Both are enforced in the CI `typecheck` job and the local `pnpm lint`
  // command — duplicating them inside the build adds ~30s and blocks the
  // production bundle over issues that are already caught elsewhere.
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
