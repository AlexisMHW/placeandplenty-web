import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Icon from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";
import CreateGatheringWizard, {
  type ResumedDraft,
} from "@/components/host/CreateGatheringWizard";
import {
  getGathering,
  getGatheringDraftFields,
  signArtwork,
} from "@/lib/host-data";
import {
  DEFAULT_ARRIVAL_TIME,
  EMPTY_GATHERING_INPUT,
  isFoodStyle,
  isGatheringType,
  todayISODate,
} from "@/lib/gathering-creation";
import {
  INVITATION_MODES,
  INVITATION_STATUSES,
  isInvitationMode,
  isRenderableArtwork,
} from "@/lib/invitations";
import type { InvitationDecision, InvitationMode } from "@/lib/invitations";

export const metadata = { title: "Start a gathering" };

function resumeInvitation(fields: {
  invitation_status: string;
  invitation_mode: string;
  invitation_style: string | null;
}): {
  decision: InvitationDecision | null;
  mode: InvitationMode | null;
  styleId: string | null;
} {
  if (fields.invitation_status === INVITATION_STATUSES.INVITED_ELSEWHERE) {
    return { decision: "already_invited", mode: null, styleId: null };
  }
  if (
    fields.invitation_status === INVITATION_STATUSES.IN_PROGRESS ||
    fields.invitation_status === INVITATION_STATUSES.SHARED
  ) {
    const mode = isInvitationMode(fields.invitation_mode)
      ? fields.invitation_mode
      : null;
    return {
      decision: "not_yet",
      mode,
      styleId:
        mode === INVITATION_MODES.PLACE_AND_PLENTY
          ? fields.invitation_style
          : null,
    };
  }
  return { decision: null, mode: null, styleId: null };
}

async function loadDraft(editId: string): Promise<ResumedDraft> {
  const [gathering, fields] = await Promise.all([
    getGathering(editId),
    getGatheringDraftFields(editId),
  ]);

  if (!gathering || !fields) notFound();
  if (gathering.status !== "draft") redirect(`/host/g/${editId}`);

  const artwork = gathering.invitation_artwork_path
    ? {
        filename: gathering.invitation_artwork_path.split("/").pop() ?? "",
        mimeType: gathering.invitation_artwork_mime_type ?? "",
      }
    : null;

  const signed = artwork ? await signArtwork([gathering]) : null;

  return {
    id: fields.id,
    input: {
      ...EMPTY_GATHERING_INPUT,
      name: fields.name ?? "",
      gatheringType: isGatheringType(fields.gathering_type)
        ? fields.gathering_type
        : null,
      gatheringDate: fields.gathering_date ?? todayISODate(),
      arrivalTime: fields.arrival_time
        ? fields.arrival_time.slice(0, 5)
        : DEFAULT_ARRIVAL_TIME,
      locationName: fields.location_name ?? "",
      adultCount: fields.adult_count ?? 0,
      childCount: fields.child_count ?? 0,
      budgetTarget: fields.budget_target,
      foodStyle:
        fields.food_style && isFoodStyle(fields.food_style)
          ? fields.food_style
          : null,
      notes: fields.notes ?? "",
    },
    ...resumeInvitation(fields),
    artwork,
    artworkUrl:
      artwork && isRenderableArtwork(artwork.mimeType)
        ? (signed?.get(gathering.id) ?? null)
        : null,
  };
}

export default async function CreateGatheringPage({
  searchParams,
}: {
  searchParams: { editId?: string };
}) {
  const editId = searchParams.editId;
  const resume = editId ? await loadDraft(editId) : null;

  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      <Link
        href="/host"
        className="inline-flex items-center gap-2 font-body text-sm text-forest/70 transition-colors duration-400 hover:text-forest"
      >
        <span aria-hidden className="rotate-180">
          <Icon name="arrow" size={15} />
        </span>
        My Gatherings
      </Link>

      <section className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-sage/30 bg-parchment px-6 py-7 shadow-sm md:px-8 md:py-9">
        <BotanicalSprig
          className="pointer-events-none absolute -right-6 -top-8 text-olive/25"
          size={150}
        />
        <div className="relative max-w-2xl">
          <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/55">
            {resume ? "YOUR GATHERING" : "PEOPLE ARE COMING"}
          </p>
          <div className="mt-3 h-[3px] w-10 rounded-full bg-gold" />
          <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
            {resume ? "Pick up where you left off" : "Start a gathering"}
          </h1>
          <p className="mt-3 max-w-prose font-body leading-relaxed text-forest/75">
            {resume
              ? "Your answers are here, and this is the same gathering you started — nothing new is created by carrying on."
              : "A few thoughtful questions turn ‘people are coming’ into a real plan. Answer what you know; the rest can wait."}
          </p>
        </div>
      </section>

      <div className="mt-6 rounded-[1.75rem] border border-sage/25 bg-offwhite p-4 shadow-sm md:p-6">
        <CreateGatheringWizard resume={resume} />
      </div>
    </div>
  );
}
