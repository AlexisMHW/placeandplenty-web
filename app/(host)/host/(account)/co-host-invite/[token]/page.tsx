import { WorkspaceHeader } from "@/components/host/Workspace";
import CoHostInviteClient from "./CoHostInviteClient";

// ACCEPTING A CO-HOST INVITATION, on the web.
//
// WHY THIS ROUTE LIVES INSIDE (host). app/(host)/layout.tsx redirects a
// signed-out visitor to /login?next=<this url>, and lib/auth-redirects
// carries `next` through the auth callback — so someone who follows an
// invitation link without an account signs up, confirms their email, and
// lands back here with the token intact. That is the whole flow, and it
// falls out of the existing gate rather than needing its own.
//
// THE TOKEN IS NOT VALIDATED ON THE SERVER BEFORE RENDER, deliberately.
// validate_invitation_token() and get_invitation_email() exist and are
// callable by anon, but reading the invited address into this page would
// disclose it to whoever opened the link — including someone it was
// forwarded to. accept_gathering_invitation() already refuses unless the
// signed-in account's CONFIRMED email matches the invitation, so the
// safe order is: let them press accept, and let the database answer.
//
// The two failures a person can actually hit — wrong account, unverified
// email — are translated in acceptCoHostInvitation() into instructions
// rather than an error code.

export const metadata = {
  title: "Co-host invitation",
  robots: { index: false, follow: false },
};

export default function CoHostInvitePage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="mx-auto max-w-[46rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="You’ve been asked to co-host"
        description="Accept and this gathering joins your list."
      />

      <CoHostInviteClient token={decodeURIComponent(params.token)} />

      <div className="mt-10 rounded-card border border-sage/30 bg-cream px-5 py-4">
        <h2 className="font-display text-lg text-forest">
          What a co-host can do
        </h2>
        <ul className="mt-2 space-y-1.5 font-body text-sm leading-relaxed text-forest/75">
          <li>
            See and change this gathering — the menu, the shopping, the
            guests, who&rsquo;s bringing what.
          </li>
          <li>
            Nothing else of the host&rsquo;s. Not their guest book, not their
            hosting closet, and not their other gatherings.
          </li>
          <li>
            Accepting doesn&rsquo;t give you Place &amp; Plenty Plus. If this
            gathering has been unlocked, you get what the gathering has, for
            as long as you&rsquo;re on it.
          </li>
        </ul>
      </div>
    </div>
  );
}
