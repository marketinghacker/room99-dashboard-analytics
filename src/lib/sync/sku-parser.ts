/**
 * Heuristic parser for Room99 product names.
 * Convention observed in BaseLinker: "KATEGORIA KOLEKCJA - reszta opisu".
 * Both KATEGORIA and KOLEKCJA are uppercase Polish words.
 */
export function parseSkuToCategoryCollection(name: string): {
  category: string | null;
  collection: string | null;
} {
  // Match leading: WORD WORD optional-whitespace dash
  const m = /^([A-ZŁŚĆŻŹĄĘÓŃ]{3,})\s+([A-ZŁŚĆŻŹĄĘÓŃ][A-ZŁŚĆŻŹĄĘÓŃ0-9]{1,})\s*-/u.exec(name);
  if (!m) return { category: null, collection: null };
  return { category: m[1], collection: m[2] };
}
