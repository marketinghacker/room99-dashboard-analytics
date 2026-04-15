/**
 * Product category mapping and aggregation.
 *
 * BaseLinker's get_products_sold returns data by SKU without category info.
 * This module provides SKU-to-category mapping based on product name patterns
 * and aggregation utilities for category-level analytics.
 *
 * Strategy:
 * 1. Parse category from product name patterns (e.g., "Sofa Modular COMO" → "Meble / Sofy")
 * 2. Fall back to a manual SKU prefix mapping
 * 3. Group products by category and aggregate revenue/transactions
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProductWithCategory {
  sku: string;
  name: string;
  category: string;
  rootCategory: string;
  revenue: number;
  quantity: number;
}

export interface CategoryAggregate {
  category: string;
  revenue: number;
  quantity: number;
  productCount: number;
  share: number; // % of total revenue
  change?: number;
}

/* ------------------------------------------------------------------ */
/*  Keyword-based category detection                                   */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['sofa', 'kanapa'], category: 'Meble / Sofy' },
  { keywords: ['fotel', 'bujany'], category: 'Meble / Fotele' },
  { keywords: ['krzesło', 'krzeslo'], category: 'Meble / Krzesła' },
  { keywords: ['łóżko', 'lozko', 'łoże', 'loze'], category: 'Meble / Łóżka' },
  { keywords: ['stolik kawowy', 'stolik'], category: 'Meble / Stoliki' },
  { keywords: ['stół', 'stol', 'jadalny'], category: 'Meble / Stoły' },
  { keywords: ['komoda'], category: 'Meble / Komody' },
  { keywords: ['regał', 'regal', 'półka', 'polka'], category: 'Meble / Regały' },
  { keywords: ['szafka nocna'], category: 'Meble / Szafki nocne' },
  { keywords: ['wieszak'], category: 'Przedpokój / Wieszaki' },

  { keywords: ['lampa wisząca', 'lampa wiszaca'], category: 'Oświetlenie / Lampy wiszące' },
  { keywords: ['lampa stojąca', 'lampa stojaca'], category: 'Oświetlenie / Lampy stojące' },
  { keywords: ['lampka biurkowa', 'lampka'], category: 'Oświetlenie / Lampki biurkowe' },

  { keywords: ['poduszka'], category: 'Dekoracje / Poduszki' },
  { keywords: ['dywan'], category: 'Dekoracje / Dywany' },
  { keywords: ['lustro'], category: 'Dekoracje / Lustra' },
  { keywords: ['wazon'], category: 'Dekoracje / Wazony' },
  { keywords: ['obraz'], category: 'Dekoracje / Obrazy' },
  { keywords: ['świecznik', 'swiecznik'], category: 'Dekoracje / Świeczniki' },
  { keywords: ['zegar'], category: 'Dekoracje / Zegary' },

  { keywords: ['koc', 'pled'], category: 'Tekstylia / Koce' },
  { keywords: ['pościel', 'posciel'], category: 'Tekstylia / Pościel' },
  { keywords: ['zasłona', 'zaslona', 'firanka', 'firana'], category: 'Tekstylia / Zasłony' },
  { keywords: ['narzuta'], category: 'Tekstylia / Narzuty' },

  { keywords: ['kosz na pranie', 'organizer łazienkowy', 'organizer lazienkowy'], category: 'Łazienka / Akcesoria' },
  { keywords: ['doniczka'], category: 'Ogród / Doniczki' },
];

/**
 * Detect category from product name using keyword matching.
 */
function detectCategoryFromName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  SKU prefix mapping (fallback)                                      */
/* ------------------------------------------------------------------ */

const SKU_PREFIX_MAP: Record<string, string> = {
  'COMO': 'Meble / Sofy',
  'BER': 'Meble / Fotele',
  'COP': 'Meble / Krzesła',
  'MAL': 'Meble / Łóżka',
  'NOR': 'Meble / Stoliki',
  'OSL': 'Meble / Stoły',
  'STK': 'Meble / Komody',
  'CUB': 'Meble / Regały',
  'VIE': 'Meble / Szafki nocne',
  'IND': 'Przedpokój / Wieszaki',

  'AUR': 'Oświetlenie / Lampy wiszące',
  'STU': 'Oświetlenie / Lampki biurkowe',

  'VEL': 'Dekoracje / Poduszki',
  'SAH': 'Dekoracje / Dywany',
  'INF': 'Dekoracje / Lustra',
  'CER': 'Dekoracje / Wazony',
  'ABS': 'Dekoracje / Obrazy',
  'NOI': 'Dekoracje / Świeczniki',
  'HEX': 'Dekoracje / Półki',
  'MIN': 'Dekoracje / Zegary',

  'ALP': 'Tekstylia / Koce',
  'BAM': 'Łazienka / Akcesoria',
  'STN': 'Łazienka / Akcesoria',
  'TER': 'Ogród / Doniczki',
};

function detectCategoryFromSku(sku: string): string | null {
  const prefix = sku.split('-')[0];
  return SKU_PREFIX_MAP[prefix] || null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Assign a category to a product based on its name and SKU.
 */
export function categorizeProduct(name: string, sku: string): string {
  return detectCategoryFromName(name) || detectCategoryFromSku(sku) || 'Inne';
}

/**
 * Extract root category (before " / ").
 */
export function getRootCategory(category: string): string {
  const slash = category.indexOf(' / ');
  return slash === -1 ? category : category.substring(0, slash);
}

/**
 * Enrich product data with categories.
 */
export function enrichWithCategories(
  products: Array<{ sku: string; name: string; revenue: number; quantity: number }>
): ProductWithCategory[] {
  return products.map((p) => {
    const category = categorizeProduct(p.name, p.sku);
    return {
      ...p,
      category,
      rootCategory: getRootCategory(category),
    };
  });
}

/**
 * Aggregate products by category.
 */
export function aggregateByCategory(products: ProductWithCategory[]): CategoryAggregate[] {
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const categoryMap = new Map<string, { revenue: number; quantity: number; count: number }>();

  for (const product of products) {
    const existing = categoryMap.get(product.rootCategory) || { revenue: 0, quantity: 0, count: 0 };
    existing.revenue += product.revenue;
    existing.quantity += product.quantity;
    existing.count += 1;
    categoryMap.set(product.rootCategory, existing);
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      quantity: data.quantity,
      productCount: data.count,
      share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Aggregate products by subcategory (full category path).
 */
export function aggregateBySubcategory(products: ProductWithCategory[]): CategoryAggregate[] {
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const categoryMap = new Map<string, { revenue: number; quantity: number; count: number }>();

  for (const product of products) {
    const existing = categoryMap.get(product.category) || { revenue: 0, quantity: 0, count: 0 };
    existing.revenue += product.revenue;
    existing.quantity += product.quantity;
    existing.count += 1;
    categoryMap.set(product.category, existing);
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      quantity: data.quantity,
      productCount: data.count,
      share: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
