import Link from "next/link";
import { notFound } from "next/navigation";
import HostShell, { type HostNavGroup } from "@/components/host/HostShell";
import GatheringIdentity from "@/components/host/GatheringIdentity";
import GatheringContextStrip from "@/components/host/GatheringContextStrip";
import ReadinessBadge from "@/components/host/ReadinessBadge";
import Icon from "@/components/Icon";
import {
  getGathering,
  getGatheringGuests,
  signArtwork,
} from "@/lib/host-data";
import { formatGatheringDate, daysUntil } from "@/lib/host-format";

// THE GATHERING WORKSPACE — one gathering, one identity, one set of
// canonical planning surfaces. The invitation/artwork remains the face
// of the gathering while P&P supplies the framing and planning system.

export default async function GatheringLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  const [artwork, guests] = await Promise.all([
    signArtwork([gathering]),
    getGatheringGuests(params.id).catch(() => null),
  ]);

  const days = daysUntil(gathering.gathering_date);
  const base = `/host/g/${gathering.id}`;

  const groups: HostNavGroup[] = [
    {
      items: [
        { label: "Overview", href: base, icon: "house", exact: true },
        { label: "My Hosting Hub", href: `${base}/hub`, icon: "grid" },
      ],
    },
    {
      heading: "Food & the table",
      items: [
        { label: "My Table", href: `${base}/table`, icon: "table" },
        { label: "My Shopping", href: `${base}/shopping`, icon: "cart" },
      ],
    },
    {
      heading: "Your people",
      items: [
        {
          label: "My People",
          href: `${base}/people`,
          icon: "people",
          count: guests?.length ?? null,
        },
        {
          label: "Who’s Bringing What",
          href: `${base}/contributions`,
          icon: "gift",
        },
        { label: "My Co-Hosts", href: `${base}/co-hosts`, icon: "cohosts" },
      ],
    },
    {
      heading: "The look & the day",
      items: [
        { label: "My Style Board", href: `${base}/style`, icon: "board" },
        { label: "My Music & Media", href: `${base}/music`, icon: "music" },
        { label: "My Gathering Photos", href: `${base}/photos`, icon: "photo" },
        { label: "Find Help", href: `${base}/find-help`, icon: "search" },
      ],
    },
    {
      heading: "Settings",
      items: [
        { label: "Gathering details", href: `${base}/settings`, icon: "settings" },
      ],
    },
  ];

  return (
    <HostShell
      tone="light"
      groups={groups}
      title={gathering.name}
      backHref="/host"
      backLabel="My Gatherings"
      topBar={
        <>
          <ReadinessBadge
            state={gathering.readiness_state}
            score={gathering.current_hostready_score}
          />
          <Link
            href={`${base}/hub`}
            className="hidden items-center gap-2 rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite shadow-soft transition-colors duration-300 hover:bg-forest/90 sm:flex"
          >
            <Icon name="grid" size={16} />
            Open My Hosting Hub
          </Link>
          <Link
            href={`${base}/settings`}
            className="hidden items-center gap-2 rounded-lg border border-sage/40 px-3.5 py-2 font-body text-sm text-forest transition-colors duration-300 hover:bg-forest/5 lg:flex"
          >
            <Icon name="settings" size={16} />
            Details
          </Link>
        </>
      }
    >
      <div className="relative overflow-hidden border-b border-sage/25 bg-parchment">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gold/70" aria-hidden />
        <div className="mx-auto flex max-w-[92rem] items-center gap-5 px-5 py-6 md:px-8 md:py-7">
          <GatheringIdentity
            name={gathering.name}
            artworkUrl={artwork.get(gathering.id)}
            className="hidden h-24 w-32 flex-shrink-0 rounded-xl shadow-soft sm:block"
            sizes="128px"
            priority
          />

          <div className="min-w-0 flex-1">
            <p className="font-body text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-forest/50">
              Your gathering
            </p>
            <div className="mt-2 h-0.5 w-10 bg-gold" aria-hidden />
            <h1 className="mt-3 truncate font-display text-2xl leading-tight text-forest md:text-3xl">
              {gathering.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-body text-sm text-forest/70">
              <span className="flex items-center gap-1.5">
                <Icon name="calendar" size={14} />
                {formatGatheringDate(
                  gathering.gathering_date,
                  gathering.arrival_time
                )}
              </span>
              {gathering.location_name && (
                <span className="flex items-center gap-1.5">
                  <Icon name="pin" size={14} />
                  {gathering.location_name}
                </span>
              )}
              {days > 0 && (
                <span className="text-forest/55">
                  {days} {days === 1 ? "day" : "days"} to go
                </span>
              )}
              {days === 0 && (
                <span className="font-semibold text-forest">Today</span>
              )}
            </p>
            <GatheringContextStrip
              gatheringId={gathering.id}
              effectiveStatus={gathering.effective_status}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto min-w-0 max-w-[92rem] px-5 py-8 md:px-8 md:py-10">
        {children}
      </div>
    </HostShell>
  );
}
