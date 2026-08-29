import Link from "next/link";
import { notFound } from "next/navigation";
import HostShell, { type HostNavGroup } from "@/components/host/HostShell";
import GatheringIdentity from "@/components/host/GatheringIdentity";
import ReadinessBadge from "@/components/host/ReadinessBadge";
import Icon from "@/components/Icon";
import {
  getGathering,
  getGatheringGuests,
  signArtwork,
} from "@/lib/host-data";
import { formatGatheringDate, daysUntil } from "@/lib/host-format";

// THE GATHERING WORKSPACE — Command Central, composed to
// `host_web_gathering.png`.
//
// §16: "This page appears after the host chooses a gathering." The
// reference gives it the same shell as the account home with two
// differences, both of which are kept:
//
//   1. THE SIDEBAR IS PALE, not forest. §15 anchors the account level in
//      green; §16 asks the gathering level to stay "predominantly
//      warm/cream" with "enough forest/sage to anchor". The change of
//      ground is also a useful signal that you have gone a level in.
//
//   2. THE NAV IS THE GATHERING'S, listing §16's Command Central
//      surfaces rather than account ones.
//
// THE GATHERING'S ARTWORK IS ITS IDENTITY, carried into the header
// (§16). A strip of the invitation sits beside the name at the top of
// every surface inside the gathering, so the workspace never stops
// saying which gathering you are in.
//
// TEN OF THE TWELVE HUB CARDS ARE HERE. Two are absent and §29 requires
// a product reason rather than "the app already has it":
//
//   Host Mode  — the gathering-day surface, driven by phone
//                notifications and used while moving around the house. A
//                desktop version is a screen nobody is sitting at when
//                it matters.
//   Space Mode — its input is a camera pointed at a room. The analysis
//                could be displayed here, but the capture step is the
//                feature, and a viewer with no capture path is a dead
//                end.
//
// Both are disclosed to customers rather than quietly missing — see
// FEATURE_AVAILABILITY_NOTE in lib/entitlements.ts, which is on Pricing,
// Support and in the Terms.
//
// 404 ON A GATHERING THE USER CANNOT SEE. getGathering() uses
// maybeSingle(), so RLS filtering a row out returns null rather than
// throwing. Turning that into notFound() makes a gathering belonging to
// someone else indistinguishable from one that does not exist — a
// distinct "not allowed" page would confirm the id is real.

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
      items: [{ label: "Overview", href: base, icon: "house", exact: true }],
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
      backLabel="My Host Hub"
      topBar={
        <>
          <ReadinessBadge
            state={gathering.readiness_state}
            score={gathering.current_hostready_score}
          />
          <Link
            href={`${base}/settings`}
            className="hidden items-center gap-2 rounded-lg border border-sage/40 px-3.5 py-2 font-body text-sm text-forest transition-colors duration-400 hover:bg-forest/5 sm:flex"
          >
            <Icon name="settings" size={16} />
            Details
          </Link>
        </>
      }
    >
      {/* ---- the gathering's own header ---------------------------- */}
      <div className="border-b border-sage/25 bg-parchment">
        <div className="mx-auto flex max-w-[92rem] items-center gap-5 px-5 py-5 md:px-8">
          <GatheringIdentity
            name={gathering.name}
            artworkUrl={artwork.get(gathering.id)}
            className="hidden h-20 w-28 flex-shrink-0 rounded-lg sm:block"
            sizes="112px"
            priority
          />

          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl leading-tight text-forest md:text-3xl">
              {gathering.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 font-body text-sm text-forest/70">
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
          </div>
        </div>
      </div>

      <div className="mx-auto min-w-0 max-w-[92rem] px-5 py-8 md:px-8 md:py-10">
        {children}
      </div>
    </HostShell>
  );
}
