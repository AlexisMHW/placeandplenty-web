import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";
import { WEB_CHECKOUT_LIVE } from "@/lib/entitlements";

// THE CONVERSION PATHS. Founder instruction, 28 Aug 2026:
//
//   "On web, 'Download the app' should not be the only conversion path.
//    Start Free on Web | Buy on Web | Download for iPhone | Get it on
//    Android."
//
// WHY THIS IS A LIST AND NOT A BUTTON. Before this file, every CTA on
// the site resolved through lib/launch-state.ts to exactly one action,
// which meant the whole website funnelled toward the app — and the app
// is not the product, it is one of the places the product runs. A person
// who wants to plan a gathering at a desk on a Tuesday was being told to
// pick up their phone.
//
// Four paths, and they are not ranked by our preference — they are
// ranked by how ready the visitor is:
//
//   START FREE ON WEB    the widest door. No card, no download, no
//                        store account. §11's Free tier, used on web.
//   BUY ON WEB           for someone who already knows. Same canonical
//                        entitlement as a store purchase — see
//                        lib/entitlements.ts.
//   DOWNLOAD FOR IPHONE  ] the phone paths, for gathering-day use and
//   GET IT ON ANDROID    ] for people who simply prefer their phone.
//
// EVERY PATH IS GATED ON BEING REAL. A path whose destination does not
// exist yet is absent, never a dead link and never a button that
// explains why it cannot do anything. `availablePaths()` is the only
// function that decides, so no surface can render a store button the
// footer knows is not live.
//
// THE FREE PATH IS ALWAYS AVAILABLE, because /signup exists and works —
// it is the one conversion this website can genuinely complete today.

export type ConversionPathId = "free" | "buy" | "ios" | "android";

export interface ConversionPath {
  id: ConversionPathId;
  /** Used in the four-path list, where it has to distinguish itself. */
  label: string;
  /**
   * Used where the path appears ALONE, as a single button. "Start Free on
   * Web" earns its suffix beside "Download for iPhone"; on its own, in a
   * browser, telling someone they can start free *on the web* is telling
   * them where they already are.
   */
  shortLabel?: string;
  href: string;
  /** One line under the label. Says what happens, not why it is good. */
  detail: string;
  /** External store links open in a new tab; ours do not. */
  external?: boolean;
}

const FREE: ConversionPath = {
  id: "free",
  label: "Start Free on Web",
  shortLabel: "Start Free",
  href: "/signup",
  detail: "Create an account and plan your first gathering in the browser.",
};

const BUY: ConversionPath = {
  id: "buy",
  label: "Buy on Web",
  shortLabel: "Buy a Pass or Plus",
  href: "/pricing",
  detail: "A Gathering Pass or Plus, bought here and yours everywhere.",
};

export function availablePaths(): ConversionPath[] {
  const paths: ConversionPath[] = [FREE];

  if (WEB_CHECKOUT_LIVE) paths.push(BUY);

  if (APP_STORE_URL) {
    paths.push({
      id: "ios",
      label: "Download for iPhone",
      href: APP_STORE_URL,
      detail: "The same account and the same gatherings, in your pocket.",
      external: true,
    });
  }

  if (PLAY_STORE_URL) {
    paths.push({
      id: "android",
      label: "Get it on Android",
      href: PLAY_STORE_URL,
      detail: "The same account and the same gatherings, in your pocket.",
      external: true,
    });
  }

  return paths;
}

/**
 * The primary action, wherever a page needs exactly one. It is the free
 * web path — the only one that is always real, always free, and always
 * completes without leaving the site.
 */
export const PRIMARY_PATH = FREE;

/**
 * Said next to the paths, once per surface. It answers the question a
 * four-way choice creates ("does it matter which I pick?") and the
 * answer is the founder's governing rule.
 */
export const PATH_NOTE =
  "It’s one account either way. Start on the web and pick up on your phone, or the other way round — your gatherings and anything you’ve bought come with you.";

/**
 * Shown where the phone paths would be if the listings existed. This is
 * a schedule, not an apology, and it is the only place the site says
 * anything about the apps not being downloadable yet.
 */
export const STORES_PENDING_NOTE =
  "The iPhone and Android apps arrive with the app release. Everything below works in your browser today.";
