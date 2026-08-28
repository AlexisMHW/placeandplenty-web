import Link from "next/link";
import { getMyGatherings } from "@/lib/host-data";
import { formatGatheringDate, gatheringTypeLabel } from "@/lib/host-format";
import ReadinessBadge from "@/components/host/ReadinessBadge";

// MY GATHERINGS — the host web app's front door (§11).
//
// Grouped by where a gathering is in its life rather than listed by
// date, because those are different jobs. What is coming up needs
// attention; what is finished is a record; a draft is a decision not yet
// made. A single date-sorted list makes a draft from March look like
// next weekend's dinner.
//
// The gathering_status enum is: draft | active | hosting | completed |
// archived | cancelled. `hosting` means it is happening right now, so it
// sorts to the top on its own.
//
// EVERY ROW HERE IS A CANONICAL RECORD (§2). These are the same rows the
// native app reads — no web mirror, no sync step, nothing to reconcile.
// A gathering created on a phone this morning is in this list.

export const metadata = { title: "My Gatherings" };

const GROUPS = [
  {
    key: "now",
    heading: "Happening now",
    statuses: ["hosting"],
    empty: null,
  },
  {
    key: "upcoming",
    heading: "Coming up",
    statuses: ["active"],
    empty: "Nothing on the calendar yet.",
  },
  {
    key: "draft",
    heading: "Drafts",
    statuses: ["draft"],
    empty: null,
  },
  {
    key: "past",
    heading: "Finished",
    statuses: ["completed", "archived", "cancelled"],
    empty: null,
  },
];

export default async function MyGatheringsPage() {
  const gatherings = await getMyGatherings();

  return (
    <div className="mx-auto max-w-[90rem] px-6 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-forest md:text-4xl">
            My Gatherings
          </h1>
          <p className="mt-2 font-body text-base text-forest/70">
            Everything you&rsquo;re hosting, on the same account as the app.
          </p>
        </div>
      </div>

      {gatherings.length === 0 ? (
        <div className="mt-10 rounded-card border border-sage/30 bg-cream p-8">
          <h2 className="font-display text-xl text-forest">
            Nothing here yet.
          </h2>
          <p className="mt-2 max-w-prose font-body text-base leading-relaxed text-forest/75">
            Gatherings you create in the Place &amp; Plenty app show up here
            automatically — it&rsquo;s the same account and the same
            gatherings, so there&rsquo;s nothing to sync or import.
          </p>
          <Link
            href="/get"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Get the app
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {GROUPS.map((group) => {
            const rows = gatherings.filter((g) =>
              group.statuses.includes(g.status)
            );
            if (rows.length === 0 && !group.empty) return null;

            return (
              <section key={group.key}>
                <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
                  {group.heading}
                </h2>

                {rows.length === 0 ? (
                  <p className="mt-4 font-body text-base text-forest/60">
                    {group.empty}
                  </p>
                ) : (
                  <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {rows.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/host/g/${g.id}`}
                          className="group flex h-full flex-col rounded-card border border-sage/30 bg-parchment p-6 shadow-softer transition-shadow duration-400 hover:shadow-soft"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-body text-xs font-bold uppercase tracking-[0.15em] text-forest/70">
                              {gatheringTypeLabel(g.gathering_type)}
                            </p>
                            <ReadinessBadge
                              state={g.readiness_state}
                              score={g.current_hostready_score}
                            />
                          </div>

                          <h3 className="mt-3 font-display text-2xl leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
                            {g.name}
                          </h3>

                          <p className="mt-2 font-body text-base text-forest/75">
                            {formatGatheringDate(
                              g.gathering_date,
                              g.arrival_time
                            )}
                          </p>

                          <p className="mt-1 font-body text-sm text-forest/60">
                            {g.expected_guest_count}{" "}
                            {g.expected_guest_count === 1 ? "guest" : "guests"}
                            {g.location_name ? ` · ${g.location_name}` : ""}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
