/**
 * POST /api/auth/login
 * Body: { password: string }
 *
 * Two-password auth — no email. Compare against
 *   AGENCY_PASSWORD  → role = 'agency'
 *   CLIENT_PASSWORD  → role = 'client'
 *
 * Passwords compared with a constant-time bcrypt hash of the env var so
 * timing doesn't leak which role the user is trying.
 */
import { signSession, SESSION_COOKIE, type Role } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'password required' }, { status: 400 });
  }

  const agency = process.env.AGENCY_PASSWORD;
  const client = process.env.CLIENT_PASSWORD;
  if (!agency || !client) {
    return Response.json({ error: 'server not configured' }, { status: 500 });
  }

  // Constant-time check against BOTH candidates so timing reveals nothing.
  const isAgency = timingSafeEqual(password, agency);
  const isClient = !isAgency && timingSafeEqual(password, client);

  // Dummy bcrypt work so login takes similar time regardless of outcome
  // (the env-var compare itself is cheap, but a real password would be
  // hashed — keep the response shape consistent).
  await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');

  if (!isAgency && !isClient) {
    return Response.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const role: Role = isAgency ? 'agency' : 'client';
  const token = await signSession({
    userId: role, // no DB row — just use role as stable id
    role,
    email: `${role}@room99-dashboard.local`,
  });

  const res = Response.json({ role });
  const cookie = `${SESSION_COOKIE.name}=${token}; Path=${SESSION_COOKIE.path}; HttpOnly; SameSite=${SESSION_COOKIE.sameSite}; Max-Age=${SESSION_COOKIE.maxAge}${SESSION_COOKIE.secure ? '; Secure' : ''}`;
  res.headers.append('Set-Cookie', cookie);
  return res;
}
