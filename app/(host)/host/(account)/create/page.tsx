import Link from "next/link";
import CreateGatheringForm from "@/components/host/CreateGatheringForm";
import { WorkspaceHeader } from "@/components/host/Workspace";

export const metadata = { title: "Create Gathering" };

export default function CreateGatheringPage() {
  return (
    <div className="mx-auto max-w-[72rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="Create a Gathering"
        description="Start here or in the app. It is the same account, the same gathering, and the same plan either way."
      >
        <Link
          href="/host"
          className="font-body text-sm font-semibold text-forest/70 underline decoration-gold decoration-2 underline-offset-4 hover:text-forest"
        >
          Back to My Gatherings
        </Link>
      </WorkspaceHeader>
      <CreateGatheringForm />
    </div>
  );
}
