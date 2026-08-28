import { getGuestBook } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";

// MY GUEST BOOK — account-level reusable people (§10, §11).
//
// THE DISTINCTION THIS PAGE EXISTS TO MAKE, and which §10 says must be
// obvious:
//
//   My Guest Book = reusable people, across every gathering
//   My People     = the people for ONE gathering
//
// They are different tables, not different views: `guests` is owned by
// the user (owner_user_id = auth.uid()), while `gathering_guests` joins
// a guest to a gathering with an RSVP. That is what makes "you don't
// rebuild the same list every time" true rather than a claim.
//
// `is_saved` separates people the host deliberately kept from those
// created in passing for a single gathering. Both are shown, because
// hiding the unsaved ones would make the book look emptier than the
// account really is — but the saved ones lead.

export const metadata = { title: "My Guest Book" };

export default async function GuestBookPage() {
  const guests = await getGuestBook();
  const saved = guests.filter((g) => g.is_saved);
  const occasional = guests.filter((g) => !g.is_saved);

  const sections = [
    { key: "saved", heading: "Saved", rows: saved },
    { key: "occasional", heading: "Added for a gathering", rows: occasional },
  ].filter((s) => s.rows.length > 0);

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="My Guest Book"
        description="Keep the people you host most often in one place."
      />

      {guests.length === 0 ? (
        <EmptyState
          title="Your guest book is empty."
          body="The people you invite get saved here, so the next gathering doesn't start from a blank list."
          hint="People are added in the app, or as you build a guest list."
        />
      ) : (
        <>
          <p className="mt-6 font-body text-base text-forest/75">
            {guests.length} {guests.length === 1 ? "person" : "people"} you can
            invite again without typing anything twice.
          </p>

          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.key}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {section.heading} · {section.rows.length}
                </h3>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {section.rows.map((g) => {
                    const notes = [g.dietary_notes, g.allergy_notes].filter(
                      Boolean
                    );
                    return (
                      <li
                        key={g.id}
                        className="rounded-card border border-sage/30 bg-parchment p-4"
                      >
                        <p className="font-display text-lg text-forest">
                          {[g.first_name, g.last_name].filter(Boolean).join(" ")}
                        </p>
                        {g.household_name && (
                          <p className="font-body text-sm text-forest/65">
                            {g.household_name}
                          </p>
                        )}
                        {g.email && (
                          <p className="mt-1 font-body text-sm text-forest/55">
                            {g.email}
                          </p>
                        )}
                        {notes.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {notes.map((n, i) => (
                              <li
                                key={i}
                                className="rounded-full border border-sage/40 px-2.5 py-0.5 font-body text-xs text-forest/70"
                              >
                                {n}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <ReadOnlyNote what="guest book" />
        </>
      )}
    </div>
  );
}
