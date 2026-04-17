/**
 * GET /api/data/editorial-copy?tab=executive
 * Returns map of { key: value } overrides for the given tab. Everyone can
 * read (client sees the agency-authored copy, which is the point). Writes
 * are at /api/admin/editorial (agency-only via middleware).
 */
import { db } from '@/lib/db';
import { editorialCopy } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab');
  if (!tab) return Response.json({ error: 'tab param required' }, { status: 400 });

  const rows = await db.select().from(editorialCopy).where(eq(editorialCopy.tab, tab));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return Response.json(map);
}
