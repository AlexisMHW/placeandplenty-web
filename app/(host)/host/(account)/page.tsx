import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import GatheringIdentity from "@/components/host/GatheringIdentity";
import ReadinessBadge from "@/components/host/ReadinessBadge";
import { BotanicalSprig } from "@/components/Botanical";
import {
  getMyGatherings,
  getGuestBook,
  getClosetItems,
  getProfile,
  signArtwork,
  type GatheringSummary,
} from "@/lib/host-data";
import { formatGatheringDate } from "@/lib/host-format";
import { ESSENCE } from "@/lib/brand";

export const metadata = { title: "My Gatherings" };

const OPEN = ["draft", "active", "hosting"];
const FINISHED = ["completed", "archived", "cancelled"];

function nextLockedIn(gatherings: GatheringSummary[]): GatheringSummary | null {
  return (
    gatherings.find((g) =>
      ["active", "hosting"].includes(g.effective_status)
    ) ?? null
  );
}

function nextDraft(gatherings: GatheringSummary[]): GatheringSummary | null {
  return gatherings.find((g) => g.effective_status === "draft") ?? null;
}

function statusLabel(status: string): string {
  if (status === "active") return "Locked in";
  if (status === "hosting") return "Hosting";
  if (status === "draft") return "Draft";
  return status.replace(/_/g, " ");
}

function StatTile({
  icon,
  label,
  value,
  sub,
  href,
  action,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-sage/25 bg-parchment p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest">
          <Icon name={icon} size={19} />
        </span>
        <div className="min-w-0">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest/60">
            {label}
          </p>
          <p className="mt-1 font-display text-2xl leading-none text-forest">
            {value}
          </p>
          {sub && (
            <p className="mt-1.5 font-body text-xs text-forest/60">{sub}</p>
          )}
        </div>
      </div>
      <Link
        href={href}
        className="mt-4 font-body text-xs font-semibold text-forest/75 underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-forest"
      >
        {action} <span aria-hidden>&rarr;</span>
      </Link>
    </div>
  );
}

function GatheringRow({
  gathering,
  artworkUrl,
}: {
  gathering: GatheringSummary;
  artworkUrl?: string;
}) {
  const isDraft = gathering.effective_status === "draft";
  const href = isDraft
    ? `/host/create?editId=${gathering.id}`
    : `/host/g/${gathering.id}`;

  return (
    <li>
      <Link
        href={href}
        className="group flex items-stretch gap-4 rounded-xl border border-sage/25 bg-parchment p-3 transition-all duration-400 hover:-translate-y-px hover:border-sage/45 hover:shadow-softer"
      >
        <GatheringIdentity
          name={gathering.name}
          artworkUrl={artworkUrl}
          className="h-24 w-32 flex-shrink-0 rounded-lg"
          sizes="128px"
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-display text-lg leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
              {gathering.name}
            </h3>
            <span
              className={`rounded-full px-2.5 py-1 font-body text-[0.58rem] font-bold uppercase tracking-[0.12em] ${
                isDraft
                  ? "border border-gold/35 bg-gold/10 text-forest/70"
                  : "bg-forest/10 text-forest/75"
              }`}
            >
              {statusLabel(gathering.effective_status)}
            </span>
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-forest/70">
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={13} />
              {formatGatheringDate(
                gathering.gathering_date,
                gathering.arrival_time
              )}
            </span>
            {gathering.location_name && (
              <span className="flex items-center gap-1.5">
                <Icon name="pin" size={13} />
                {gathering.location_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Icon name="users" size={13} />
              {gathering.expected_guest_count}
            </span>
          </p>

          {typeof gathering.current_hostready_score === "number" && (
            <div className="mt-2.5 flex items-center gap-3">
              <span className="font-body text-xs font-semibold text-forest/75">
                {gathering.current_hostready_score}% HostReady
              </span>
              <span
                aria-hidden
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-sage/25"
              >
                <span
                  className="block h-full rounded-full bg-forest"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, gathering.current_hostready_score)
                    )}%`,
                  }}
                />
              </span>
            </div>
          )}

          {isDraft && (
            <p className="mt-2 font-body text-[0.68rem] font-semibold text-gold-dark">
              Continue setup <span aria-hidden>&rarr;</span>
            </p>
          )}
        </div>

        <span
          aria-hidden
          className="flex flex-shrink-0 items-center pr-1 text-forest/35 transition-colors duration-400 group-hover:text-forest"
        >
          <Icon name="arrow" size={18} />
        </span>
      </Link>
    </li>
  );
}

export default async function HostHomePage() {
  const [gatherings, guestBook, closet, profile] = await Promise.all([
    getMyGatherings(),
    getGuestBook().catch(() => ({ saved: [], history: [] })),
    getClosetItems().catch(() => []),
    getProfile(),
  ]);

  const artwork = await signArtwork(gatherings);
  const lockedHero = nextLockedIn(gatherings);
  const draftHero = lockedHero ? null : nextDraft(gatherings);
  const firstName = profile?.first_name || profile?.display_name || null;

  const listed = gatherings.filter((g) => OPEN.includes(g.effective_status));
  const drafts = listed.filter((g) => g.effective_status === "draft");
  const lockedIn = listed.filter((g) =>
    ["active", "hosting"].includes(g.effective_status)
  );
  const past = gatherings.filter((g) => FINISHED.includes(g.effective_status));

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-gold-dark">
            Your hosting home
          </p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-3xl leading-tight text-forest md:text-[2.5rem]">
            Welcome back{firstName ? `, ${firstName}` : ""}
            <BotanicalSprig className="text-olive" size={30} />
          </h1>
          <p className="mt-2 font-body text-base text-forest/70">
            Your gatherings, your people, and what you already have — all in one place.
          </p>
        </div>

        <div className="hidden max-w-sm items-start gap-3 rounded-2xl bg-cream px-5 py-4 lg:flex">
          <Icon
            name="leaf"
            size={20}
            className="mt-0.5 flex-shrink-0 text-olive"
          />
          <p className="font-display text-base italic leading-snug text-forest">
            {ESSENCE}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section
          id="gatherings"
          className="rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                Plan & host
              </p>
              <h2 className="mt-1 font-display text-2xl text-forest">
                My Gatherings
              </h2>
            </div>
            {listed.length > 0 && (
              <p className="font-body text-xs text-forest/55">
                {listed.length} open
                {drafts.length > 0 ? ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"}` : ""}
              </p>
            )}
          </div>

          {listed.length === 0 ? (
            <div className="mt-6 rounded-xl border border-sage/25 bg-parchment px-5 py-10 text-center">
              <BotanicalSprig className="mx-auto text-olive" size={44} />
              <p className="mt-4 font-display text-lg text-forest">
                Nothing on the calendar yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-forest/70">
                Start your first gathering here or in the app. It is the same Place & Plenty account either way.
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {listed.map((g) => (
                <GatheringRow
                  key={g.id}
                  gathering={g}
                  artworkUrl={artwork.get(g.id)}
                />
              ))}
            </ul>
          )}

          <Link
            href="/host/create"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-sage/55 px-5 py-4 text-center font-body text-sm font-semibold text-forest transition-colors duration-400 hover:border-forest hover:bg-forest/5"
          >
            <Icon name="plus" size={16} />
            Start a gathering
          </Link>

          {past.length > 0 && (
            <details className="mt-5 border-t border-sage/20 pt-4">
              <summary className="cursor-pointer font-body text-sm text-forest/70 hover:text-forest">
                {past.length} past {past.length === 1 ? "gathering" : "gatherings"}
              </summary>
              <ul className="mt-3 space-y-2">
                {past.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/host/g/${g.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 font-body text-sm text-forest/75 hover:bg-forest/5"
                    >
                      <span className="truncate">{g.name}</span>
                      <span className="flex-shrink-0 text-xs text-forest/50">
                        {formatGatheringDate(g.gathering_date, g.arrival_time)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <div className="space-y-6">
          {lockedHero ? (
            <section className="relative overflow-hidden rounded-2xl shadow-softer">
              <GatheringIdentity
                name={lockedHero.name}
                artworkUrl={artwork.get(lockedHero.id)}
                className="absolute inset-0 h-full w-full"
                sizes="(min-width: 1280px) 45vw, 100vw"
                priority
                overlay
              />
              <div className="relative flex min-h-[20rem] flex-col justify-end p-7 md:p-8">
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">
                  Up next
                </p>
                <h2 className="mt-2.5 max-w-md font-display text-3xl leading-tight text-offwhite md:text-[2.3rem]">
                  {lockedHero.name}
                </h2>
                <span aria-hidden className="mt-4 block h-[2px] w-14 bg-gold" />
                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-body text-sm text-offwhite/85">
                  <span className="flex items-center gap-2">
                    <Icon name="calendar" size={15} />
                    {formatGatheringDate(
                      lockedHero.gathering_date,
                      lockedHero.arrival_time
                    )}
                  </span>
                  {lockedHero.location_name && (
                    <span className="flex items-center gap-2">
                      <Icon name="pin" size={15} />
                      {lockedHero.location_name}
                    </span>
                  )}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/host/g/${lockedHero.id}`}
                    className="rounded-lg bg-offwhite px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-cream"
                  >
                    Open Gathering
                  </Link>
                  <ReadinessBadge
                    state={lockedHero.readiness_state}
                    score={lockedHero.current_hostready_score}
                  />
                </div>
              </div>
            </section>
          ) : draftHero ? (
            <section className="relative overflow-hidden rounded-2xl border border-gold/30 bg-cream shadow-softer">
              <div className="absolute inset-y-0 right-0 hidden w-[42%] opacity-90 sm:block">
                <GatheringIdentity
                  name={draftHero.name}
                  artworkUrl={artwork.get(draftHero.id)}
                  className="h-full w-full"
                  sizes="360px"
                />
              </div>
              <div className="relative min-h-[20rem] p-7 sm:max-w-[64%] md:p-8">
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold-dark">
                  Continue planning
                </p>
                <h2 className="mt-3 font-display text-3xl leading-tight text-forest">
                  {draftHero.name}
                </h2>
                <span aria-hidden className="mt-4 block h-[2px] w-12 bg-gold" />
                <p className="mt-4 font-body text-sm leading-relaxed text-forest/70">
                  This gathering is still a draft. Pick up where you left off and lock it in when the plan is ready.
                </p>
                <p className="mt-4 flex items-center gap-2 font-body text-sm text-forest/75">
                  <Icon name="calendar" size={15} />
                  {formatGatheringDate(
                    draftHero.gathering_date,
                    draftHero.arrival_time
                  )}
                </p>
                <Link
                  href={`/host/create?editId=${draftHero.id}`}
                  className="mt-6 inline-flex rounded-lg bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
                >
                  Continue Draft
                </Link>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-sage/25 bg-cream px-6 py-10 text-center">
              <BotanicalSprig className="mx-auto text-olive" size={44} />
              <p className="mt-4 font-display text-xl text-forest">
                Ready when people are.
              </p>
              <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-forest/70">
                Start a gathering and this space will keep the one that needs your attention closest at hand.
              </p>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon="book"
              label="My Guest Book"
              value={String(guestBook.saved.length)}
              sub={
                guestBook.saved.length === 1
                  ? "person you host often"
                  : "people you host often"
              }
              href="/host/guest-book"
              action="Open Guest Book"
            />
            <StatTile
              icon="closet"
              label="My Hosting Closet"
              value={String(closet.length)}
              sub={closet.length === 1 ? "item on hand" : "items on hand"}
              href="/host/closet"
              action="Open Closet"
            />
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-sage/25 bg-parchment p-6 sm:flex-row sm:items-center sm:gap-6">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest">
              <Icon name="sparkle" size={22} />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-lg text-forest">
                Need inspiration?
              </h2>
              <p className="mt-1.5 font-body text-sm leading-relaxed text-forest/70">
                Browse gathering ideas when you know you want people over but have not decided the rest yet.
              </p>
            </div>
            <Link
              href="/gathering-ideas"
              className="flex-shrink-0 rounded-lg border border-forest/30 px-5 py-2.5 text-center font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
            >
              Explore Ideas
            </Link>
          </div>

          {lockedIn.length === 0 && drafts.length > 1 && (
            <p className="px-1 font-body text-xs leading-relaxed text-forest/55">
              You have {drafts.length} drafts open. Drafts use an open-gathering slot, but they do not count toward the Plus annual lock-in allowance until you finish the create-gathering flow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
