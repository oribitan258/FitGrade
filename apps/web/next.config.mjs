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

  // ── Production hardening ────────────────────────────────────────────────
  reactStrictMode:              true,
  poweredByHeader:              false,
  compress:                     true,
  productionBrowserSourceMaps:  false,

  // Skip ESLint and TypeScript type-checking during `next build`.
  // Both are enforced in the CI `typecheck` job and the local `pnpm lint`
  // command — duplicating them inside the build adds ~30s and blocks the
  // production bundle over issues that are already caught elsewhere.
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ── Image optimization ──────────────────────────────────────────────────
  // Google OAuth avatars come from lh3.googleusercontent.com. AVIF/WebP cut
  // typical avatar transfer from ~30KB → ~8KB.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // ── Bundle slimming ─────────────────────────────────────────────────────
  // `optimizePackageImports` rewrites `import { X } from 'lucide-react'` to
  // deep imports, killing the barrel-file blowup. Same for recharts/date-fns.
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion', 'date-fns'],
  },

  // Emit a self-contained server bundle for Docker / serverless deploys.
  // Opt-in via NEXT_OUTPUT=standalone — `output: 'standalone'` creates
  // symlinks during the trace phase which fails on Windows without
  // Developer Mode. CI/Docker builds set the env var; local dev does not.
  ...(process.env['NEXT_OUTPUT'] === 'standalone' ? { output: 'standalone' } : {}),
};

export default nextConfig;
