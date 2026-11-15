import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { referralSiteUrl } from "@/lib/site-url";
import { assignmentActionable, closedAssignmentCopy, dollars, earningsView, parsePortal, referralUrl, referralsLive, sessionExpired } from "@/lib/creator-portal";
import { applicationCopy, canWithdraw, memberStatusCopy, parseProgramStatus, REFERRAL_REASON_COPY } from "@/lib/hc/lifecycle";
import { PLATFORMS } from "@/lib/hc/creator-forms";
import { ActionForm } from "@/components/hc/ActionForm";
import { completeOnboardingStep, respondToAssignment, submitContent, withdrawApplication } from "./actions";

// CREATOR PORTAL. Access = a signed-in account that the DATABASE says is a member. There is no role cookie and no client flag:
// creator_portal_summary() and creator_program_status() return only the caller's own rows. Staff access is a separate system (/command-center).
// Money shown here is TRACKED, never "earned" or "paid", and is hidden entirely unless paid referrals are live AND this member's tier is eligible.
const Note = ({ children }: { children: React.ReactNode }) => <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">{children}</p>;

export default async function CreatorPortal() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user && sessionExpired(authError)) {
    return (
      <div className="space-y-3">
        <Note>Your session has expired. Please sign in again to see your creator page.</Note>
        <a href="/login?next=%2Fcreator" className="text-sm underline">Sign in</a>
      </div>
    );
  }
  if (!user) redirect("/login?next=%2Fcreator");

  let { data } = await supabase.rpc("creator_portal_summary");
  let state = parsePortal(data);
  if (state.kind === "not_member") {
    // Connect an approved application to this (email-confirmed) account. Idempotent; does nothing for everyone else.
    await supabase.rpc("claim_my_membership");
    ({ data } = await supabase.rpc("creator_portal_summary"));
    state = parsePortal(data);
  }
  const { data: statusRaw } = await supabase.rpc("creator_program_status");
  const program = parseProgramStatus(statusRaw);

  if (state.kind === "not_member") {
    const a = program.application;
    if (!a) return <Note>No creator membership or application is connected to this account. If you applied with a different email address, sign in with that address.</Note>;
    const c = applicationCopy(a.status);
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl text-forest">{c.title}</h1>
        <p className="text-sm">{c.body}</p>
        {canWithdraw(a.status) ? <ActionForm action={withdrawApplication} buttons={[{ label: "Withdraw my application", secondary: true }]} /> : null}
      </div>
    );
  }
  if (state.kind === "inactive" || (program.member && program.member.status !== "approved")) {
    const c = memberStatusCopy((program.member?.status ?? "declined") as "applied" | "approved" | "declined" | "suspended");
    return <Note>{c ? <><strong>{c.title}.</strong> {c.body}</> : "Your creator account is not active right now. Please contact Place & Plenty if you have questions."}</Note>;
  }

  const d = state.data;
  const member = program.member;
  const live = referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: process.env.NEXT_PUBLIC_HC_REFERRALS_LIVE });
  const paidLive = live && member?.referral?.eligible === true;
  const ev = earningsView(d, paidLive);
  const tier = member?.tier ?? null;
  const campaignsOn = member?.assignmentsEnabled !== false;
  const refReason = member?.referral && !member.referral.eligible ? REFERRAL_REASON_COPY[member.referral.reason] ?? "" : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-forest">Welcome{d.displayName ? `, ${d.displayName}` : ""}</h1>
        <p className="text-sm text-charcoal/70">{tier ? tier.label : "Basic member"}</p>
      </div>

      {tier && (tier.description || tier.benefits.length) ? (
        <section aria-labelledby="tier">
          <h2 id="tier" className="mb-2 font-display text-xl text-forest">Your membership</h2>
          {tier.description ? <p className="text-sm">{tier.description}</p> : null}
          {tier.benefits.length ? <ul className="mt-1 list-disc pl-5 text-sm">{tier.benefits.map((b) => <li key={b}>{b}</li>)}</ul> : null}
        </section>) : null}

      <section aria-labelledby="ref">
        <h2 id="ref" className="mb-2 font-display text-xl text-forest">Your referral link</h2>
        {d.codes.length === 0 ? <p className="text-sm text-charcoal/70">Your link has not been created yet.</p> : (
          <ul className="space-y-1 text-sm">{d.codes.map((c) => { const u = referralUrl(c, referralSiteUrl()); return u ? <li key={c}><code className="rounded bg-cream px-2 py-1">{u}</code></li> : null; })}</ul>
        )}
        {!paidLive ? <p className="mt-2 rounded-lg border border-forest/20 bg-cream p-3 text-sm">Referral tracking is not switched on for your account yet. Please do not share your link publicly until we tell you it is live. Nothing is being tracked.{refReason ? ` (${refReason})` : ""}</p> : (
          <p className="mt-2 text-sm text-charcoal/70">Always disclose near your link that you may earn a commission.</p>)}
      </section>

      <section aria-labelledby="res">
        <h2 id="res" className="mb-2 font-display text-xl text-forest">Referrals and earnings</h2>
        {!ev ? <p className="text-sm text-charcoal/70">Nothing is being tracked for your account yet, so there are no amounts to show. When referral tracking is switched on for you, your sign-ups and tracked amounts will appear here (read only).</p> : (
          <div className="space-y-1 text-sm">
            <p>Referred sign-ups: {ev.signups}</p>
            {ev.conversions.length ? <p>Conversions: {ev.conversions.map((c) => `${c.label} ${c.value}`).join(" · ")}</p> : null}
            <p>Tracked commissions: {ev.commissions.length ? ev.commissions.map((c) => `${c.label} ${c.value}`).join(" · ") : "none yet"}</p>
            <p className="mt-1 text-charcoal/70">These are tracked amounts, not earnings and not payments. Nothing is paid automatically; payouts are reviewed and made manually{ev.minPayout ? `, once validated commissions reach ${ev.minPayout}` : ""}. This view is read only.</p>
          </div>)}
      </section>

      <section aria-labelledby="onb">
        <h2 id="onb" className="mb-2 font-display text-xl text-forest">Getting started</h2>
        {d.onboarding.length === 0 ? <p className="text-sm text-charcoal/70">Nothing to do right now.</p> : (
          <ul className="space-y-2 text-sm">{d.onboarding.map((o) => (
            <li key={o.slug} className="flex flex-wrap items-center gap-2">
              <span>{o.done ? "Done" : "To do"}: {o.title}{o.required ? " (required)" : ""}</span>
              {!o.done ? <ActionForm action={completeOnboardingStep} buttons={[{ label: "Mark done", secondary: true }]}><input type="hidden" name="step" value={o.slug} /></ActionForm> : null}
            </li>))}</ul>)}
      </section>

      <section aria-labelledby="camp">
        <h2 id="camp" className="mb-2 font-display text-xl text-forest">Campaigns</h2>
        {!campaignsOn ? <p className="text-sm text-charcoal/70">Campaigns are not part of your membership level.</p>
          : d.assignments.length === 0 ? <p className="text-sm text-charcoal/70">No campaigns for you right now.</p> : (
          <ul className="space-y-4">{d.assignments.map((a) => (
            <li key={a.id} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
              <p className="font-medium">{a.title} <span className="text-charcoal/70">({a.status.replace(/_/g, " ")})</span></p>
              <p className="mt-1 whitespace-pre-line">{a.brief}</p>
              {a.compensationTerms ? <p className="mt-1 text-charcoal/70">Compensation: {a.compensationTerms}</p> : <p className="mt-1 text-charcoal/70">No compensation is offered for this campaign.</p>}
              {closedAssignmentCopy(a.status) ? <p className="mt-2 text-charcoal/70" role="status">{closedAssignmentCopy(a.status)}</p> : null}
              {assignmentActionable(a.status) === "respond" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm action={respondToAssignment} buttons={[{ label: "Accept" }]}><input type="hidden" name="assignment_id" value={a.id} /><input type="hidden" name="decision" value="accept" /></ActionForm>
                  <ActionForm action={respondToAssignment} buttons={[{ label: "Decline", secondary: true }]}><input type="hidden" name="assignment_id" value={a.id} /><input type="hidden" name="decision" value="decline" /></ActionForm>
                </div>) : null}
              {assignmentActionable(a.status) === "submit" ? (
                <ActionForm action={submitContent} buttons={[{ label: "Submit content" }]} className="mt-3 space-y-2">
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <label className="block text-xs">Link to your post (https://)<input name="url" type="url" required minLength={12} maxLength={508} className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
                  <label className="block text-xs">Platform<select name="platform" className="mt-1 rounded border border-forest/30 px-2 py-1">{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
                  <label className="block text-xs">Notes (optional)<textarea name="description" maxLength={1000} rows={2} className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
                  <label className="block text-xs"><input type="checkbox" name="disclosure" required /> I disclosed my partnership with Place &amp; Plenty in this post.</label>
                </ActionForm>) : null}
            </li>))}</ul>)}
      </section>

      {d.submissions.length ? (
        <section aria-labelledby="subs">
          <h2 id="subs" className="mb-2 font-display text-xl text-forest">Your submissions</h2>
          <ul className="space-y-2 text-sm">{d.submissions.map((s) => (
            <li key={s.id}>{s.platform}: <a href={s.url} rel="noopener noreferrer nofollow" target="_blank" className="underline">{s.url}</a> — {s.status.replace(/_/g, " ")}. Reuse permissions you granted: {s.activePermissions.length ? s.activePermissions.join(", ").replace(/_/g, " ") : "none"}.</li>))}</ul>
        </section>) : null}

      {d.announcements.length ? (
        <section aria-labelledby="ann">
          <h2 id="ann" className="mb-2 font-display text-xl text-forest">Announcements</h2>
          <ul className="space-y-3 text-sm">{d.announcements.map((a) => <li key={a.id}><p className="font-medium">{a.title}</p><p className="whitespace-pre-line text-charcoal/80">{a.body}</p></li>)}</ul>
        </section>) : null}
    </div>
  );
}
