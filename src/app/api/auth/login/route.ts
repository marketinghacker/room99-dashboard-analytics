/**
 * POST /api/auth/login
 * Body: { email, password }
 * Sets httpOnly JWT cookie on success, returns { role, email, displayName }.
 */
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { signSession, SESSION_COOKIE, type Role } from '@/lib/auth';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs'; // bcryptjs + pg driver, not Edge

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return Response.json({ error: 'email and password required' }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  const user = rows[0];
  if (!user) {
    // Constant-time-ish: do a dummy compare so timing doesn't leak existence.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
    return Response.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return Response.json({ error: 'invalid credentials' }, { status: 401 });

  const role = (user.role === 'agency' ? 'agency' : 'client') as Role;
  const token = await signSession({ userId: user.id, role, email: user.email });

  // Update last_login_at
  await db.update(users).set({ lastLoginAt: sql`now()` }).where(eq(users.id, user.id));

  const res = Response.json({
    role,
    email: user.email,
    displayName: user.displayName,
  });
  const cookie = `${SESSION_COOKIE.name}=${token}; Path=${SESSION_COOKIE.path}; HttpOnly; SameSite=${SESSION_COOKIE.sameSite}; Max-Age=${SESSION_COOKIE.maxAge}${SESSION_COOKIE.secure ? '; Secure' : ''}`;
  res.headers.append('Set-Cookie', cookie);
  return res;
}
