import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getGathering } from "@/lib/host-data";
import { getMultiDayWorkspace } from "@/lib/multi-day-data";
import MultiDayScheduleClient from "@/components/host/MultiDayScheduleClient";
import { WorkspaceHeader } from "@/components/host/Workspace";

export const metadata = { title: "My Schedule" };
export const dynamic = "force-dynamic";

export default async function MultiDaySchedulePage({ params }: { params: { id: string } }) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  if (gathering.duration_type !== "multi_day") {
    redirect(`/host/g/${params.id}`);
  }

  const workspace = await getMultiDayWorkspace(params.id);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <Link
        href={`/host/g/${params.id}/hub`}
        className="font-body text-sm font-semibold text-forest/65 underline decoration-gold decoration-2 underline-offset-4"
      >
        ← My Hosting Hub
      </Link>

      <div className="mt-5">
        <WorkspaceHeader
          title="My Schedule"
          description="Plan each day without splitting the gathering. Activities, guest choices, costs and the rest of your plan stay connected to this same gathering."
        />
      </div>

      <MultiDayScheduleClient
        gatheringId={params.id}
        gatheringName={gathering.name}
        startDate={gathering.gathering_date}
        endDate={gathering.gathering_end_date}
        workspace={workspace}
      />
    </div>
  );
}
