// Disclosure rule of the public projection (D12): general figures are published only when enough sites stand behind
// them, so nothing on a public page can be traced back to one site. Pure → tested on its own.

/** Fewest publicly listed sites behind an aggregate before it is shown. */
export const MIN_SITES_FOR_AGGREGATE = 3;

export type PublicCategory = { key: string; nameEn: string; nameDe: string };

/** Material categories offered in the region – or nothing while fewer than the threshold of sites are listed. */
export function publicCategories(listedSites: number, categories: PublicCategory[]): PublicCategory[] {
  if (listedSites < MIN_SITES_FOR_AGGREGATE) return [];
  const seen = new Set<string>();
  return categories.filter((category) => !seen.has(category.key) && seen.add(category.key)).map(({ key, nameEn, nameDe }) => ({ key, nameEn, nameDe }));
}
