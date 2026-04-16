import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ ok: true, db: 'up', ts: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { ok: false, db: 'down', error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
