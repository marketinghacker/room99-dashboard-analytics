/**
 * GET /api/auth/me — returns the current user's { role, email, displayName }
 * if the r99-session cookie is valid, else 401. Used by the client to
 * hydrate the role store after page load.
 */
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE.name)?.value;
  if (!token) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return Response.json({ error: 'invalid session' }, { status: 401 });

  const rows = await db
    .select({ email: users.email, role: users.role, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  const u = rows[0];
  if (!u) return Response.json({ error: 'user not found' }, { status: 401 });

  return Response.json({
    role: u.role === 'agency' ? 'agency' : 'client',
    email: u.email,
    displayName: u.displayName,
  });
}
