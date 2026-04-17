/**
 * Route protection middleware.
 *
 *  - Public (no auth needed):
 *      /login, /api/auth/*, /api/health, /api/cron/*, /api/admin/*
 *    (Cron + admin endpoints have their own key-based auth and are hit by
 *    Railway cron + operator scripts — not browsers.)
 *
 *  - Everything else requires a valid JWT in the r99-session cookie.
 *
 *  - Role gating: agency-only endpoints (/api/data/anomalies,
 *    /api/data/cohorts, /api/data/insights, /api/admin/editorial)
 *    require role === 'agency'. 403 if client token.
 *
 * Runs on the Edge runtime — uses jose (WebCrypto) only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/api/auth/',
  '/api/health',
  '/api/cron/',
  '/api/admin/',    // cron + operator scripts — already key-gated
  '/_next/',
  '/favicon',
  '/static/',
];

const AGENCY_ONLY_PREFIXES = [
  '/api/data/anomalies',
  '/api/data/cohorts',
  '/api/data/insights',
  '/api/editorial',      // POST/DELETE to edit masthead copy
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isAgencyOnly(pathname: string): boolean {
  return AGENCY_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE.name)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    // API request? Return 401 JSON. Browser nav? Redirect to login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAgencyOnly(pathname) && session.role !== 'agency') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Surface session fields to server components / route handlers via headers.
  const res = NextResponse.next();
  res.headers.set('x-user-id', session.userId);
  res.headers.set('x-user-role', session.role);
  res.headers.set('x-user-email', session.email);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
