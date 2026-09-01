import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGathering,
  getGatheringGuests,
  getContributions,
  getShoppingItems,
  getMenuItems,
  getExpenses,
  getClosetItems,
} from "@/lib/host-data";
import Icon, { type IconName } from "@/components/Icon";
import HostReadyDial from "@/components/host/HostReadyDial";
import NextUpPanel from "@/components/host/NextUpPanel";
import FigureItOutPanel from "@/components/host/FigureItOutPanel";
import WeatherPlanPanel from "@/components/host/WeatherPlanPanel";
import { getCanonicalNextUp } from "@/lib/next-up";
import { getFigureItOutOverviewState } from "@/lib/figure-it-out-data";
import { getWeatherWorkspace } from "@/lib/weather-data";
import { formatCurrency } from "@/lib/host-format";
import { usesOwnArtwork } from "@/lib/invitations";

// GATHERING COMMAND CENTRAL, composed to `host_web_gathering.png`.
// Figure It Out and Weather/Plan B belong to the gathering overview as
// planning intelligence, not as standalone Hosting Hub cards.
// HOSTREADY IS READ, NEVER RECOMPUTED HERE. Counts below are arithmetic
// facts over canonical rows, not a second readiness formula.

function StatTile({ icon, label, value, sub, href, action }: {
  icon: IconName; label: string; value: string; sub?: string; href: string; action: string;
}) {
  return (
    <li className="flex h-full flex-col rounded-2xl border border-sage/25 bg-parchment p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest"><Icon name={icon} size={19} /></span>
        <div className="min-w-0">
          <p className="font-body text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-forest/60">{label}</p>
          <p className="mt-1 font-display text-2xl leading-none text-forest">{value}</p>
          {sub && <p className="mt-1.5 font-body text-xs leading-snug text-forest/60">{sub}</p>}
        </div>
      </div>
      <Link href={href} className="mt-4 font-body text-xs font-semibold text-forest/75 underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-forest">
        {action} <span aria-hidden>&rarr;</span>
      </Link>
    </li>
  );
}

function Card({ title, href, action, children }: { title: string; href?: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-sage/25 bg-offwhite p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg text-forest">{title}</h2>
        {href && action && <Link href={href} className="flex-shrink-0 font-body text-xs font-semibold text-forest/70 underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-forest">{action} <span aria-hidden>&rarr;</span></Link>}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

export default async function GatheringOverviewPage({ params }: { params: { id: string } }) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();
  const base = `/host/g/${params.id}`;

  const [guests, contributions, shopping, menu, expenses, closet, nextUp, figureState, weatherState] = await Promise.all([
    getGatheringGuests(params.id),
    getContributions(params.id),
    getShoppingItems(params.id),
    getMenuItems(params.id),
    getExpenses(params.id).catch(() => []),
    getClosetItems().catch(() => []),
    getCanonicalNextUp(params.id).catch(() => []),
    getFigureItOutOverviewState(params.id),
    getWeatherWorkspace(params.id),
  ]);

  const coming = guests.filter((g) => g.rsvp_status === "yes");
  const declined = guests.filter((g) => g.rsvp_status === "no");
  const waiting = guests.filter((g) => g.rsvp_status === "invited" || g.rsvp_status === "no_response");
  const plusOnes = coming.reduce((n, g) => n + (g.plus_one_count || 0), 0);
  const committed = contributions.filter((c) => c.status === "claimed" || c.status === "confirmed");
  const openContributions = contributions.filter((c) => c.status === "needed" || c.status === "asked");
  const stillToBuy = shopping.filter((s) => s.status === "need");
  const estimatedRemaining = stillToBuy.reduce((n, s) => n + (s.estimated_cost ?? 0), 0);
  const spent = expenses.reduce((n, e) => n + (e.amount ?? 0), 0);

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <HostReadyDial score={gathering.current_hostready_score} state={gathering.readiness_state} gatheringId={params.id} />
        <NextUpPanel actions={nextUp} base={base} />
      </div>

      <FigureItOutPanel
        gatheringId={params.id}
        initialDietaryNotes={figureState.dietaryNotes}
        initialAccessibilityNotes={figureState.accessibilityNotes}
        hasPlan={figureState.hasPlan}
        readOnly={figureState.readOnly}
      />

      {weatherState && <WeatherPlanPanel initial={weatherState} />}

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="people" label="My People" value={String(coming.length + plusOnes)} sub={`${coming.length} yes · ${waiting.length} pending · ${declined.length} no`} href={`${base}/people`} action="View RSVPs" />
        <StatTile icon="gift" label="Who’s Bringing What" value={String(committed.length)} sub={openContributions.length > 0 ? `${openContributions.length} still unclaimed` : "all spoken for"} href={`${base}/contributions`} action="View Contributions" />
        <StatTile
          icon="cart"
          label="My Shopping"
          value={String(stillToBuy.length)}
          sub={spent > 0 ? `${formatCurrency(spent)} spent${estimatedRemaining > 0 ? ` · about ${formatCurrency(estimatedRemaining)} to go` : ""}` : estimatedRemaining > 0 ? `about ${formatCurrency(estimatedRemaining)} to go` : "items still to get"}
          href={`${base}/shopping`}
          action="View List & Budget"
        />
        <StatTile icon="closet" label="My Hosting Closet" value={String(closet.length)} sub="items you already own" href="/host/closet" action="View Closet" />
      </ul>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="My Table at a glance" href={`${base}/table`} action="View Full Menu">
          {menu.length === 0 ? (
            <p className="font-body text-sm leading-relaxed text-forest/70">Nothing on the table yet. Add a dish and we’ll suggest serving sizes for the number of people coming.</p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-4 border-b border-sage/20 pb-4">
                <div><dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/55">Dishes</dt><dd className="mt-1 font-display text-2xl text-forest">{menu.length}</dd></div>
                <div><dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/55">Serves</dt><dd className="mt-1 font-display text-2xl text-forest">{coming.length + plusOnes}</dd></div>
                <div><dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/55">Guests</dt><dd className="mt-1 font-display text-2xl text-forest">{gathering.expected_guest_count}</dd></div>
              </dl>
              <ul className="mt-4 space-y-1.5">
                {menu.slice(0, 4).map((m) => <li key={m.id} className="font-body text-sm text-forest/75">{m.name}</li>)}
                {menu.length > 4 && <li className="font-body text-sm text-forest/55">and {menu.length - 4} more</li>}
              </ul>
            </>
          )}
        </Card>

        <Card title="Invitations" href={`${base}/people`} action="Go to My People">
          <p className="font-body text-sm leading-relaxed text-forest/75">
            {usesOwnArtwork(gathering.invitation_mode)
              ? "You’re using your own invitation artwork for this one, and it’s the face of this gathering everywhere in Place & Plenty. Everything else works exactly the same."
              : "You can use a Place & Plenty invitation or bring your own artwork — either way the guest list, RSVPs and contributions all work the same."}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div><dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/55">Invited</dt><dd className="mt-1 font-display text-xl text-forest">{guests.length}</dd></div>
            <div><dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/55">Replied</dt><dd className="mt-1 font-display text-xl text-forest">{guests.length - waiting.length}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
