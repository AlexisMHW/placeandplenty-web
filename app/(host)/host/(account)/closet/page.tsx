import Link from "next/link";
import {
  getArchivedClosetItems,
  getClosetItems,
  signClosetPhotos,
} from "@/lib/host-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field } from "@/components/host/Editable";
import ClosetItemCard from "@/components/host/ClosetItemCard";
import { addClosetItem } from "@/lib/host-actions";

// MY HOSTING CLOSET (§9, food & the table) — "what you already have".
//
// THE CORRECTION THIS PAGE CARRIES. It used to explain that an empty
// list might mean "you own nothing" or might mean "this is a paid
// feature you don't have", because the RLS policy was
//
//   owner_user_id = auth.uid() AND user_can_access_closet(auth.uid())
//
// and a Free host got zero rows either way. That policy was wrong about
// the product. Basic inventory — adding, editing, quantities, colour,
// material, size, where it lives, a photo, and taking something out
// again — is FREE. The policy is now ownership alone, so an empty list
// here means an empty closet and the page can say so plainly.
//
// WHAT IS ACTUALLY PAID is the smart layer, and it does not live on this
// page at all. Matching a gathering's needs against what you own, and
// resolving the gap into borrow / rent / buy / not now, happens inside a
// gathering and is gated on a Gathering Pass bound to that gathering or
// on Place & Plenty Plus. The note at the foot of this page says that in
// those terms — "your Hosting Closet is always yours" — rather than
// making the closet itself look unavailable.
//
// THERE IS NO PAYWALL ON THIS SURFACE. If one appears, it is a bug.

export const metadata = { title: "My Hosting Closet" };

export default async function ClosetPage() {
  const [items, archived] = await Promise.all([
    getClosetItems(),
    getArchivedClosetItems(),
  ]);

  const photos = await signClosetPhotos([...items, ...archived]);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || "Everything else";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="My Hosting Closet"
        description="Keep what you already own in one place, so you stop buying it twice."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing in the closet yet."
          body="The Hosting Closet remembers what you own — platters, chairs, the good glasses — so you're not buying a fourth set of serving bowls."
          hint="It's yours on every plan. Add the first thing below."
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
                  {rows.map((item) => (
                    <ClosetItemCard
                      key={item.id}
                      item={item}
                      photoUrl={photos.get(item.id)}
                    />
                  ))}
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
          <Field name="size_label" label="Size" placeholder="Large" />
          <Field name="capacity_label" label="Holds" placeholder="Serves 12" />
          <Field name="notes" label="Where it lives" placeholder="Top of the hall cupboard" />
          <label className="block sm:col-span-2">
            <span className="mb-1 block font-body text-sm font-semibold text-forest">
              Photo
            </span>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full font-body text-sm text-forest/75"
            />
            <span className="mt-1 block font-body text-xs text-forest/55">
              Optional. Only you can see it.
            </span>
          </label>
        </div>
      </AddForm>

      {/* THE ONE SENTENCE THAT HAS TO BE RIGHT. §1: never describe basic
          Closet access as paid-only, and be precise about which
          capability is being shown. */}
      <p className="mt-10 rounded-card border border-sage/30 bg-cream px-5 py-4 font-body text-sm leading-relaxed text-forest/75">
        Your Hosting Closet is always yours. Smart matching — Place &amp;
        Plenty working out what you already have and what you still need for
        a gathering — is available with a Gathering Pass or Place &amp;
        Plenty Plus.
      </p>

      {archived.length > 0 && (
        <section className="mt-12">
          <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
            No longer owned · {archived.length}
          </h3>
          <p className="mt-2 max-w-prose font-body text-sm text-forest/60">
            Kept, not deleted. Past gatherings still remember that you had
            these, which is why a shopping list once said you didn&rsquo;t
            need to buy one.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((item) => (
              <ClosetItemCard
                key={item.id}
                item={item}
                photoUrl={photos.get(item.id)}
              />
            ))}
          </ul>
        </section>
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
