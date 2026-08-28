import Link from "next/link";
import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { formatGatheringDate, daysUntil } from "@/lib/host-format";
import ReadinessBadge from "@/components/host/ReadinessBadge";
import GatheringNav from "@/components/host/GatheringNav";

// THE GATHERING WORKSPACE. §11: "left-side gathering navigation, large
// central workspace, responsive collapse for smaller screens".
//
// The left rail lives here rather than in the account shell because it
// is navigation WITHIN a gathering — on the gatherings list it would
// point at nothing. Below `lg` it becomes a horizontal scroller above
// the workspace instead of vanishing, so a phone keeps every surface
// reachable.
//
// 404 ON A GATHERING THE USER CANNOT SEE. getGathering() uses
// maybeSingle(), so RLS filtering a row out returns null rather than
// throwing. Turning that into notFound() means a gathering belonging to
// someone else is indistinguishable from one that does not exist — a
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

  const days = daysUntil(gathering.gathering_date);

  return (
    <div className="mx-auto max-w-[90rem] px-6 py-8 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/host"
            className="font-body text-xs text-forest/60 transition-colors duration-400 hover:text-forest"
          >
            &larr; My Gatherings
          </Link>

          <h1 className="mt-2 font-display text-3xl leading-tight text-forest md:text-4xl">
            {gathering.name}
          </h1>

          <p className="mt-1.5 font-body text-base text-forest/75">
            {formatGatheringDate(
              gathering.gathering_date,
              gathering.arrival_time
            )}
            {days > 0 && (
              <span className="text-forest/55">
                {" "}
                · {days} {days === 1 ? "day" : "days"} to go
              </span>
            )}
            {days === 0 && (
              <span className="font-semibold text-forest"> · today</span>
            )}
          </p>
        </div>

        <ReadinessBadge
          state={gathering.readiness_state}
          score={gathering.current_hostready_score}
        />
      </div>

      <div className="mt-8 gap-10 lg:flex">
        <GatheringNav gatheringId={gathering.id} />

        {/* The large central workspace. min-w-0 matters: without it a
            wide table inside a flex child refuses to shrink and pushes
            the whole page into horizontal scroll. */}
        <div className="min-w-0 flex-1 pt-8 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}
