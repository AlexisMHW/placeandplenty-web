import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGathering,
  getGatheringGuests,
  getMenuItems,
  signArtwork,
} from "@/lib/host-data";
import { getMultiDayWorkspace } from "@/lib/multi-day-data";
import GatheringIdentity from "@/components/host/GatheringIdentity";
import { WorkspaceHeader } from "@/components/host/Workspace";
import GelatoConnectionPanel from "@/components/host/GelatoConnectionPanel";
import PaperSuiteOrderBuilder from "@/components/host/PaperSuiteOrderBuilder";

export const metadata = { title: "My Paper Suite" };
export const dynamic = "force-dynamic";

const TEMPLATES = [
  ["Classic Editorial", "Cream, forest and restrained type.", "bg-cream border-gold/30"],
  ["Soft Botanical", "Sage-forward with botanical warmth.", "bg-sage/20 border-sage/40"],
  ["Modern Clean", "Crisp spacing and a quieter contemporary layout.", "bg-offwhite border-forest/20"],
  ["Warm Celebration", "Parchment and warm accents for milestone gatherings.", "bg-parchment border-gold/35"],
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  appetizer: "Appetizers",
  protein: "Main Table",
  side: "Sides",
  dessert: "Dessert",
  beverage: "Beverages",
  other: "Also Serving",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

function formatTime(value: string | null) {
  if (!value) return null;
  const parts = value.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(parts[0], parts[1], 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: parts[1] ? "2-digit" : undefined,
  }).format(d);
}

export default async function PaperSuitePage({ params }: { params: { id: string } }) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  const [menu, guests, artwork] = await Promise.all([
    getMenuItems(params.id),
    getGatheringGuests(params.id),
    signArtwork([gathering]),
  ]);

  const invitationUrl = artwork.get(gathering.id) ?? null;
  const multiDay =
    gathering.duration_type === "multi_day"
      ? await getMultiDayWorkspace(params.id)
      : null;

  const groupedMenu = Object.entries(
    menu.reduce<Record<string, typeof menu>>((acc, item) => {
      const key = item.category || "other";
      (acc[key] ||= []).push(item);
      return acc;
    }, {})
  );

  const placeCardNames = guests
    .filter((guest) => guest.rsvp_status === "yes")
    .map((guest) =>
      [guest.guest?.first_name?.trim(), guest.guest?.last_name?.trim()]
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean);

  const days =
    multiDay?.days.map((day) => ({
      ...day,
      activities: multiDay.activities
        .filter((activity) => activity.gathering_day_id === day.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    })) ?? [];

  const base = "/host/g/" + params.id;

  return (
    <div>
      <WorkspaceHeader
        title="My Paper Suite"
        description="Turn the gathering you already planned into coordinated printed pieces — without retyping the details."
      />

      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="overflow-hidden rounded-2xl border border-gold/30 bg-cream">
          <div className="p-5">
            <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">
              Match what you already have
            </p>
            <h2 className="mt-2 font-display text-2xl text-forest">Match My Invitation</h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
              {invitationUrl
                ? "Use your invitation as the visual starting point, then coordinate the rest of the paper suite around it."
                : "Upload an invitation in My People & Invitations first, then return here to coordinate the suite."}
            </p>
          </div>
          <GatheringIdentity
            name={gathering.name}
            artworkUrl={invitationUrl}
            className="min-h-[18rem] border-t border-gold/20"
            fit="contain"
            sizes="(min-width: 1024px) 34vw, 100vw"
          />
          <div className="p-5">
            <Link
              href={base + "/people"}
              className="font-body text-sm font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4"
            >
              {invitationUrl ? "Review invitation artwork" : "Upload invitation artwork"} →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6">
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
            Or start with Place & Plenty
          </p>
          <h2 className="mt-2 font-display text-2xl text-forest">Four house designs</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/65">
            Your gathering data fills these controlled print templates automatically.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map(([label, body, classes]) => (
              <div key={label} className={"min-h-[9rem] rounded-xl border p-4 text-forest " + classes}>
                <p className="font-display text-lg">{label}</p>
                <div className="mt-2 h-px w-10 bg-current opacity-30" />
                <p className="mt-3 font-body text-xs leading-relaxed opacity-75">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
              Created from this gathering
            </p>
            <h2 className="mt-2 font-display text-2xl text-forest">Your live paper-ready content</h2>
          </div>
          <p className="font-body text-xs text-forest/55">
            Print ordering follows after Gelato product mapping.
          </p>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-sage/25 bg-cream p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">Menu Card</p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">{gathering.name}</h3>
            <p className="mt-1 text-center font-body text-xs uppercase tracking-[0.14em] text-forest/55">Menu</p>
            <div className="mx-auto mt-4 h-px w-12 bg-gold/60" />
            {groupedMenu.length === 0 ? (
              <p className="mt-6 text-center font-body text-sm text-forest/60">
                Add dishes in My Table and they will appear here automatically.
              </p>
            ) : (
              <div className="mt-5 space-y-4 text-center">
                {groupedMenu.map(([category, items]) => (
                  <div key={category}>
                    <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                      {CATEGORY_LABEL[category] || category}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {items.slice(0, 7).map((item) => (
                        <li key={item.id} className="font-body text-sm text-forest/80">{item.name}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <Link href={base + "/table"} className="mt-6 block text-center font-body text-xs font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4">
              Edit in My Table →
            </Link>
          </article>

          <article className="rounded-2xl border border-sage/25 bg-parchment p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">
              {gathering.duration_type === "multi_day" ? "Weekend Itinerary" : "Gathering Details"}
            </p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">{gathering.name}</h3>
            <p className="mt-1 text-center font-body text-xs text-forest/55">
              {formatDate(gathering.gathering_date)}
              {gathering.gathering_end_date ? " – " + formatDate(gathering.gathering_end_date) : ""}
            </p>
            <div className="mx-auto mt-4 h-px w-12 bg-gold/60" />
            {days.length > 0 ? (
              <div className="mt-5 space-y-5">
                {days.slice(0, 4).map((day) => (
                  <div key={day.id}>
                    <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/55">
                      {day.title || formatDate(day.day_date)}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {day.activities.slice(0, 5).map((activity) => (
                        <li key={activity.id} className="font-body text-sm text-forest/78">
                          {formatTime(activity.start_time) && (
                            <span className="mr-2 font-semibold">{formatTime(activity.start_time)}</span>
                          )}
                          {activity.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-2 text-center font-body text-sm text-forest/70">
                <p>{gathering.location_name || "Location to be added"}</p>
                <p>{formatTime(gathering.arrival_time) || "Time to be added"}</p>
              </div>
            )}
            {gathering.duration_type === "multi_day" && (
              <Link href={base + "/schedule"} className="mt-6 block text-center font-body text-xs font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4">
                Edit My Schedule →
              </Link>
            )}
          </article>

          <article className="rounded-2xl border border-gold/25 bg-parchment p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">Invitation</p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">{gathering.name}</h3>
            <p className="mt-2 text-center font-body text-sm leading-relaxed text-forest/65">
              Create a coordinated invitation from the gathering details already in Place & Plenty, or use your uploaded invitation as the suite reference.
            </p>
            <div className="mx-auto mt-5 h-px w-12 bg-gold/60" />
            <p className="mt-5 text-center font-body text-xs uppercase tracking-[0.12em] text-forest/50">
              4 × 6 · 5 × 7 · 5 × 5 square
            </p>
          </article>

          <article className="rounded-2xl border border-sage/25 bg-offwhite p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">Place Cards</p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">Your People</h3>
            <p className="mt-1 text-center font-body text-xs text-forest/55">
              {placeCardNames.length} confirmed guest{placeCardNames.length === 1 ? "" : "s"}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {placeCardNames.slice(0, 8).map((name) => (
                <div key={name} className="flex min-h-[4.5rem] items-center justify-center rounded-lg border border-sage/25 bg-cream px-3 text-center font-display text-sm text-forest">
                  {name}
                </div>
              ))}
            </div>
            {placeCardNames.length === 0 && (
              <p className="mt-5 text-center font-body text-sm text-forest/60">
                Confirmed guests will flow here automatically.
              </p>
            )}
            <Link href={base + "/people"} className="mt-6 block text-center font-body text-xs font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4">
              Review My People →
            </Link>
          </article>

          <article className="rounded-2xl border border-gold/25 bg-offwhite p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">Welcome Sign</p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">A larger welcome piece from the same gathering.</h3>
            <p className="mt-3 text-center font-body text-sm leading-relaxed text-forest/65">
              Pull the gathering name, date and location into a coordinated 8 × 10 or A4 sign.
            </p>
            <div className="mx-auto mt-5 h-px w-12 bg-gold/60" />
            <p className="mt-5 text-center font-body text-xs uppercase tracking-[0.12em] text-forest/50">
              8 × 10 · A4
            </p>
          </article>

          <article className="rounded-2xl border border-sage/25 bg-cream p-6 shadow-soft">
            <p className="font-body text-[0.6rem] font-bold uppercase tracking-[0.18em] text-goldInk">Thank-You Card</p>
            <h3 className="mt-3 text-center font-display text-2xl text-forest">Keep the suite together after the gathering.</h3>
            <p className="mt-3 text-center font-body text-sm leading-relaxed text-forest/65">
              Start with the gathering identity, add an editable message and print a coordinated follow-up card.
            </p>
            <div className="mx-auto mt-5 h-px w-12 bg-gold/60" />
            <p className="mt-5 text-center font-body text-xs uppercase tracking-[0.12em] text-forest/50">
              4 × 6 · 5 × 7 · 5 × 5 square
            </p>
          </article>
        </div>
      </section>

      <PaperSuiteOrderBuilder gatheringId={params.id} multiDay={gathering.duration_type === "multi_day"} />

      <GelatoConnectionPanel />

      <section className="mt-8 rounded-2xl border border-gold/30 bg-forest p-6 text-offwhite md:p-7">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-gold">Next connection</p>
        <h2 className="mt-2 font-display text-2xl">Preview → quantity → print quote → order</h2>
        <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-offwhite/75">
          The paper content is already reading from your canonical Place & Plenty gathering. Gelato will sit behind this surface for product selection, print quotes and fulfillment; Stripe remains the customer payment layer.
        </p>
      </section>
    </div>
  );
}
