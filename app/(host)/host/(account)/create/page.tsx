import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Icon from "@/components/Icon";
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

// /host/create — the same eight questions the app asks, on a desktop.
//
// It sits inside the (account) group so it wears the account shell: this
// is something a host does BEFORE they have a gathering, so a gathering
// workspace has nothing to wrap it in.
//
// ?editId=<uuid> RESUMES A DRAFT INTO THE SAME WIZARD. Not a second
// screen and not a second row: the id is handed to the wizard, which
// starts holding it, so every save takes saveGatheringDraft()'s UPDATE
// path from the first keystroke. A host who left after question four
// comes back to their four answers, and the gathering they were making
// is still the gathering they are making.
//
// ONLY A DRAFT MAY BE RESUMED, and the check is the stored `status`
// rather than the effective one — deliberately, because it is the same
// question the transition guard asks (`WHERE status = 'draft'`). A
// gathering that has already been created is edited on its own settings
// surface, where the rules around a live gathering apply; sending it
// through the creation wizard would end at a finalise call that is a
// no-op at best. So it redirects there instead of pretending.

export const metadata = { title: "Start a gathering" };

/** Where the invitation question stands, restored from the row. */
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
  // 'not_started' is a host who has not decided, and resuming must not
  // decide for them.
  return { decision: null, mode: null, styleId: null };
}

async function loadDraft(editId: string): Promise<ResumedDraft> {
  const [gathering, fields] = await Promise.all([
    getGathering(editId),
    getGatheringDraftFields(editId),
  ]);

  // Missing, or filtered out by RLS — indistinguishable, and both are a
  // 404 to the person asking.
  if (!gathering || !fields) notFound();
  if (gathering.status !== "draft") redirect(`/host/g/${editId}`);

  const artwork = gathering.invitation_artwork_path
    ? {
        filename: gathering.invitation_artwork_path.split("/").pop() ?? "",
        mimeType: gathering.invitation_artwork_mime_type ?? "",
      }
    : null;

  // A private bucket, so a path is not a URL; PDFs get no preview by
  // design and signArtwork already declines to sign them.
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
      // Postgres hands back "18:00:00"; <input type="time"> wants "18:00".
      arrivalTime: fields.arrival_time
        ? fields.arrival_time.slice(0, 5)
        : DEFAULT_ARRIVAL_TIME,
      locationName: fields.location_name ?? "",
      adultCount: fields.adult_count ?? 0,
      childCount: fields.child_count ?? 0,
      budgetTarget: fields.budget_target,
      // A stored value outside the canonical five leaves the question
      // unanswered rather than showing a chip that is not offered.
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

      <h1 className="mt-5 font-display text-4xl leading-tight text-forest">
        {resume ? "Pick up where you left off" : "Start a gathering"}
      </h1>
      <p className="mt-3 max-w-prose font-body leading-relaxed text-forest/75">
        {resume
          ? "Your answers are here, and this is the same gathering you started — nothing new is created by carrying on."
          : "Eight questions, the same ones the app asks. Answer what you know — the rest can wait, and nothing is shared with anyone until you finish."}
      </p>

      <CreateGatheringWizard resume={resume} />
    </div>
  );
}
