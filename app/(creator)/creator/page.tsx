import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { dollars, parsePortal, referralUrl, referralsLive } from "@/lib/creator-portal";

// CREATOR PORTAL SKELETON (restricted). Access = a signed-in account that the DATABASE says is an approved partner.
// There is no role cookie and no client flag: creator_portal_summary() returns only the caller's own rows, and returns
// nothing but a status for a suspended or unknown account. Staff access is a separate system (/command-center).
export default async function CreatorPortal() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fcreator");

  let { data } = await supabase.rpc("creator_portal_summary");
  let state = parsePortal(data);
  if (state.kind === "not_member") {
    // Connect an approved application to this (email-confirmed) account. Idempotent; does nothing for everyone else.
    await supabase.rpc("claim_my_membership");
    ({ data } = await supabase.rpc("creator_portal_summary"));
    state = parsePortal(data);
  }

  if (state.kind === "not_member") return <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">No creator membership is connected to this account. If you applied with a different email address, sign in with that address.</p>;
  if (state.kind === "inactive") return <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Your creator account is not active right now. Please contact Place &amp; Plenty if you have questions.</p>;

  const d = state.data;
  const live = referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: process.env.NEXT_PUBLIC_HC_REFERRALS_LIVE });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-forest">Welcome{d.displayName ? `, ${d.displayName}` : ""}</h1>
        {d.tierLabel ? <p className="text-sm text-charcoal/70">{d.tierLabel}</p> : null}
      </div>

      <section aria-labelledby="ref">
        <h2 id="ref" className="mb-2 font-display text-xl text-forest">Your referral link</h2>
        {d.codes.length === 0 ? <p className="text-sm text-charcoal/70">Your link has not been created yet.</p> : (
          <ul className="space-y-1 text-sm">{d.codes.map((c) => { const u = referralUrl(c); return u ? <li key={c}><code className="rounded bg-cream px-2 py-1">{u}</code></li> : null; })}</ul>
        )}
        {!live ? <p className="mt-2 rounded-lg border border-forest/20 bg-cream p-3 text-sm">Referral tracking is not switched on yet. Please do not share your link publicly until we tell you it is live. Nothing is being tracked.</p> : null}
        <p className="mt-2 text-sm text-charcoal/70">Always disclose near your link that you may earn a commission.</p>
      </section>

      <section aria-labelledby="res">
        <h2 id="res" className="mb-2 font-display text-xl text-forest">Referral results</h2>
        <p className="text-sm">Referred sign-ups: {d.signups ?? "n/a"}</p>
        <p className="text-sm">Pending commissions: {dollars(d.commissionCents.pending ?? 0)} · Validated: {dollars(d.commissionCents.validated ?? 0)}</p>
        <p className="mt-1 text-sm text-charcoal/70">These are tracked amounts, not earnings and not payments. Nothing is paid automatically; payouts are reviewed and made manually{d.minPayoutCents !== null ? `, once validated commissions reach ${dollars(d.minPayoutCents)}` : ""}. You never see customer names or emails.</p>
      </section>

      <section aria-labelledby="onb">
        <h2 id="onb" className="mb-2 font-display text-xl text-forest">Getting started</h2>
        <ul className="space-y-1 text-sm">{d.onboarding.map((o) => <li key={o.slug}>{o.done ? "Done" : "To do"}: {o.title}{o.required ? " (required)" : ""}</li>)}</ul>
      </section>

      {d.announcements.length ? (
        <section aria-labelledby="ann">
          <h2 id="ann" className="mb-2 font-display text-xl text-forest">Announcements</h2>
          <ul className="space-y-3 text-sm">{d.announcements.map((a) => <li key={a.id}><p className="font-medium">{a.title}</p><p className="whitespace-pre-line text-charcoal/80">{a.body}</p></li>)}</ul>
        </section>) : null}
    </div>
  );
}
