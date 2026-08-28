// Product capability names, in one place, so a rename in the app is one
// edit here rather than a hunt through pages.
//
// EVERY NAME BELOW IS VERIFIED, and that constraint is the point.
//
// Directive §4 requires the website to match the current product, and §30
// asks for a sweep of stale terminology — My Address Book, My Shopping
// List, standalone My Budget, standalone My Invitations, 15-card Hosting
// Hub. Those are gone. What replaced them is taken from the app audit
// (P&P-V1-APP-CURRENT-STATE-POST-AUDIT.md §2 and §5) and the approved
// Visual Identity board's campaign pillars and feature row.
//
// WHAT IS DELIBERATELY NOT HERE: an enumeration of "the 12 cards".
//
// The audit states My Hosting Hub is now 12 cards rather than 15, and
// names the three that were absorbed and the two that were renamed — but
// it does not list all twelve. Publishing a guessed list would be exactly
// the failure §4 warns about: a website product diagram that does not
// match the app. So the site describes what Place & Plenty does, using
// names that are confirmed, and does not claim to mirror the Hub's
// navigation. If a real 12-card diagram is wanted, the list has to come
// from App Claude first.
//
// Confirmed renames, for anyone tempted to "correct" these back:
//   My Address Book   -> My Guest Book
//   My Shopping List  -> My Shopping        (List | Budget in one place)
//   My Budget         -> inside My Shopping
//   My Invitations    -> inside My People
//   Guest Communications -> inside My People

export interface Feature {
  name: string;
  body: string;
}

/**
 * The six from the approved board's feature row. Used on the homepage,
 * where the job is recognition rather than completeness.
 */
export const HEADLINE_FEATURES: Feature[] = [
  {
    name: "Figure It Out For Me",
    body: "Tell us the basics. Get a plan, a menu and a timeline in minutes.",
  },
  {
    name: "My Table",
    body: "Menus, dishes and serving counts — all in one place.",
  },
  {
    name: "My People",
    body: "Invite people, track RSVPs, message guests, keep everyone in the loop.",
  },
  {
    name: "My Shopping",
    body: "Lists, budget, receipts and co-host contributions together.",
  },
  {
    name: "HostReady™",
    body: "A live readiness score that tells you whether you're actually on track.",
  },
  {
    name: "My Hosting Closet",
    body: "See what you already own. Borrow less. Buy smarter.",
  },
];

/**
 * The fuller set for /what-it-does. Still only confirmed names — see the
 * note at the top of this file before adding to it.
 */
export const ALL_FEATURES: Feature[] = [
  ...HEADLINE_FEATURES,
  {
    name: "Next Up",
    body: "The one thing to do next, worked out for you rather than guessed at.",
  },
  {
    name: "Host Mode™",
    body: "On the day itself, what to do right now — not the whole plan at once.",
  },
  {
    name: "Space Mode",
    body: "Work out how the room actually flows before you move furniture.",
  },
  {
    name: "My Guest Book",
    body: "Keep the people you host most often in one place, gathering after gathering.",
  },
  {
    name: "Co-hosting",
    body: "Share a gathering with the person actually helping you pull it off.",
  },
  {
    name: "Contributions",
    body: "Who's bringing what, without four separate group chats.",
  },
];
