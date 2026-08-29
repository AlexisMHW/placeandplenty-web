import Link from "next/link";
import { Band } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";

// THE CATEGORY RAIL, from `Gathering_Ideas_Page.png`.
//
// A row of circular icon plates with a label under each, the first one
// filled forest as the active state and the rest on cream. To its left,
// a short paragraph and a link — the reference puts explanatory copy
// beside the rail rather than above it, which keeps the row of circles
// reading as navigation instead of as a feature strip.
//
// EACH CHIP CARRIES ITS COUNT, which the reference does not show and
// which earns its place: a category rail whose chips lead to two items
// each should say so. It also makes the page honest about its own size
// at this stage of the library rather than implying depth that is not
// there yet.
//
// THE CHIPS ARE ANCHOR LINKS, not filter state. The page groups its
// cards by season into real sections with ids, so a chip scrolls to a
// heading that exists. That works without JavaScript, is linkable, and
// degrades into genuine client-side filtering later without changing
// what a visitor sees.

export interface RailCategory {
  label: string;
  count: number;
  icon: IconName;
  href?: string;
}

export default function CategoryRail({
  intro,
  categories,
  introHref = "/how-it-works",
  introLabel = "How Gathering Ideas work",
}: {
  intro: string;
  categories: RailCategory[];
  introHref?: string;
  introLabel?: string;
}) {
  return (
    <Band tone="parchment">
      <div className="mx-auto max-w-editorial px-6 py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1.58fr)] lg:items-center lg:gap-12">
          <div>
            <p className="max-w-xs font-body text-sm leading-relaxed text-forest/75">
              {intro}
            </p>
            <Link
              href={introHref}
              className="mt-3 inline-block font-body text-sm font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-sage"
            >
              {introLabel} <span aria-hidden>&rarr;</span>
            </Link>
          </div>

          <nav aria-label="Idea categories">
            {/* LEFT-ALIGNED, ALWAYS. This was justify-between at lg,
                which is right for the reference's seven categories and
                absurd for the two the library currently has — they ended
                up at opposite ends of the band with a void between them.
                A rail that spaces itself by content count looks broken
                until the content catches up. */}
            <ul className="flex flex-wrap justify-start gap-x-8 gap-y-6">
              {categories.map((c, i) => {
                const href =
                  c.href ??
                  (i === 0
                    ? "#all-ideas"
                    : `#${c.label.toLowerCase().replace(/\s+/g, "-")}`);

                return (
                  <li key={c.label} className="w-20 text-center">
                    <Link href={href} className="group block">
                      <span
                        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-400 ${
                          i === 0
                            ? "bg-forest text-offwhite"
                            : "bg-cream text-forest group-hover:bg-sage/25"
                        }`}
                      >
                        <Icon name={c.icon} size={24} />
                      </span>
                      <span className="mt-2.5 block font-body text-xs font-semibold leading-tight text-forest/80">
                        {c.label}
                      </span>
                      <span className="mt-0.5 block font-body text-[0.68rem] text-forest/50">
                        {c.count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </Band>
  );
}
