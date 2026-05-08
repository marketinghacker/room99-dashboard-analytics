/**
 * Auth primitives — JWT signing/verification (Edge-compatible via jose),
 * password hashing (bcryptjs — pure JS, works on Edge and Node).
 *
 * Session flow:
 *   1. POST /api/auth/login validates credentials, issues JWT,
 *      sets httpOnly cookie "r99-session" (7-day expiry).
 *   2. middleware.ts verifies the cookie on every request; attaches
 *      { userId, role } to request headers for server components.
 *   3. Client reads role via /api/auth/me (not the cookie directly).
 *
 * SESSION_SECRET env var must be ≥32 bytes random. Rotation: change the
 * env var, everyone is logged out (acceptable).
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const COOKIE_NAME = 'r99-session' as const;
const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 days

export type Role = 'client' | 'agency';

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: Role;
  email: string;
}

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error('SESSION_SECRET must be set and ≥32 characters');
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'client' && payload.role !== 'agency')
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE_SEC,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

/**
 * Reads the r99-session cookie from the incoming request and returns the
 * session payload, or null if missing/invalid. Use inside route handlers
 * that bypass the proxy auth (e.g. /api/admin/* paths, which the proxy
 * makes "public" because cron+operator scripts hit them with key auth).
 */
export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  // Tiny cookie parser — avoids a runtime dep just for this. Cookie name
  // contains only [a-z-] chars so a simple split is safe.
  const target = `${COOKIE_NAME}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      const value = trimmed.slice(target.length);
      if (!value) return null;
      return verifySession(decodeURIComponent(value));
    }
  }
  return null;
}

/**
 * Convenience: 401 if no session, 403 if wrong role, otherwise returns the
 * session. Throws Response objects (caller should propagate them as-is).
 *
 * Usage:
 *   const session = await requireRole(req, 'agency');
 *   if (session instanceof Response) return session;
 *   // ... session.userId / session.email
 */
export async function requireRole(
  req: Request,
  role: Role,
): Promise<SessionPayload | Response> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (session.role !== role) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  return session;
}
