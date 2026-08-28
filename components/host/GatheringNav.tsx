"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The gathering's left-hand navigation.
//
// GROUPED THE WAY §9 GROUPS THE HOSTING HUB — food and the table, your
// people, the look and the day — so the web app and the native Hub
// describe the product identically. A host who learned the app on their
// phone should not have to relearn where anything is.
//
// WHAT IS AND IS NOT HERE, per §29's core-parity rule. Everything listed
// is a desktop-useful planning surface. Two Hub cards are deliberately
// absent, and §29 requires a product reason rather than "the app has
// it":
//
//   Host Mode  — it is the gathering-day surface, driven by phone
//                notifications and used while moving around the house.
//                A desktop Host Mode would be a screen nobody is sitting
//                at when it matters.
//   Space Mode — its input is a camera pointed at a room. The analysis
//                it produces could be shown on web, but the capture step
//                is the feature, and a viewer without a capture path
//                would be a dead end.
//
// Both are noted in the handoff as native-first with that reasoning, not
// silently dropped.
//
// A client component only because it needs usePathname() to mark the
// current page. Below `lg` it becomes a horizontal scroller rather than
// disappearing, so nothing here is unreachable on a phone.

const GROUPS = [
  {
    heading: "This gathering",
    items: [{ label: "Overview", segment: "" }],
  },
  {
    heading: "Food & the table",
    items: [
      { label: "My Table", segment: "table" },
      { label: "My Shopping", segment: "shopping" },
    ],
  },
  {
    heading: "Your people",
    items: [
      { label: "My People", segment: "people" },
      { label: "Who’s Bringing What", segment: "contributions" },
      { label: "My Co-Hosts", segment: "co-hosts" },
    ],
  },
];

export default function GatheringNav({ gatheringId }: { gatheringId: string }) {
  const pathname = usePathname();
  const base = `/host/g/${gatheringId}`;

  const href = (segment: string) => (segment ? `${base}/${segment}` : base);
  const isCurrent = (segment: string) => pathname === href(segment);

  return (
    <nav
      aria-label="Gathering"
      className="flex-shrink-0 border-b border-sage/25 pb-4 lg:w-56 lg:border-b-0 lg:pb-0"
    >
      {/* Horizontal, scrollable, below lg. The flex-row/flex-col switch
          is what stops this from being a hamburger nobody opens. */}
      <div className="-mx-6 flex gap-6 overflow-x-auto px-6 lg:mx-0 lg:flex-col lg:gap-7 lg:overflow-visible lg:px-0">
        {GROUPS.map((group) => (
          <div key={group.heading} className="flex-shrink-0">
            <h2 className="hidden font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/60 lg:block">
              {group.heading}
            </h2>
            <ul className="flex gap-4 lg:mt-3 lg:flex-col lg:gap-0.5">
              {group.items.map((item) => (
                <li key={item.segment}>
                  <Link
                    href={href(item.segment)}
                    aria-current={isCurrent(item.segment) ? "page" : undefined}
                    className="block whitespace-nowrap rounded-md py-1.5 font-body text-sm text-forest/80 transition-colors duration-400 hover:text-forest aria-[current=page]:font-semibold aria-[current=page]:text-forest lg:px-3 lg:hover:bg-forest/5 lg:aria-[current=page]:bg-forest/10"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
