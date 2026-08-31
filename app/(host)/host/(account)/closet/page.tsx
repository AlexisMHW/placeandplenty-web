import Link from "next/link";
import { getClosetItems } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, ActionButton } from "@/components/host/Editable";
import { addClosetItem, archiveClosetItem } from "@/lib/host-actions";

// MY HOSTING CLOSET — account-level reusable inventory.
//
// Product truth:
// - Free: basic Closet organization and owner CRUD.
// - Gathering Pass / Plus: smart gathering-specific Closet intelligence
//   such as what is covered, what is missing, and Shopping quantity reduction.
//
// This page is the basic inventory surface and must never imply that the
// Closet itself requires a paid entitlement.

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
          body="Keep the things you host with here — platters, chairs, the good glasses — so My Shopping can help you see what you already have before you buy more."
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
                        <ActionButton
                          action={archiveClosetItem.bind(null, item.id)}
                          confirm={`Remove ${item.name} from your closet?`}
                          title={`Remove ${item.name}`}
                          className="mt-2 font-body text-xs text-forest/55 underline decoration-sage/50 underline-offset-4 transition-colors duration-400 hover:text-error"
                        >
                          I don&rsquo;t have this any more
                        </ActionButton>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <AddForm
        label="Add something you own"
        submitLabel="Add to my closet"
        action={addClosetItem}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="What is it" required placeholder="Large serving platter" />
          <Field name="category" label="Kind of thing" placeholder="Serveware" />
          <Field name="quantity_owned" label="How many" type="number" placeholder="2" />
          <Field name="color" label="Colour" placeholder="White" />
          <Field name="material" label="Material" placeholder="Stoneware" />
          <Field name="notes" label="Where it lives" placeholder="Top of the hall cupboard" />
        </div>
      </AddForm>

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
