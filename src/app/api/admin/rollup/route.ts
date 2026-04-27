/**
 * GET /api/admin/rollup?key=SECRET
 *
 * Force-rebuild every dashboard_cache row synchronously, then return the
 * count. Cron's background rollup can be killed by Railway's 300s function
 * timeout before it finishes; this endpoint extends maxDuration to 600s
 * (the full Railway ingress limit) so a complete rebuild fits.
 *
 * Use after a manual sync when /api/data/* still shows stale time series.
 */
import { buildRollups } from '@/lib/rollup';

export const runtime = 'nodejs';
export const maxDuration = 600;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (key !== secret) return new Response('Unauthorized', { status: 401 });

  const t0 = Date.now();
  try {
    const out = await buildRollups();
    return Response.json({
      ok: true,
      cached: out.cached,
      ms: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg, ms: Date.now() - t0 }, { status: 500 });
  }
}

export const POST = GET;
