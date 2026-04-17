/**
 * POST /api/auth/logout — clears the session cookie.
 */
import { SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE.name}=; Path=${SESSION_COOKIE.path}; HttpOnly; SameSite=${SESSION_COOKIE.sameSite}; Max-Age=0${SESSION_COOKIE.secure ? '; Secure' : ''}`,
  );
  return res;
}

export const GET = POST;
