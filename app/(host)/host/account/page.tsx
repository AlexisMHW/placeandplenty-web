import Link from "next/link";
import { getUser } from "@/lib/supabase-server";
import { getProfile } from "@/lib/host-data";
import { WorkspaceHeader, Panel } from "@/components/host/Workspace";

// ACCOUNT / PROFILE / SETTINGS (§11).
//
// §11 lists "entitlement/subscription state" and "account deletion
// access where appropriate" among the required account-level web
// capabilities. Both are handled here with what is actually TRUE today,
// which is not the same as what a settings page usually shows:
//
//   SUBSCRIPTION — there is no purchase flow anywhere yet. The app has
//   no monetization client. §19 forbids claiming subscription management
//   capability that does not exist, so this page does not offer to
//   "manage your plan"; it states the plans and when purchasing opens.
//
//   DELETION — in-app deletion exists and is the primary route, and
//   /delete-account documents both routes. Linking there rather than
//   rebuilding a delete flow on web keeps one description of what is
//   deleted and what is retained. Duplicating it would create a second
//   copy to drift.
//
// Profile fields are read-only for the same reason every other host
// surface is: the web app reads canonical data and does not write it
// yet. Showing an editable-looking name field that silently discards
// changes would be worse than showing the value.

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);

  const rows = [
    { label: "Name", value: profile?.display_name || profile?.first_name },
    { label: "Email", value: user?.email },
    { label: "Time zone", value: profile?.timezone },
    { label: "Language", value: profile?.preferred_locale },
  ].filter((r) => r.value);

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title="Account"
        description="The same Place & Plenty account you use in the app."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
            Change these in the app and they update here instantly.
          </p>
        </Panel>

        <Panel>
          <h3 className="font-display text-xl text-forest">Your plan</h3>
          <p className="mt-3 font-body text-base leading-relaxed text-forest/75">
            Your plan and billing live here. Purchasing opens with the app
            release.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See the plans
            <span aria-hidden>&rarr;</span>
          </Link>
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
