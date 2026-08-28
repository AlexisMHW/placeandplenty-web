import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGathering,
  getGatheringGuests,
  getContributions,
  getShoppingItems,
  getMenuItems,
} from "@/lib/host-data";
import { WorkspaceHeader, Panel } from "@/components/host/Workspace";
import { gatheringTypeLabel, formatCurrency } from "@/lib/host-format";

// GATHERING OVERVIEW. §11 lists Overview, HostReady and Next Up as
// required gathering-level web capabilities.
//
// HOSTREADY IS READ, NOT RECOMPUTED. `current_hostready_score` and
// `readiness_state` are already on the gathering, calculated by the app
// against rules this repo does not have. Recomputing them here would
// produce a second, subtly different score — and the first time web said
// 71% while the phone said 68%, neither number would be trusted again.
//
// The counts below ARE derived here, but they are arithmetic over rows
// the page already holds (how many said yes, how many contributions are
// still open), not judgements. That distinction is the line: derive
// facts, never re-derive verdicts.

export default async function GatheringOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  const [guests, contributions, shopping, menu] = await Promise.all([
    getGatheringGuests(params.id),
    getContributions(params.id),
    getShoppingItems(params.id),
    getMenuItems(params.id),
  ]);

  const coming = guests.filter((g) => g.rsvp_status === "yes");
  const waiting = guests.filter(
    (g) => g.rsvp_status === "invited" || g.rsvp_status === "no_response"
  );
  const plusOnes = coming.reduce((n, g) => n + (g.plus_one_count || 0), 0);

  const openContributions = contributions.filter(
    (c) => c.status === "needed" || c.status === "asked"
  );
  const needsAttention = contributions.filter((c) => c.needs_host_attention);

  const stillToBuy = shopping.filter((s) => s.status === "need");
  const estimatedRemaining = stillToBuy.reduce(
    (n, s) => n + (s.estimated_cost ?? 0),
    0
  );

  const stats = [
    {
      label: "Coming",
      value: `${coming.length + plusOnes}`,
      detail:
        plusOnes > 0
          ? `${coming.length} replied yes, plus ${plusOnes}`
          : `of ${guests.length} invited`,
      href: `/host/g/${params.id}/people`,
    },
    {
      label: "Still to hear from",
      value: `${waiting.length}`,
      detail: waiting.length === 0 ? "Everyone has replied" : "No answer yet",
      href: `/host/g/${params.id}/people`,
    },
    {
      label: "On the table",
      value: `${menu.length}`,
      detail: menu.length === 1 ? "dish planned" : "dishes planned",
      href: `/host/g/${params.id}/table`,
    },
    {
      label: "Still to buy",
      value: `${stillToBuy.length}`,
      detail:
        estimatedRemaining > 0
          ? `about ${formatCurrency(estimatedRemaining)}`
          : "items on the list",
      href: `/host/g/${params.id}/shopping`,
    },
  ];

  return (
    <div>
      <WorkspaceHeader
        title="Overview"
        description={`Your ${gatheringTypeLabel(gathering.gathering_type).toLowerCase()}, as it stands right now.`}
      />

      <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="block h-full rounded-card border border-sage/30 bg-parchment p-5 transition-shadow duration-400 hover:shadow-softer"
            >
              <p className="font-body text-xs font-bold uppercase tracking-[0.15em] text-forest/70">
                {s.label}
              </p>
              <p className="mt-2 font-display text-3xl text-forest">
                {s.value}
              </p>
              <p className="mt-1 font-body text-sm text-forest/60">
                {s.detail}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {(needsAttention.length > 0 || openContributions.length > 0) && (
        <Panel className="mt-8">
          <h3 className="font-display text-xl text-forest">
            Worth a look
          </h3>
          <ul className="mt-4 space-y-2 font-body text-base text-forest/80">
            {needsAttention.length > 0 && (
              <li>
                <Link
                  href={`/host/g/${params.id}/contributions`}
                  className="underline decoration-gold underline-offset-4 hover:text-forest"
                >
                  {needsAttention.length}{" "}
                  {needsAttention.length === 1 ? "contribution needs" : "contributions need"}{" "}
                  your attention
                </Link>
              </li>
            )}
            {openContributions.length > 0 && (
              <li>
                <Link
                  href={`/host/g/${params.id}/contributions`}
                  className="underline decoration-gold underline-offset-4 hover:text-forest"
                >
                  {openContributions.length} still unclaimed
                </Link>
              </li>
            )}
            {waiting.length > 0 && (
              <li>
                <Link
                  href={`/host/g/${params.id}/people`}
                  className="underline decoration-gold underline-offset-4 hover:text-forest"
                >
                  {waiting.length} {waiting.length === 1 ? "person hasn’t" : "people haven’t"}{" "}
                  replied
                </Link>
              </li>
            )}
          </ul>
        </Panel>
      )}

      {/* §3/§10: invitation flexibility is real product behaviour, not
          just marketing copy — gatherings.invitation_mode records it. */}
      <Panel className="mt-8">
        <h3 className="font-display text-xl text-forest">Invitations</h3>
        <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
          {gathering.invitation_mode === "own_artwork"
            ? "You’re using your own invitation artwork for this one. Everything else still works exactly the same."
            : "You can use a Place & Plenty invitation, or bring your own artwork — either way the guest list, RSVPs and contributions all work the same."}
        </p>
        <Link
          href={`/host/g/${params.id}/people`}
          className="mt-4 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
        >
          Go to My People
          <span aria-hidden>&rarr;</span>
        </Link>
      </Panel>
    </div>
  );
}
