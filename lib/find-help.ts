export interface FindHelpCategory {
  slug: string;
  label: string;
}

/**
 * Mirrored from native's canonical Find Help categories. This is a
 * presentation mirror only: no web-only taxonomy and no vendor database.
 * A host can always type something outside this common set.
 */
export const FIND_HELP_CATEGORIES: FindHelpCategory[] = [
  { slug: "catering", label: "Catering" },
  { slug: "cakes_desserts", label: "Cakes & desserts" },
  { slug: "balloons_decor", label: "Balloons & decor" },
  { slug: "tables_chairs_rentals", label: "Tables, chairs & rentals" },
  { slug: "soft_play_kids", label: "Soft play & kids" },
  { slug: "flowers", label: "Flowers" },
  { slug: "bartending_beverage", label: "Bartending & beverage" },
  { slug: "photography", label: "Photography" },
  { slug: "setup_cleanup", label: "Setup & cleanup" },
  { slug: "entertainment_activities", label: "Entertainment & activities" },
  { slug: "tents_outdoor_rentals", label: "Tents & outdoor rentals" },
];

export function getFindHelpCategory(slug: string | null | undefined) {
  return FIND_HELP_CATEGORIES.find((category) => category.slug === slug);
}

export function externalMapsSearchUrl(need: string, searchArea: string): string {
  const query = encodeURIComponent(`${need.trim()} near ${searchArea.trim()}`);
  return `https://www.google.com/maps/search/${query}`;
}
