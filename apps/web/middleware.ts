import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Applies security headers to every web response.
 * Runs at the Edge before any page or API route handler.
 *
 * CSP uses 'unsafe-inline' for styles only (Tailwind/shadcn inject inline styles
 * at runtime). Script execution is restricted to 'self'.
 * connect-src includes the API origin so SWR fetch() calls are allowed.
 */
export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const apiOrigin = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://lh3.googleusercontent.com",
      `connect-src 'self' ${apiOrigin}`,
      "font-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
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
