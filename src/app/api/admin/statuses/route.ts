/**
 * GET  /api/admin/statuses?key=SECRET
 *   Pulls live BaseLinker statuses (`getOrderStatusList`), merges with our
 *   stored allow-list, returns the union for editing.
 *
 * POST /api/admin/statuses?key=SECRET   body = { statuses: [...] }
 *   Persists each row's isValidSale + label.
 */
import { db } from '@/lib/db';
import { orderStatusConfig } from '@/lib/schema';
import { BaseLinkerAPI } from '@/lib/sync/baselinker-api';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized(req: Request): Response | null {
  const key = new URL(req.url).searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });
  return null;
}

export async function GET(req: Request) {
  const unauthRes = unauthorized(req);
  if (unauthRes) return unauthRes;

  const token = process.env.BASELINKER_API_TOKEN;
  if (!token) return Response.json({ error: 'BASELINKER_API_TOKEN not set' }, { status: 500 });

  const api = new BaseLinkerAPI(token);
  const live: any = await api.call('getOrderStatusList');
  const liveStatuses: Array<{ id: number; name: string }> = (live.statuses ?? []).map((s: any) => ({
    id: Number(s.id),
    name: String(s.name ?? ''),
  }));

  const existing = await db.select().from(orderStatusConfig);
  const byId = new Map(existing.map((r) => [r.statusId, r]));

  // Merge: live statuses come first; if any were deleted upstream we still
  // surface stored entries so the admin can untick them.
  const merged = liveStatuses.map((s) => ({
    statusId: s.id,
    label: s.name,
    isValidSale: byId.get(s.id)?.isValidSale ?? true, // default: count as sale
  }));
  for (const e of existing) {
    if (!liveStatuses.find((s) => s.id === e.statusId)) {
      merged.push({ statusId: e.statusId, label: e.label, isValidSale: e.isValidSale });
    }
  }

  return Response.json({ statuses: merged });
}

export async function POST(req: Request) {
  const unauthRes = unauthorized(req);
  if (unauthRes) return unauthRes;

  const body = (await req.json()) as {
    statuses: Array<{ statusId: number; label: string; isValidSale: boolean }>;
  };
  if (!Array.isArray(body?.statuses)) {
    return Response.json({ error: 'body.statuses must be an array' }, { status: 400 });
  }

  for (const s of body.statuses) {
    await db
      .insert(orderStatusConfig)
      .values({
        statusId: s.statusId,
        label: s.label,
        isValidSale: !!s.isValidSale,
      })
      .onConflictDoUpdate({
        target: orderStatusConfig.statusId,
        set: {
          label: sql`excluded.label`,
          isValidSale: sql`excluded.is_valid_sale`,
          updatedAt: sql`now()`,
        },
      });
  }
  return Response.json({ ok: true, updated: body.statuses.length });
}
