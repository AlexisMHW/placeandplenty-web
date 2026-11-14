import Link from "next/link";
import { redirect } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getMultiDayPassStep } from "@/lib/multi-day-actions";
import { multiDayPassPriceLine, PASS_STEP_COPY } from "@/lib/multi-day-pass";
import PassStepActions from "./PassStepActions";

export const metadata = { title: "Multi-Day Pass" };

export default async function MultiDayPassStepPage({
  searchParams,
}: {
  searchParams: { gatheringId?: string; purchase?: string };
}) {
  const gatheringId = searchParams.gatheringId;
  if (!gatheringId) redirect("/host/create");

  const gathering = await getGathering(gatheringId);
  if (!gathering) redirect("/host");
  if (gathering.status !== "draft") redirect(`/host/g/${gatheringId}`);

  const step = await getMultiDayPassStep(gatheringId);
  if (!step.ok) {
    return (
      <div className="mx-auto max-w-xl px-1 py-8">
        <h1 className="font-display text-2xl text-forest">We couldn’t check your pass</h1>
        <p className="mt-3 font-body text-sm text-forest/75">{step.message}</p>
        <Link href={`/host/create/pass?gatheringId=${gatheringId}`} className="mt-6 inline-block underline">Try again</Link>
      </div>
    );
  }

  const copy = PASS_STEP_COPY[step.status];
  return (
    <div className="mx-auto max-w-xl px-1 py-8">
      <h1 className="font-display text-2xl text-forest">{copy.title}</h1>
      <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">{copy.body}</p>
      <PassStepActions
        gatheringId={gatheringId}
        status={step.status}
        priceLine={multiDayPassPriceLine(step.tier)}
        checkoutConfigured={step.checkoutConfigured}
        justPaid={searchParams.purchase === "success"}
        editHref={`/host/create?editId=${gatheringId}`}
      />
    </div>
  );
}
