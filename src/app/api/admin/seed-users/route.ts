/**
 * POST /api/admin/seed-users?key=CRON_SECRET
 *
 * One-time bootstrap: creates an agency admin and a client user if they
 * don't already exist. Idempotent — safe to re-run.
 *
 * Credentials come from env:
 *   AGENCY_SEED_EMAIL, AGENCY_SEED_PASSWORD
 *   CLIENT_SEED_EMAIL, CLIENT_SEED_PASSWORD
 */
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (key !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results: Array<{ email: string; role: string; status: 'created' | 'exists' }> = [];

  for (const [envEmail, envPass, role, displayName] of [
    ['AGENCY_SEED_EMAIL', 'AGENCY_SEED_PASSWORD', 'agency', 'Marketing Hackers'],
    ['CLIENT_SEED_EMAIL', 'CLIENT_SEED_PASSWORD', 'client', 'Room99'],
  ] as const) {
    const email = process.env[envEmail]?.toLowerCase().trim();
    const password = process.env[envPass];
    // Skip silently if env not set — lets you seed agency first, add client
    // later without touching agency. Re-running this endpoint is a no-op for
    // already-existing rows.
    if (!email || !password) {
      results.push({ email: email ?? '(unset)', role, status: 'exists' });
      continue;
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      results.push({ email, role, status: 'exists' });
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ email, passwordHash, role, displayName });
    results.push({ email, role, status: 'created' });
  }

  return Response.json({ ok: true, results });
}

export const GET = POST;
