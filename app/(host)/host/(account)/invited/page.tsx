import Link from "next/link";
import Icon from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";
import {
  getMyInvitedGatherings,
  InvitedGatheringsError,
  type InvitedGathering,
} from "@/lib/invited-gatherings";

export const metadata = { title: "Gatherings I’m Invited To" };
export const dynamic = "force-dynamic";

function rsvpLabel(status: string) {
  if (status === "yes") return "Going";
  if (status === "maybe") return "Maybe";
  if (status === "no") return "Not going";
  return "Awaiting RSVP";
}

function formatDateTime(value: string, arrivalTime: string) {
  const date = new Date(`${value}T${arrivalTime || "12:00:00"}`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function InvitationCard({ item }: { item: InvitedGathering }) {
  const cancelled = item.gathering.status === "cancelled";
  return (
    <Link
      href={`/invite/${item.publicToken}`}
      className="group block rounded-2xl border border-sage/25 bg-parchment p-5 transition-all duration-400 hover:-translate-y-px hover:border-gold/55 hover:shadow-softer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gold-dark">
            {item.gathering.hostDisplayName
              ? `Hosted by ${item.gathering.hostDisplayName}`
              : "You’re invited"}
          </p>
          <h3 className="mt-1 font-display text-xl text-forest">{item.gathering.name}</h3>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 font-body text-[0.65rem] font-bold uppercase tracking-[0.08em] text-forest/70">
          {cancelled ? "Cancelled" : rsvpLabel(item.rsvpStatus)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-body text-sm text-forest/70">
        <span className="flex items-center gap-2">
          <Icon name="calendar" size={14} />
          {formatDateTime(item.gathering.date, item.gathering.arrivalTime)}
        </span>
        {item.gathering.locationName && (
          <span className="flex items-center gap-2">
            <Icon name="pin" size={14} />
            {item.gathering.locationName}
          </span>
        )}
      </div>

      {cancelled && item.gathering.cancellationMessage && (
        <p className="mt-4 rounded-xl bg-cream px-4 py-3 font-body text-sm text-forest/75">
          {item.gathering.cancellationMessage}
        </p>
      )}

      <p className="mt-4 font-body text-xs font-semibold text-forest/70 group-hover:text-forest">
        Open guest page <span aria-hidden>→</span>
      </p>
    </Link>
  );
}

function InvitationSections({
  upcoming,
  past,
}: {
  upcoming: InvitedGathering[];
  past: InvitedGathering[];
}) {
  return (
    <>
      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl text-forest">Upcoming</h2>
          <span className="font-body text-xs text-forest/55">
            {upcoming.length} {upcoming.length === 1 ? "invitation" : "invitations"}
          </span>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-sage/25 bg-cream px-6 py-10 text-center">
            <p className="font-display text-lg text-forest">No upcoming invitations yet.</p>
            <p className="mx-auto mt-2 max-w-lg font-body text-sm text-forest/65">
              When a host invites your verified email, the gathering will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {upcoming.map((item) => <InvitationCard key={item.bindingId} item={item} />)}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-forest">Past</h2>
        {past.length === 0 ? (
          <p className="mt-3 font-body text-sm text-forest/55">No past invited gatherings yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {past.map((item) => <InvitationCard key={item.bindingId} item={item} />)}
          </div>
        )}
      </section>
    </>
  );
}

export default async function InvitedGatheringsPage() {
  let data = { verifiedEmail: "", upcoming: [] as InvitedGathering[], past: [] as InvitedGathering[] };
  let state: "ready" | "verify_email" | "error" = "ready";

  try {
    data = await getMyInvitedGatherings();
  } catch (error) {
    state =
      error instanceof InvitedGatheringsError && error.code === "verified_email_required"
        ? "verify_email"
        : "error";
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex items-start gap-4">
        <BotanicalSprig className="mt-1 text-olive" size={34} />
        <div>
          <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-gold-dark">
            Guest side
          </p>
          <h1 className="mt-1 font-display text-3xl text-forest md:text-[2.5rem]">
            Gatherings I’m Invited To
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
            Invitations connected to your verified account email appear here automatically. Opening one keeps you in the guest experience; it does not give you host or co-host access.
          </p>
        </div>
      </div>

      {state === "verify_email" ? (
        <section className="mt-8 rounded-2xl border border-gold/35 bg-cream px-6 py-8">
          <h2 className="font-display text-2xl text-forest">Verify your email first</h2>
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
            Invitations are matched only to a verified account email. Verify the email on your Place & Plenty account, then come back here. We won&apos;t reveal whether invitations exist until verification is complete.
          </p>
          <Link
            href="/host/account"
            className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite"
          >
            Go to account settings
          </Link>
        </section>
      ) : state === "error" ? (
        <section className="mt-8 rounded-2xl border border-sage/25 bg-cream px-6 py-8">
          <h2 className="font-display text-2xl text-forest">We couldn&apos;t load your invitations.</h2>
          <p className="mt-2 font-body text-sm text-forest/70">Please refresh and try again.</p>
        </section>
      ) : (
        <InvitationSections upcoming={data.upcoming} past={data.past} />
      )}
    </div>
  );
}
