// One nav definition, used by the header (desktop bar and mobile panel),
// the footer, and the sitemap. Adding a public page means adding it here
// once — a page that exists but appears in none of the three is a page
// nobody finds.
//
// The split is by prominence, not by importance: PRIMARY is what fits on
// a desktop bar without crowding, SECONDARY is everything else a visitor
// may still want. The mobile panel and the footer show both.
//
// Order follows the approved board's WEBSITE STRUCTURE (V1) list.

export interface NavItem {
  label: string;
  href: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "What It Does", href: "/what-it-does" },
  { label: "Gathering Ideas", href: "/gathering-ideas" },
  { label: "The Coordinated Host", href: "/coordinated-host" },
  { label: "Pricing", href: "/pricing" },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: "Show Us How You Gather", href: "/show-us-how-you-gather" },
  { label: "About", href: "/about" },
  { label: "Support", href: "/support" },
];

/** Legal and account routes. Footer only — never in the main nav. */
export const UTILITY_NAV: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Delete Account", href: "/delete-account" },
];

export const SOCIAL_LINKS: NavItem[] = [
  { label: "Instagram", href: "https://instagram.com/placeandplenty" },
  { label: "Facebook", href: "https://facebook.com/placeandplenty" },
  { label: "TikTok", href: "https://tiktok.com/@placeandplenty" },
  { label: "YouTube", href: "https://youtube.com/@placeandplenty" },
];

/**
 * Every indexable public route, for app/sitemap.ts.
 *
 * Guest routes are deliberately absent: /invite/[token] and
 * /gallery/[token] are per-recipient links that must never be discovered
 * or crawled. robots.ts disallows them; listing them here would undo
 * that. Content routes (articles, ideas, stories) are appended by the
 * sitemap itself from Tina, since only it knows what is published.
 */
export const STATIC_SITEMAP_ROUTES: string[] = [
  "/",
  ...PRIMARY_NAV.map((n) => n.href),
  ...SECONDARY_NAV.map((n) => n.href),
  ...UTILITY_NAV.map((n) => n.href),
  "/founding-host",
];
