// Product architecture, in one place.
//
// §9 OF THE FINAL RECONCILIATION IS THE AUTHORITY HERE, and it is
// explicit about a distinction the previous version of this file got
// wrong: **do not mix Hosting Hub cards with account/system-level
// capabilities.**
//
// The Hub is TWELVE cards, in three groups. HostReady, Figure It Out,
// Next Up and My Guest Book are NOT Hub cards — they are system and
// account-level capabilities that sit around the Hub, and presenting
// them as peers of My Table misdescribes the product.
//
// Three names must never come back as standalone Hub cards (§9, §32):
//
//   My Invitations         -> a capability inside My People
//   Guest Communications   -> a capability inside My People
//   My Budget              -> absorbed into My Shopping as List | Budget,
//                             with receipts and expenses preserved
//
// Earlier renames, for anyone tempted to "correct" these back:
//   My Address Book  -> My Guest Book
//   My Shopping List -> My Shopping

export interface Feature {
  name: string;
  body: string;
}

export interface FeatureGroup {
  heading: string;
  features: Feature[];
}

/** The 12-card Hosting Hub, in §9's groups and §9's order. */
export const HOSTING_HUB: FeatureGroup[] = [
  {
    heading: "Food & the table",
    features: [
      {
        name: "My Table",
        body: "Plan your menu — dishes, quantities, dietary needs and how it all gets served.",
      },
      {
        name: "My Shopping",
        body: "What to get and what you’re spending, in one place. List and Budget, with receipts and co-host expenses.",
      },
      {
        name: "My Hosting Closet",
        body: "What you already have. Stop buying a fourth set of serving bowls.",
      },
    ],
  },
  {
    heading: "Your people",
    features: [
      {
        name: "My People",
        body: "Invite, track and message guests. One place for RSVPs, households, and everything you know about who’s coming.",
      },
      {
        name: "Who’s Bringing What",
        body: "Track contributions without running a potluck out of a group chat.",
      },
      {
        name: "My Co-Hosts",
        body: "Share the load with the person actually helping you pull it off.",
      },
    ],
  },
  {
    heading: "The look & the day",
    features: [
      {
        name: "Space Mode",
        body: "Work out how the room actually flows before you start moving furniture.",
      },
      {
        name: "Find Help",
        body: "Work out where an extra pair of hands would genuinely change the day.",
      },
      {
        name: "My Style Board",
        body: "Collect the look you’re going for, and keep track of what it needs.",
      },
      {
        name: "My Music & Media",
        body: "Sort the sound before people arrive, not during.",
      },
      {
        name: "Host Mode",
        body: "On the day itself: what to do right now, not the whole plan at once.",
      },
      {
        name: "My Gathering Photos",
        body: "The photos everyone took, in one place, without the group-chat scroll.",
      },
    ],
  },
];

/**
 * NOT Hosting Hub cards. §9: present these separately as system and
 * account-level capabilities. They span gatherings or sit above them.
 */
export const SYSTEM_CAPABILITIES: Feature[] = [
  {
    name: "Figure It Out For Me",
    body: "Tell us the basics. Get a plan, a menu and a timeline in minutes.",
  },
  {
    name: "HostReady™",
    body: "A readiness score that weighs what actually matters, not a checklist percentage.",
  },
  {
    name: "Next Up",
    body: "The one thing to do next, worked out for you rather than guessed at.",
  },
  {
    name: "My Guest Book",
    body: "Keep the people you host most often in one place — so you’re not rebuilding the same guest list every time.",
  },
];

/**
 * The six shown on the homepage, where the job is recognition rather
 * than completeness. Deliberately a MIX of Hub cards and system
 * capabilities, because a first-time visitor does not yet have a mental
 * model of the Hub to slot things into — the distinction is drawn
 * properly on /what-it-does, where there is room to draw it.
 */
export const HEADLINE_FEATURES: Feature[] = [
  SYSTEM_CAPABILITIES[0], // Figure It Out For Me
  HOSTING_HUB[0].features[0], // My Table
  HOSTING_HUB[1].features[0], // My People
  HOSTING_HUB[0].features[1], // My Shopping
  SYSTEM_CAPABILITIES[1], // HostReady
  HOSTING_HUB[0].features[2], // My Hosting Closet
];
