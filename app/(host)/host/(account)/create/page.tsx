import Link from "next/link";
import Icon from "@/components/Icon";
import CreateGatheringWizard from "@/components/host/CreateGatheringWizard";

// /host/create — the same eight questions the app asks, on a desktop.
//
// It sits inside the (account) group so it wears the account shell: this
// is something a host does BEFORE they have a gathering, so a gathering
// workspace has nothing to wrap it in.
//
// The page itself is deliberately thin. Everything about the flow — the
// order of the questions, when a draft is first written, the invitation
// decision, and the single guarded draft → active transition at the end
// — lives in the wizard component and in lib/host-actions.ts, where it
// can be read next to the rules it is reconciled against.

export const metadata = { title: "Start a gathering" };

export default function CreateGatheringPage() {
  return (
    <div className="mx-auto max-w-5xl px-1 py-2">
      <Link
        href="/host"
        className="inline-flex items-center gap-2 font-body text-sm text-forest/70 transition-colors duration-400 hover:text-forest"
      >
        <span aria-hidden className="rotate-180">
          <Icon name="arrow" size={15} />
        </span>
        My Host Hub
      </Link>

      <h1 className="mt-5 font-display text-4xl leading-tight text-forest">
        Start a gathering
      </h1>
      <p className="mt-3 max-w-prose font-body leading-relaxed text-forest/75">
        Eight questions, the same ones the app asks. Answer what you know —
        the rest can wait, and nothing is shared with anyone until you
        finish.
      </p>

      <CreateGatheringWizard />
    </div>
  );
}
