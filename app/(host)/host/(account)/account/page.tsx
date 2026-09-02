import Link from "next/link";
import { getUser } from "@/lib/supabase-server";
import { getProfile } from "@/lib/host-data";
import { getProfileAvatarState } from "@/lib/profile-data";
import { WorkspaceHeader, Panel } from "@/components/host/Workspace";
import PlanPanel from "@/components/host/PlanPanel";
import ProfilePhotoPanel from "@/components/host/ProfilePhotoPanel";

// ACCOUNT / PROFILE / SETTINGS (§11).
//
// §11 lists "entitlement/subscription state" and "account deletion
// access where appropriate" among the required account-level web
// capabilities. Both are handled here with what is actually TRUE today,
// which is not the same as what a settings page usually shows:
//
//   ENTITLEMENT STATE — now read from the canonical
//   `gathering_entitlements` rows rather than described in the abstract.
//   PlanPanel shows what this account actually holds, which channel it
//   came from, and where it is managed. That last part is a fact about
//   Apple and Google rather than a choice of ours: a store subscription
//   can only be cancelled in that store, and §19 forbids claiming
//   management capability we do not have.
//
//   DELETION — in-app deletion exists and is the primary route, and
//   /delete-account documents both routes. Linking there rather than
//   rebuilding a delete flow on web keeps one description of what is
//   deleted and what is retained. Duplicating it would create a second
//   copy to drift.
//
// Profile identity remains canonical in `profiles`. The account photo is
// also stored there as a private storage path; Guest Book hosts never get
// a copied image or a searchable account record. They only receive a
// signed image when a guest email they already own matches a verified
// P&P account whose owner allows Guest Book display.

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const [user, profile, avatar] = await Promise.all([
    getUser(),
    getProfile(),
    getProfileAvatarState(),
  ]);

  const rows = [
    { label: "Name", value: profile?.display_name || profile?.first_name },
    { label: "Email", value: user?.email },
    { label: "Time zone", value: profile?.timezone },
    { label: "Language", value: profile?.preferred_locale },
  ].filter((r) => r.value);

  const displayName = String(profile?.display_name || profile?.first_name || user?.email || "");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="Account"
        description="The same Place & Plenty account you use in the app."
      />

      <div className="mt-8">
        <ProfilePhotoPanel
          avatarUrl={avatar.avatarUrl}
          shareWithGuestBooks={avatar.shareWithGuestBooks}
          initials={initials}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PlanPanel />

        <Panel>
          <h3 className="font-display text-xl text-forest">Your details</h3>
          <dl className="mt-4 divide-y divide-sage/20">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2.5"
              >
                <dt className="font-body text-sm text-forest/65">{r.label}</dt>
                <dd className="font-body text-sm text-forest">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-body text-sm leading-relaxed text-forest/65">
            Your account details stay the same everywhere you use Place &amp; Plenty.
          </p>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl text-forest">Password</h3>
          <p className="mt-3 font-body text-base leading-relaxed text-forest/75">
            Your password works for the app and the website — it&rsquo;s one
            account.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            Change your password
            <span aria-hidden>&rarr;</span>
          </Link>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl text-forest">
            Deleting your account
          </h3>
          <p className="mt-3 font-body text-base leading-relaxed text-forest/75">
            You can delete your account and its data at any time — in the app
            under Settings, or by email if you no longer have it installed.
          </p>
          <Link
            href="/delete-account"
            className="mt-4 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            What gets deleted, and what we keep
            <span aria-hidden>&rarr;</span>
          </Link>
        </Panel>
      </div>
    </div>
  );
}
