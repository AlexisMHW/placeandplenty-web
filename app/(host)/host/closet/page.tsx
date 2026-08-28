import Link from "next/link";
import { getClosetItems } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";

// MY HOSTING CLOSET (§9, food & the table) — "what you already have".
//
// AN EMPTY RESULT HERE IS AMBIGUOUS, AND THE PAGE MUST NOT PRETEND
// OTHERWISE. The RLS policy is:
//
//   owner_user_id = auth.uid() AND user_can_access_closet(auth.uid())
//
// so a user without the entitlement gets zero rows — exactly the same
// response as a user who genuinely owns nothing. Showing "your closet is
// empty, add something" to someone who cannot access the feature would
// be actively misleading: they would go looking for an add button that
// is not there for them.
//
// The web app cannot distinguish the two cases from the row count alone,
// so the empty state names both possibilities plainly rather than
// guessing. Resolving it properly needs an entitlement read the app
// already does; that is a follow-up, and saying so is better than
// shipping copy that is wrong for one of the two groups.

export const metadata = { title: "My Hosting Closet" };

export default async function ClosetPage() {
  const items = await getClosetItems();

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || "Everything else";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="My Hosting Closet"
        description="What you already own, so you stop buying it twice."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing in the closet yet."
          body="The Hosting Closet remembers what you own — platters, chairs, the good glasses — so a shopping list can tell you what you actually need."
          hint="Add things in the app. If the closet is part of a plan you don't have yet, it will be empty here too."
        />
      ) : (
        <>
          <p className="mt-6 font-body text-base text-forest/75">
            {items.length} {items.length === 1 ? "thing" : "things"} you already
            have.
          </p>

          <div className="mt-8 space-y-10">
            {Object.entries(grouped).map(([category, rows]) => (
              <section key={category}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {category}
                </h3>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((item) => {
                    const details = [
                      item.quantity_owned && item.quantity_owned > 1
                        ? `${item.quantity_owned}`
                        : null,
                      item.color,
                      item.material,
                      item.size_label,
                      item.capacity_label,
                    ].filter(Boolean);

                    return (
                      <li
                        key={item.id}
                        className="rounded-card border border-sage/30 bg-parchment p-4"
                      >
                        <p className="font-display text-lg text-forest">
                          {item.name}
                        </p>
                        {details.length > 0 && (
                          <p className="mt-0.5 font-body text-sm text-forest/65">
                            {details.join(" · ")}
                          </p>
                        )}
                        {item.notes && (
                          <p className="mt-1 font-body text-sm text-forest/60">
                            {item.notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <ReadOnlyNote what="hosting closet" />
        </>
      )}

      <p className="mt-10 font-body text-sm text-forest/60">
        Curious what it&rsquo;s for?{" "}
        <Link
          href="/what-it-does"
          className="underline decoration-gold underline-offset-4 hover:text-forest"
        >
          See what Place &amp; Plenty does
        </Link>
        .
      </p>
    </div>
  );
}
