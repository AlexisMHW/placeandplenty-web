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
import { formatGatheringDate, gatheringTypeLabel } from "@/lib/host-format";
import { ESSENCE } from "@/lib/brand";

// HOST HOME, composed to `host_web_home.png`.
//
// §15 is explicit that this is the ACCOUNT-level home and not a
// gathering's Command Central, and it names the architecture:
//
//   left    "My Gatherings" — the host's gatherings, listed VERTICALLY,
//           each using its invitation artwork as its visual identity,
//           with date, status, HostReady and place
//   right   the NEXT UPCOMING GATHERING as the primary hero, given the
//           largest visual treatment on the page
//   under   account-level panels: My Hosting Closet, My Guest Book
//
// THE UPCOMING HERO IS AN APPROVED INTERACTION PATTERN, in §15's words,
// and it is the thing that makes this page a home rather than a list:
// the gathering you are actually about to host is the one you came here
// for, so it gets the space.
//
// THE ARTWORK IS THE IDENTITY. §16: "Do not replace the gathering
// identity with generic P&P photography. P&P frames the gathering. The
// invitation identifies it." Every row and the hero go through
// GatheringIdentity, so a host recognises their gatherings here the same
// way they do on their phone.
//
// WHAT THE REFERENCE SHOWS THAT PRODUCT TRUTH CORRECTS. Its stat tiles
// read My People / Who's Bringing What / My Shopping List / My Budget.
// §9 renamed My Shopping List to My Shopping and absorbed My Budget into
// it as List | Budget — a standalone Budget tile is one of the three
// names §32 forbids bringing back. Its sidebar also carries "Shop My
// Party", which is not a Place & Plenty feature. Composition from the
// reference; names from the reconciliation.
//
// NUMBERS ARE READ, NEVER INVENTED. The reference fills its tiles with
// 24 / 11 / 28 / $312. Rendering plausible-looking figures on a page a
// host uses to decide what to do next would be the worst possible place
// to guess, so each panel shows what the canonical tables actually
// return and says nothing where there is nothing to say.

export const metadata = { title: "My Host Hub" };

const UPCOMING = ["active", "hosting"];

function nextUpcoming(gatherings: GatheringSummary[]): GatheringSummary | null {
  const today = new Date().toISOString().slice(0, 10);
  return (
    gatherings
      .filter((g) => UPCOMING.includes(g.status) && g.gathering_date >= today)
      .sort((a, b) => a.gathering_date.localeCompare(b.gathering_date))[0] ??
    null
  );
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

export default async function HostHomePage() {
  const [gatherings, guestBook, closet, profile] = await Promise.all([
    getMyGatherings(),
    getGuestBook().catch(() => []),
    getClosetItems().catch(() => []),
    getProfile(),
  ]);

  const artwork = await signArtwork(gatherings);
  const hero = nextUpcoming(gatherings);
  const firstName = profile?.first_name || profile?.display_name || null;

  const listed = gatherings.filter((g) =>
    ["draft", "active", "hosting"].includes(g.status)
  );
  const past = gatherings.filter((g) =>
    ["completed", "archived", "cancelled"].includes(g.status)
  );

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 md:px-8 md:py-10">
      {/* ---- welcome ------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl leading-tight text-forest md:text-[2.5rem]">
            Welcome back{firstName ? `, ${firstName}` : ""}
            <BotanicalSprig className="text-olive" size={34} />
          </h1>
          <p className="mt-2 font-body text-base text-forest/70">
            Everything you need to host beautifully, in one place.
          </p>
        </div>

        <div className="hidden max-w-sm items-start gap-3 rounded-2xl bg-cream px-5 py-4 lg:flex">
          <Icon name="leaf" size={20} className="mt-0.5 flex-shrink-0 text-olive" />
          <p className="font-display text-base italic leading-snug text-forest">
            {ESSENCE}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* ---- My Gatherings ---------------------------------------- */}
        <section
          id="gatherings"
          className="rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl text-forest">My Gatherings</h2>
            <p className="font-body text-xs text-forest/55">
              {listed.length} active
            </p>
          </div>

          {listed.length === 0 ? (
            <div className="mt-6 rounded-xl border border-sage/25 bg-parchment px-5 py-10 text-center">
              <BotanicalSprig className="mx-auto text-olive" size={48} />
              <p className="mt-4 font-display text-lg text-forest">
                Nothing on the calendar yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-forest/70">
                Create a gathering here or in the app — it is the same account
                either way, and it will appear in both.
              </p>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {listed.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/host/g/${g.id}`}
                    className="group flex items-stretch gap-4 rounded-xl border border-sage/25 bg-parchment p-3 transition-shadow duration-400 hover:shadow-softer"
                  >
                    <GatheringIdentity
                      name={g.name}
                      artworkUrl={artwork.get(g.id)}
                      className="h-24 w-32 flex-shrink-0 rounded-lg"
                      sizes="128px"
                    />

                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-display text-lg leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
                          {g.name}
                        </h3>
                        <span className="rounded-md bg-forest/10 px-2 py-0.5 font-body text-[0.6rem] font-bold uppercase tracking-[0.12em] text-forest/75">
                          {g.status}
                        </span>
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-forest/70">
                        <span className="flex items-center gap-1.5">
                          <Icon name="calendar" size={13} />
                          {formatGatheringDate(g.gathering_date, g.arrival_time)}
                        </span>
                        {g.location_name && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="pin" size={13} />
                            {g.location_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Icon name="users" size={13} />
                          {g.expected_guest_count}
                        </span>
                      </p>

                      {typeof g.current_hostready_score === "number" && (
                        <div className="mt-2.5 flex items-center gap-3">
                          <span className="font-body text-xs font-semibold text-forest/75">
                            {g.current_hostready_score}% HostReady
                          </span>
                          <span
                            aria-hidden
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-sage/25"
                          >
                            <span
                              className="block h-full rounded-full bg-forest"
                              style={{
                                width: `${Math.min(100, Math.max(0, g.current_hostready_score))}%`,
                              }}
                            />
                          </span>
                        </div>
                      )}
                    </div>

                    <span
                      aria-hidden
                      className="flex flex-shrink-0 items-center pr-1 text-forest/40 transition-colors duration-400 group-hover:text-forest"
                    >
                      <Icon name="arrow" size={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 rounded-xl border border-dashed border-sage/45 px-5 py-4 text-center font-body text-sm text-forest/70">
            Gatherings are created in the Place &amp; Plenty app, and appear
            here the moment they are.
          </p>

          {past.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer font-body text-sm text-forest/70 hover:text-forest">
                {past.length} finished {past.length === 1 ? "gathering" : "gatherings"}
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

        {/* ---- the upcoming hero and the account panels -------------- */}
        <div className="space-y-6">
          {hero ? (
            <section className="relative overflow-hidden rounded-2xl">
              <GatheringIdentity
                name={hero.name}
                artworkUrl={artwork.get(hero.id)}
                className="absolute inset-0 h-full w-full"
                sizes="(min-width: 1280px) 45vw, 100vw"
                priority
                overlay
              />

              <div className="relative flex min-h-[19rem] flex-col justify-end p-7 md:p-8">
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] text-gold">
                  Up next
                </p>
                <h2 className="mt-2.5 max-w-md font-display text-3xl leading-tight text-offwhite md:text-[2.3rem]">
                  {hero.name}
                </h2>
                <span aria-hidden className="mt-4 block h-[2px] w-14 bg-gold" />

                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-body text-sm text-offwhite/85">
                  <span className="flex items-center gap-2">
                    <Icon name="calendar" size={15} />
                    {formatGatheringDate(hero.gathering_date, hero.arrival_time)}
                  </span>
                  {hero.location_name && (
                    <span className="flex items-center gap-2">
                      <Icon name="pin" size={15} />
                      {hero.location_name}
                    </span>
                  )}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/host/g/${hero.id}`}
                    className="rounded-lg bg-offwhite px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-cream"
                  >
                    Open Gathering
                  </Link>
                  <ReadinessBadge
                    state={hero.readiness_state}
                    score={hero.current_hostready_score}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-sage/25 bg-cream px-6 py-10 text-center">
              <BotanicalSprig className="mx-auto text-olive" size={48} />
              <p className="mt-4 font-display text-xl text-forest">
                Nothing coming up yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-relaxed text-forest/70">
                When you have a gathering on the calendar, the next one lands
                here with everything you need to open it.
              </p>
            </section>
          )}

          {/* Account-level panels, per §15. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon="book"
              label="My Guest Book"
              value={String(guestBook.length)}
              sub={
                guestBook.length === 1
                  ? "person you host"
                  : "people you host most"
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
                Browse ideas, menus and checklists to make your gathering
                unforgettable.
              </p>
            </div>
            <Link
              href="/gathering-ideas"
              className="flex-shrink-0 rounded-lg border border-forest/30 px-5 py-2.5 text-center font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
            >
              Explore Ideas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
