/**
 * Canonical Room99 categories (verified against https://room99.pl navigation).
 * Everything outside this set falls into "INNE" (Other) so we don't surface
 * noise like WODA / GRUBY / MIĘKKI / DEKORACYJNA / GOTOWE on the dashboard.
 */
const CANONICAL_CATEGORIES = new Set<string>([
  'ZASŁONA',
  'FIRANA',
  'NARZUTA',
  'POSZEWKA',
  'PODUSZKA',
  'OBRUS',
  'KOC',
  'PLED',
  'ZAPACH',    // Zapachy do domu + perfumy (user said: same category)
  'BIEŻNIK',
  'DYWAN',
  'RĘCZNIK',
  'KOMPLET',
  'KARNISZ',
  'ROLETA',
  'PANEL',
  'SZARFA',    // Dekoracyjne szarfy do zasłon (curtain accessory)
  'ZAWIESZKA', // Zawieszki do firan
]);

/**
 * Polish plural → singular consolidation so ZASŁONY and ZASŁONA show up
 * under one category bucket.
 */
const CATEGORY_LEMMA: Record<string, string> = {
  ZASŁONY: 'ZASŁONA',
  FIRANY: 'FIRANA',
  POSZEWKI: 'POSZEWKA',
  PODUSZKI: 'PODUSZKA',
  NARZUTY: 'NARZUTA',
  OBRUSY: 'OBRUS',
  KOCE: 'KOC',
  PLEDY: 'PLED',
  BIEŻNIKI: 'BIEŻNIK',
  RĘCZNIKI: 'RĘCZNIK',
  DYWANY: 'DYWAN',
  KOMPLETY: 'KOMPLET',
  KARNISZE: 'KARNISZ',
  ROLETY: 'ROLETA',
  PANELE: 'PANEL',
  ZAPACHY: 'ZAPACH',
  SZARFY: 'SZARFA',
  ZAWIESZKI: 'ZAWIESZKA',
  // User request: Perfumy damskie and Zapachy do domu share the same bucket.
  PERFUM: 'ZAPACH',
  PERFUMY: 'ZAPACH',
};

/**
 * Heuristic parser for Room99 product names.
 *
 * Observed patterns in BaseLinker:
 *   1. "CATEGORY COLLECTION - rest"           → ZASŁONA AURA - BEŻOWA 140x250
 *   2. "CATEGORY MODIFIER COLLECTION - rest"  → ZASŁONA ZACIEMNIAJĄCA LAUREL - BEŻOWA
 *   3. "CATEGORY MOD1 MOD2 COLLECTION - rest" → NARZUTA NA ŁÓŻKO MOLLY - BEŻOWA
 *   4. Title case: "Poduszka Eternity MedLine PLUS"
 *   5. After-dash collection: "Woda perfumowana - Mon Ame 200 ml" → PERFUM
 *
 * Rule:
 *   category raw  = first alphabetic token (3+ letters), uppercased
 *   category      = CANONICAL lookup or null
 *   collection    = last proper-name token before " - " that isn't the
 *                   category itself; fallback = multi-word capitalised group
 *                   right after " - " (#5).
 *
 * Special case: "Woda perfumowana ..." → category = PERFUM (not WODA).
 */
export function parseSkuToCategoryCollection(name: string): {
  category: string | null;
  collection: string | null;
} {
  if (!name) return { category: null, collection: null };
  const trimmed = name.trim();
  if (!trimmed) return { category: null, collection: null };

  // Special-case perfume detection — name starting with "Woda" but containing
  // "perfumowana" (eau de parfum) is the Perfumy damskie category.
  const isPerfume = /\bwoda\s+perfumowana\b/i.test(trimmed);

  const dashIdx = trimmed.indexOf(' - ');
  const beforeDash = (dashIdx > 0 ? trimmed.slice(0, dashIdx) : trimmed).trim();
  const afterDash = dashIdx > 0 ? trimmed.slice(dashIdx + 3).trim() : '';

  const beforeTokens = beforeDash.split(/\s+/).filter(Boolean);
  if (beforeTokens.length === 0) return { category: null, collection: null };

  const isAlpha = (t: string) => /^[A-Za-zŁŚĆŻŹĄĘÓŃłśćżźąęóń]+$/.test(t);
  const isAllCaps = (t: string) => /^[A-ZŁŚĆŻŹĄĘÓŃ]{3,}$/.test(t);
  const isTitleCase = (t: string) =>
    /^[A-ZŁŚĆŻŹĄĘÓŃ][a-złśćżźąęóń]{1,}$/.test(t);
  const isProperName = (t: string) => isAllCaps(t) || isTitleCase(t);

  const firstAlpha = beforeTokens.find((t) => isAlpha(t) && t.length >= 3);
  if (!firstAlpha) return { category: null, collection: null };
  const rawCategory = firstAlpha.toUpperCase();
  const lemma = CATEGORY_LEMMA[rawCategory] ?? rawCategory;

  // Override: perfume names (Woda perfumowana ...) merge into ZAPACH bucket.
  let category: string | null;
  if (isPerfume) {
    category = 'ZAPACH';
  } else if (CANONICAL_CATEGORIES.has(lemma)) {
    category = lemma;
  } else {
    // Not a real Room99 category — drop so we don't pollute aggregates.
    category = null;
  }
  if (category === null) return { category: null, collection: null };

  // Collection discovery
  let collection: string | null = null;
  if (beforeTokens.length >= 2) {
    for (let i = beforeTokens.length - 1; i >= 1; i--) {
      const t = beforeTokens[i];
      const up = t.toUpperCase();
      if (isProperName(t) && up !== category && up !== rawCategory) {
        collection = up;
        break;
      }
    }
  }

  if (!collection && afterDash) {
    const afterTokens = afterDash.split(/\s+/).filter(Boolean);
    const caps: string[] = [];
    for (const t of afterTokens) {
      if (isProperName(t)) caps.push(t.toUpperCase());
      else break;
    }
    if (caps.length >= 2) collection = caps.join(' ');
  }

  return { category, collection };
}
