/**
 * GET /api/auth/me — returns the current role if the r99-session cookie is
 * valid, else 401. Two-password auth model → no DB lookup needed, role comes
 * straight from the JWT.
 */
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE.name)?.value;
  if (!token) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return Response.json({ error: 'invalid session' }, { status: 401 });

  return Response.json({
    role: session.role,
    displayName: session.role === 'agency' ? 'Marketing Hackers' : 'Room99',
  });
}
