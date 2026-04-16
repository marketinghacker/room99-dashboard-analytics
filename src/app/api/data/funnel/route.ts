/**
 * GA4 ecommerce funnel: sessions → items_viewed → add_to_cart → begin_checkout → transactions.
 */
import { parseFilters, getCached, jsonResponse, errorResponse } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { period, compare } = parseFilters(req);
  const payload = await getCached('ga4', period, compare);
  if (!payload) return errorResponse('No cache', 503);

  const k = payload.kpis;
  const steps = [
    { name: 'Sesje', value: k.sessions },
    { name: 'Wyświetlenia produktu', value: k.itemsViewed },
    { name: 'Dodanie do koszyka', value: k.addToCart },
    { name: 'Rozpoczęcie checkout', value: k.beginCheckout },
    { name: 'Transakcje', value: k.transactions },
  ];

  // Drop-off % relative to previous step.
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
  });
}
