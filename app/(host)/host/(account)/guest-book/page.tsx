import { getGuestBook } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field } from "@/components/host/Editable";
import GuestBookEntry from "@/components/host/GuestBookEntry";
import { addGuestBookPerson } from "@/lib/host-actions";

// MY GUEST BOOK — account-level reusable people (§10, §11).
//
// THE DISTINCTION THIS PAGE EXISTS TO MAKE:
//
//   My Guest Book = reusable people, across every gathering
//   My People     = the people for ONE gathering
//
// They are different tables, not different views: `guests` is owned by
// the user (owner_user_id = auth.uid()), while `gathering_guests` joins
// a guest to a gathering with an RSVP. That is what makes "you don't
// rebuild the same list every time" true rather than a claim.
//
// WHAT CHANGED, AND WHY. This page used to render every `guests` row as
// a Guest Book entry, with the unsaved ones under a heading reading
// "Added for a gathering". That made the book look larger than it is and
// blurred the one thing it means. My Guest Book is the people the host
// DELIBERATELY KEPT — `is_saved = true` — and that is now the page.
//
// THE UNSAVED ROWS ARE STILL HERE, and deleting them was never an
// option: `gathering_guests` references them, and they carry the RSVP,
// the dietary note and the contribution for a real gathering that
// happened. They live under "Previously invited", clearly separate,
// described as history rather than as saved entries, and each one can be
// promoted into the book with a single press. Nothing is hidden and
// nothing is misrepresented.

export const metadata = { title: "My Guest Book" };

export default async function GuestBookPage() {
  const { saved, history } = await getGuestBook();

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="My Guest Book"
        description="Keep the people you host most often in one place."
      />

      {saved.length === 0 ? (
        <EmptyState
          title="Your guest book is empty."
          body="The people you keep here come back on every guest list, so the next gathering doesn't start from a blank page."
          hint={
            history.length > 0
              ? "Someone you've already invited is below — keep them and they'll be here next time."
              : undefined
          }
        />
      ) : (
        <>
          <p className="mt-6 font-body text-base text-forest/75">
            {saved.length} {saved.length === 1 ? "person" : "people"} you can
            invite again without typing anything twice.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {saved.map((g) => (
              <GuestBookEntry key={g.id} guest={g} saved />
            ))}
          </ul>
        </>
      )}

      <AddForm
        label="Add someone"
        submitLabel="Add to my guest book"
        action={addGuestBookPerson}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="first_name" label="First name" required placeholder="Dana" />
          <Field name="last_name" label="Last name" placeholder="Whitfield" />
          <Field
            name="household_name"
            label="Household"
            placeholder="The Whitfields"
          />
          <Field name="email" label="Email" type="email" placeholder="optional" />
          <Field name="phone" label="Phone" placeholder="optional" />
          <Field name="dietary_notes" label="Dietary" placeholder="No shellfish" />
          <Field name="allergy_notes" label="Allergies" placeholder="optional" />
          <Field
            name="accessibility_notes"
            label="Accessibility"
            placeholder="Step-free access"
          />
        </div>
      </AddForm>

      {history.length > 0 && (
        <section className="mt-14 border-t border-sage/25 pt-10">
          <h2 className="font-display text-xl text-forest">
            Previously invited
          </h2>
          <p className="mt-1.5 max-w-prose font-body text-base text-forest/70">
            People added for one gathering and never kept. Their replies and
            what they brought are all still on those gatherings — this is
            simply the list of who you haven&rsquo;t added to the book yet.
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {history.map((g) => (
              <GuestBookEntry key={g.id} guest={g} saved={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
