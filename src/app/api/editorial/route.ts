/**
 * POST /api/admin/editorial
 * Body: { tab: string, key: string, value: string }  OR  { tab, updates: { [key]: value } }
 *
 * Agency-only (middleware enforces via AGENCY_ONLY_PREFIXES). Upserts rows
 * in editorial_copy. DELETE to remove an override (reverts to auto-generated).
 */
import { db } from '@/lib/db';
import { editorialCopy } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

type Body = {
  tab: string;
  key?: string;
  value?: string;
  updates?: Record<string, string>;
};

async function currentUserId(): Promise<string | null> {
  const h = await headers();
  return h.get('x-user-id');
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.tab) return Response.json({ error: 'tab required' }, { status: 400 });
  const updates = body.updates ?? (body.key && body.value != null ? { [body.key]: body.value } : null);
  if (!updates) return Response.json({ error: 'updates or key+value required' }, { status: 400 });

  const userId = await currentUserId();

  for (const [key, value] of Object.entries(updates)) {
    if (value === '') {
      await db.delete(editorialCopy).where(and(eq(editorialCopy.tab, body.tab), eq(editorialCopy.key, key)));
      continue;
    }
    await db.insert(editorialCopy).values({
      tab: body.tab, key, value, updatedBy: userId ?? null,
    }).onConflictDoUpdate({
      target: [editorialCopy.tab, editorialCopy.key],
      set: { value: sql`excluded.value`, updatedAt: sql`now()`, updatedBy: sql`excluded.updated_by` },
    });
  }

  return Response.json({ ok: true, updated: Object.keys(updates).length });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab');
  const key = url.searchParams.get('key');
  if (!tab || !key) return Response.json({ error: 'tab + key required' }, { status: 400 });
  await db.delete(editorialCopy).where(and(eq(editorialCopy.tab, tab), eq(editorialCopy.key, key)));
  return Response.json({ ok: true });
}
