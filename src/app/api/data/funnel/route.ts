/**
 * GA4 ecommerce funnel — session-scoped where possible.
 * Previously used `items_viewed` which is a PRODUCT-level count (one session
 * viewing 5 products = 5 items_viewed), so it appeared GREATER than sessions.
 * Now we use `engagedSessions` as the "intent" step (sessions that actually
 * interacted with the site) which is strictly ≤ sessions.
 *
 * For v2: fetch eventCount filtered by eventName (view_item, add_to_cart,
 * begin_checkout, purchase) — those are GA4's native session-scoped funnel
 * events and make the chart perfectly monotonic.
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('ga4', period, compare);
  if (!payload) return errorResponse('No cache', 503);

  const k = payload.kpis;

  // Clamp each step to the previous step's value so the funnel never shows
  // a higher value than the previous — it's just a visual constraint when
  // the underlying GA4 metrics mix session- and event-level counts.
  const raw = [
    { name: 'Sesje', value: k.sessions, hint: 'Wszystkie wizyty' },
    { name: 'Sesje zaangażowane', value: k.engagedSessions, hint: 'Scroll / klik / ≥10s' },
    { name: 'Dodanie do koszyka', value: k.addToCart, hint: 'Event count (może >1 na sesję)' },
    { name: 'Rozpoczęcie checkout', value: k.beginCheckout, hint: 'Event count' },
    { name: 'Transakcje', value: k.transactions, hint: 'SellRocket + GA4' },
  ];

  const steps = raw.map((s, i) => {
    // Never let a later step exceed the one before it in display — this is
    // about visual hierarchy; the `rawValue` is preserved for tooltips.
    const prev = i > 0 ? raw[i - 1].value : null;
    const clamped = prev != null && s.value > prev ? prev : s.value;
    return { ...s, rawValue: s.value, value: clamped };
  });

  const withDropoff = steps.map((s, i) => ({
    ...s,
    dropoff: i === 0 || steps[i - 1].value === 0 ? null : 1 - s.value / steps[i - 1].value,
    conversion: steps[0].value === 0 ? null : s.value / steps[0].value,
  }));

  return jsonResponse({
    period,
    compare,
    steps: withDropoff,
    kpis: k,
    compareKpis: payload.compareKpis,
    note: 'Steps 3-5 są event-scope (mogą być >1 na sesję). Do prawdziwego funnel per-sesja: GA4 UI → Explore → Funnel.',
  });
}
