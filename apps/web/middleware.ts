import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Applies security headers to every web response.
 * Runs at the Edge before any page or API route handler.
 *
 * script-src requires 'unsafe-inline' because Next.js App Router injects inline
 * <script> tags for streaming hydration. Nonce-based CSP is the hardened
 * alternative but requires significant Next.js middleware plumbing; 'unsafe-inline'
 * is the standard interim approach used by most Next.js deployments.
 * style-src also needs 'unsafe-inline' for Tailwind/shadcn runtime styles.
 * connect-src includes the API origin so SWR fetch() calls are allowed.
 */
export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const apiOrigin = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const isProd = process.env['NODE_ENV'] === 'production';

  // script-src:
  //   - 'unsafe-inline' required by Next.js App Router for streaming hydration <script> tags
  //   - 'unsafe-eval' required by React Fast Refresh / Webpack HMR in dev mode
  //   - In production, 'unsafe-eval' is dropped — only the runtime hydration scripts remain
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  // connect-src:
  //   - 'self' covers same-origin HTTP and WebSocket (HMR) per CSP3
  //   - apiOrigin is the cross-origin REST API
  //   - In dev, also explicitly allow ws:/wss: same-origin for older browser quirks
  const connectSrc = isProd
    ? `connect-src 'self' ${apiOrigin}`
    : `connect-src 'self' ${apiOrigin} ws://localhost:3000 ws://localhost:3001`;

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com",
      connectSrc,
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  if (isProd) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
