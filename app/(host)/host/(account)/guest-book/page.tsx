import { getGuestBook } from "@/lib/host-data";
import { getGuestBookAvatarUrls } from "@/lib/profile-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field } from "@/components/host/Editable";
import GuestBookEntry from "@/components/host/GuestBookEntry";
import { addGuestBookPerson } from "@/lib/host-actions";

// MY GUEST BOOK — account-level reusable people (§10, §11).
//
// My Guest Book = reusable people across gatherings. My People = people
// for one gathering. A P&P account photo may decorate either saved or
// historical guest rows when the host already owns the matching email,
// the account email is verified, and that account allows Guest Book
// photo sharing. The photo is never copied into `guests`.

export const metadata = { title: "My Guest Book" };

export default async function GuestBookPage() {
  const [{ saved, history }, avatars] = await Promise.all([
    getGuestBook(),
    getGuestBookAvatarUrls(),
  ]);

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
              <GuestBookEntry
                key={g.id}
                guest={g}
                saved
                avatarUrl={avatars.get(g.id)}
              />
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
              <GuestBookEntry
                key={g.id}
                guest={g}
                saved={false}
                avatarUrl={avatars.get(g.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
