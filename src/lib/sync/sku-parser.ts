/**
 * Heuristic parser for Room99 product names.
 *
 * Observed patterns in BaseLinker:
 *   1. "CATEGORY COLLECTION - rest"           → ZASŁONA AURA - BEŻOWA 140x250
 *   2. "CATEGORY MODIFIER COLLECTION - rest"  → ZASŁONA ZACIEMNIAJĄCA LAUREL - BEŻOWA
 *   3. "CATEGORY MOD1 MOD2 COLLECTION - rest" → NARZUTA NA ŁÓŻKO MOLLY - BEŻOWA
 *   4. Title case: "Poduszka Eternity MedLine PLUS"
 *   5. Collection after dash: "Zapach do domu w sprayu - Mon Ame 200 ml"
 *
 * Rule:
 *   category   = first alphabetic token (3+ letters), uppercased
 *   collection = last proper-name token (all-caps ≥3 or Title-case ≥2) before " - "
 *                that isn't the category itself;
 *                fallback to multi-word capitalized group right after " - " (for #5).
 *
 * Single-word names like "PRODUKT" yield category-only (collection null) — better
 * than dropping them entirely, so Shoper-only ungrouped lines still aggregate.
 */
export function parseSkuToCategoryCollection(name: string): {
  category: string | null;
  collection: string | null;
} {
  if (!name) return { category: null, collection: null };
  const trimmed = name.trim();
  if (!trimmed) return { category: null, collection: null };

  // Split on first " - " only (some names contain multiple dashes in size specs).
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

  // Category: first token that's a real alpha word with ≥3 letters.
  const firstAlpha = beforeTokens.find((t) => isAlpha(t) && t.length >= 3);
  if (!firstAlpha) return { category: null, collection: null };
  const category = firstAlpha.toUpperCase();

  // Collection: walk backward from last before-dash token, pick first proper name
  // that isn't the category itself.
  let collection: string | null = null;
  if (beforeTokens.length >= 2) {
    for (let i = beforeTokens.length - 1; i >= 1; i--) {
      const t = beforeTokens[i];
      if (isProperName(t) && t.toUpperCase() !== category) {
        collection = t.toUpperCase();
        break;
      }
    }
  }

  // Fallback: multi-word capitalized group right after dash ("Mon Ame" etc.).
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
