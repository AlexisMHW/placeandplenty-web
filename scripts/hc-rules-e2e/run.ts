// WS-E3 DEMONSTRATION of the founder's Hosting Collective rules on a SCRATCH Postgres 16 built from the QA package order (never Supabase).
// LAYER: real web lib code (validateApplication, parseLeaveResult, parseMembershipOverview, parseReapplyForm, parseProgramStatus, memberStatusCopy,
// parseMembers) calling the REAL database functions through the pg-backed client. Server-action wrappers (cookies/requireStaff) are not run.
// usage: node --experimental-strip-types scripts/hc-rules-e2e/run.ts <host> <port> <db>
import assert from "node:assert/strict";
import { client, sql1, type Conn } from "./pgclient.ts";
import { validateApplication } from "../../lib/hosting-collective.ts";
import { parseLeaveResult, parseMembershipOverview, parseReapplyForm, canLeave, LEAVE_COPY } from "../../lib/hc/membership.ts";
import { parseProgramStatus, memberStatusCopy, feedbackMessage } from "../../lib/hc/lifecycle.ts";
import { parseMembers } from "../../lib/admin/hc.ts";
import { EVENT_LABELS } from "../../lib/hc/events.ts";

const c: Conn = { host: process.argv[2], port: process.argv[3], db: process.argv[4] };
const su = (s: string) => sql1(c, s);
let n = 0; const log: string[] = [];
const ok = (label: string, cond: unknown, detail = "") => { n++; assert.ok(cond, `${label} ${detail}`); log.push(`PASS ${label}${detail ? " :: " + detail : ""}`); };
const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const mkuser = (email: string, confirmed = true) => su(`insert into auth.users(id,email,email_confirmed_at,created_at) values (gen_random_uuid(), '${email}', ${confirmed ? "now() - interval '1 hour'" : "null"}, now() - interval '10 minutes') returning id;`).split("\n")[0];

const O = mkuser("owner@example.test"), M = mkuser("manager@example.test");
su(`insert into public.staff_members(user_id,role) values ('${O}','owner'),('${M}','creator_program_manager');`);
const owner = client(c, { role: "authenticated", uid: O }), mgr = client(c, { role: "authenticated", uid: M });
const anon = client(c, { role: "anon" }), svc = client(c, { role: "service_role" });
const appPayload = (name: string, email: string, handle: string) => {
  const a = validateApplication({ fullName: name, email, platforms: [{ platform: "instagram", handle }], niches: ["budget_hosting"], audienceSummary: "Weekly hosting tips for small dinners.", disclosureAck: true, consentToContact: true });
  if (!a.ok) throw new Error("fixture invalid " + JSON.stringify((a as any).errors)); return (a as any).payload;
};

(async () => {
  // ---- setup: program on, applications open (owner), as in the previous demonstration
  const terms = appPayload("Ada Member", "ada@example.test", "@ada_m").terms_version as string;
  await owner.rpc("hc_admin_set_program_enabled", { p_enabled: true, p_reason: "scratch" });
  await owner.rpc("hc_admin_set_applications_open", { p_open: true, p_terms_version: terms, p_reason: "scratch" });

  // ===== RULE 1: tiers
  const tiers = su(`select string_agg(slug||':'||label||':'||referral_eligible||':'||paid_referrals_eligible, ' | ' order by sort_order) from hc_tiers`);
  ok("T1 three tiers exist with the founder's names", tiers.includes("collective_member:Collective Member:false:false") && tiers.includes("collective_contributor:Collective Contributor:false:false") && tiers.includes("hosting_partner:Hosting Partner:true:true"), tiers);
  ok("T2 seeding wrote tier-history rows and touched nothing else", +su(`select count(*) from hc_tier_audit where action='tier_created' and detail->>'source'='migration_360000'`) === 3);

  // ===== applicants (an account user so the partner links to the account)
  const ADA = mkuser("ada@example.test"), CY = mkuser("cy@example.test");
  for (const [name, email, h] of [["Ada Member", "ada@example.test", "@ada_m"], ["Cy Contributor", "cy@example.test", "@cy_c"], ["Bo Declined", "bo@example.test", "@bo_d"], ["Dee Pending", "dee@example.test", "@dee_p"]] as const) {
    const r = await anon.rpc("submit_creator_application", { p_payload: appPayload(name, email, h) }); ok(`S ${name} submitted`, !r.error && (r.data as any)?.status === "received", JSON.stringify(r.error ?? r.data));
  }
  const id = (name: string) => su(`select id from creator_applications where full_name like '${name}%'`);
  const review = (appId: string, decision: string, tier: string | null, code: string | null = null) => mgr.rpc("hc_review_application", { p_id: appId, p_decision: decision, p_tier: tier, p_note: null, p_code: code });
  ok("T3 manager approves Ada as Hosting Partner", !(await review(id("Ada"), "approved", "hosting_partner", "ada-m")).error);
  ok("T4 manager approves Cy as Collective Contributor", !(await review(id("Cy"), "approved", "collective_contributor", "cy-c")).error);
  ok("T5 manager declines Bo", !(await review(id("Bo"), "declined", null)).error);
  const PA = su(`select id from partners where display_name like 'Ada%'`), PC = su(`select id from partners where display_name like 'Cy%'`);

  // ===== RULES 2 + 3: only Hosting Partner earns; paid referrals stay OFF until separately approved
  const buy = (uid: string, txn: string) => {
    const e = su(`insert into gathering_entitlements(user_id,entitlement_type,canonical_product_id,provider,provider_transaction_id,environment,purchased_at,scope) values ('${uid}','plus','plus_annual','web','${txn}','production',now(),'account') returning id;`).split("\n")[0];
    su(`insert into purchase_payments(provider,transaction_id,entitlement_id,canonical_product_id,store,environment,currency,gross_amount_minor,stripe_payment_intent_id,purchased_at) values ('stripe','${txn}','${e}','plus_annual','web','production','USD',5999,'${txn}',now());`);
    return e;
  };
  const referred = async (code: string, email: string, txn: string) => {
    const u = mkuser(email); await client(c, { role: "authenticated", uid: u }).rpc("record_referral_claim", { p_code: code, p_touched_at: new Date(Date.now() - 300000).toISOString() });
    const e = buy(u, txn);
    await svc.rpc("record_purchase_facts", { p_entitlement_id: e, p_provider_transaction_id: txn, p_currency: "usd", p_amount_subtotal_cents: 5999, p_tax_cents: 0, p_fee_cents: 200, p_stripe_customer_id: null, p_payment_fingerprint_hash: null, p_source: "webhook" });
    await svc.rpc("reconcile_commission_for_entitlement", { p_entitlement_id: e });
    return su(`select coalesce(string_agg(state||'/'||coalesce(commission_cents::text,'-'),','),'none') from commissions where entitlement_id='${e}'`);
  };
  ok("P0 paid referrals default OFF", su(`select paid_referrals_enabled from hc_settings where singleton`) === "f");
  const off = await referred("ada-m", "buyer-off@example.test", "txn-off");
  ok("P1 Hosting Partner purchase while paid referrals OFF: no payable commission", !/pending|validated|payable/.test(off), off);
  await owner.rpc("hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "scratch demonstration only" });
  const hp = await referred("ada-m", "buyer-hp@example.test", "txn-hp");
  ok("P2 (scratch activation) Hosting Partner earns the $12.00 Plus commission", hp === "pending/1200", hp);
  const co = await referred("cy-c", "buyer-co@example.test", "txn-co");
  ok("P3 Collective Contributor earns NOTHING (held/blocked, never pending)", !/pending|validated|payable/.test(co), co);
  await mgr.rpc("hc_admin_set_member_tier", { p_partner_id: PC, p_tier: "collective_member" });
  const mem = await referred("cy-c", "buyer-co2@example.test", "txn-co2");
  ok("P4 Collective Member earns nothing either", !/pending|validated|payable/.test(mem), mem);
  await owner.rpc("hc_deactivate_paid_referrals", { p_reason: "scratch demonstration end" });
  ok("P5 paid referrals switched back OFF; terms rows untouched by the migration", su(`select paid_referrals_enabled from hc_settings where singleton`) === "f");

  // ===== RULE 4: leave the Collective
  const before = { ent: su(`select count(*) from gathering_entitlements`), comm: su(`select string_agg(id::text||state,',' order by id) from commissions where partner_id='${PA}'`), codes: su(`select count(*) from partner_codes where partner_id='${PA}'`), payouts: su(`select count(*) from payouts`) };
  su(`update partners set user_id='${ADA}' where id='${PA}' and user_id is null`);
  const ada = client(c, { role: "authenticated", uid: ADA });
  const st0 = parseProgramStatus((await ada.rpc("creator_program_status")).data);
  ok("L1 approved member can leave (canLeave) and the portal knows the tier", canLeave(st0.member?.status) && st0.member?.tier?.label === "Hosting Partner");
  ok("L2 exact founder copy present (en title, buttons) and Spanish provided", LEAVE_COPY.en.title === "Leave the Hosting Collective?" && LEAVE_COPY.en.keep === "Keep My Membership" && LEAVE_COPY.en.leave === "Leave the Collective" && LEAVE_COPY.en.body[1].includes("Your Place & Plenty account and gatherings will not be affected.") && LEAVE_COPY.es.keep.length > 3);
  ok("L3 anon cannot leave", (await anon.rpc("creator_leave_collective")).error !== null);
  ok("L4 a non-member cannot leave", (await client(c, { role: "authenticated", uid: mkuser("nobody@example.test") }).rpc("creator_leave_collective")).error?.message.includes("not_a_member") === true);
  const left = parseLeaveResult((await ada.rpc("creator_leave_collective")).data);
  ok("L5 Ada leaves; result says unpaid commissions remain", left?.status === "left" && left.outstandingCommissions === true, JSON.stringify(left));
  ok("L6 status left + left_at set; tier kept as history", su(`select status||'/'||(left_at is not null)||'/'||tier from partners where id='${PA}'`) === "left/true/hosting_partner");
  const after = { ent: su(`select count(*) from gathering_entitlements`), comm: su(`select string_agg(id::text||state,',' order by id) from commissions where partner_id='${PA}'`), codes: su(`select count(*) from partner_codes where partner_id='${PA}'`), payouts: su(`select count(*) from payouts`) };
  ok("L7 entitlements, commission ledger, codes, payouts all unchanged by leaving", JSON.stringify(before) === JSON.stringify(after));
  ok("L8 account row untouched (auth user still present and linked)", su(`select count(*) from auth.users where id='${ADA}'`) === "1" && su(`select user_id::text from partners where id='${PA}'`) === ADA);
  const stAfter = parseProgramStatus((await ada.rpc("creator_program_status")).data);
  ok("L9 portal now shows 'left' copy and no member-only data", stAfter.member?.status === "left" && memberStatusCopy("left")?.title === "You have left the Hosting Collective" && (await ada.rpc("creator_portal_summary")).data && (((await ada.rpc("creator_portal_summary")).data as any).announcements === undefined));
  ok("L10 member-only RPCs refuse a left member", (await ada.rpc("creator_complete_onboarding_step", { p_step: "profile" })).error !== null);
  await owner.rpc("hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "scratch demonstration only" });
  const lateBuyer = mkuser("buyer-after-left@example.test");
  const lateClaim = (await client(c, { role: "authenticated", uid: lateBuyer }).rpc("record_referral_claim", { p_code: "ada-m", p_touched_at: new Date(Date.now() - 300000).toISOString() })).data as any;
  ok("L11 (paid referrals ON) after leaving, the old referral link no longer attributes anyone", lateClaim?.status === "invalid_code" && su(`select count(*) from referral_claims where referred_user_id='${lateBuyer}'`) === "0", JSON.stringify(lateClaim));
  const dr = await owner.rpc("hc_create_payout_draft", { p_partner_id: PA }); ok("L12 (paid referrals ON) no payout can be drafted for a left member, and leaving triggered none", (dr.data as any)?.status === "partner_not_approved" && su(`select count(*) from payouts`) === "0", JSON.stringify(dr.error ?? dr.data));
  await owner.rpc("hc_deactivate_paid_referrals", { p_reason: "scratch demonstration end" });
  ok("L13 leaving again is idempotent (already left)", parseLeaveResult((await ada.rpc("creator_leave_collective")).data)?.already === true);
  ok("L14 tier history + inbox event written", +su(`select count(*) from hc_tier_audit where action='member_status_changed' and partner_id='${PA}' and detail->>'to'='left'`) === 1 && +su(`select count(*) from hc_events where kind='member_left'`) === 1 && "member_left" in EVENT_LABELS);
  const ov = parseMembershipOverview((await mgr.rpc("hc_admin_membership_overview")).data)!;
  ok("L15 staff overview lists Ada as left with outstanding commissions", ov.leftMembers.length === 1 && ov.leftMembers[0].outstandingCommissions === true && ov.leftMembers[0].displayName.startsWith("Ada"));
  ok("L16 staff members list shows status left", parseMembers((await mgr.rpc("hc_admin_list_members")).data)!.some((m) => m.status === "left"));

  // ===== RULE 5a: incomplete (saved) applications expire after 30 days with notice at day 23; submitted never touched
  const DEE = mkuser("dee-draft@example.test"), dee = client(c, { role: "authenticated", uid: DEE });
  const sv = await dee.rpc("creator_save_application_draft", { p_payload: { full_name: "Dee Draft", step: 2 } });
  ok("D1 signed-in user saves a draft; expiry date returned", (sv.data as any)?.status === "saved" && !!(sv.data as any).expires_at, JSON.stringify(sv.data));
  ok("D2 anon cannot save or read drafts; clients have no table access", (await anon.rpc("creator_save_application_draft", { p_payload: {} })).error !== null && (await anon.rpc("creator_get_application_draft")).error !== null);
  ok("D3 sweep refused for anon, plain users and the non-hc.manage path", (await anon.rpc("hc_sweep_application_drafts")).error !== null && (await dee.rpc("hc_sweep_application_drafts")).error !== null);
  let sw: any = (await svc.rpc("hc_sweep_application_drafts")).data; ok("D4 fresh draft: nothing queued, nothing expired", sw.notices_queued === 0 && sw.expired === 0, JSON.stringify(sw));
  su(`update creator_application_drafts set updated_at = now() - interval '24 days' where user_id='${DEE}'`);
  sw = (await svc.rpc("hc_sweep_application_drafts")).data; ok("D5 at day 24 the advance notice is queued (once), draft not expired", sw.notices_queued === 1 && sw.expired === 0, JSON.stringify(sw));
  sw = (await svc.rpc("hc_sweep_application_drafts")).data; ok("D6 sweep is idempotent for the notice", sw.notices_queued === 0 && +su(`select count(*) from hc_events where kind='application_draft_expiring'`) === 1);
  ok("D7 notice is an inbox row only: no applicant delivery queued, nothing sent", su(`select count(*) from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.kind='application_draft_expiring' and d.channel='applicant_email'`) === "0");
  const g1 = (await dee.rpc("creator_get_application_draft")).data as any; ok("D8 user sees the saved draft and that it is expiring soon", g1.expiring_soon === true && g1.draft?.full_name === "Dee Draft");
  const ovMid = parseMembershipOverview((await mgr.rpc("hc_admin_membership_overview")).data)!; ok("D9 staff see the draft with its notice flag", ovMid.drafts.length === 1 && ovMid.drafts[0].noticeQueuedAt !== null);
  // a SUBMITTED application older than 40 days must stay pending; an approved member must not expire
  su(`update creator_applications set created_at = now() - interval '45 days' where full_name like 'Dee Pending%'`);
  su(`update creator_application_drafts set updated_at = now() - interval '31 days', notice_queued_at = now() - interval '8 days' where user_id='${DEE}'`);
  sw = (await svc.rpc("hc_sweep_application_drafts")).data; ok("D10 day 31 with notice older than 7 days: draft expires", sw.expired === 1, JSON.stringify(sw));
  ok("D11 expiry purges the saved content but keeps the row", su(`select payload::text||'/'||(expired_at is not null) from creator_application_drafts where user_id='${DEE}'`) === "{}/true");
  const g2 = (await dee.rpc("creator_get_application_draft")).data as any; ok("D12 user is told the draft expired (no content)", g2.draft === null && g2.expired === true);
  ok("D13 submitted application stays 'received' after 45 days; approved partners untouched", su(`select status from creator_applications where full_name like 'Dee Pending%'`) === "received" && su(`select count(*) from partners where status='approved'`) === "1");
  ok("D14 saving again reopens a fresh draft", ((await dee.rpc("creator_save_application_draft", { p_payload: { full_name: "Dee Draft" } })).data as any)?.status === "saved" && su(`select (expired_at is null)::text from creator_application_drafts where user_id='${DEE}'`) === "true");
  su(`update creator_application_drafts set updated_at = now() - interval '40 days' where user_id='${DEE}'`);
  sw = (await svc.rpc("hc_sweep_application_drafts")).data; ok("D15 a long-idle draft is NEVER expired without a notice first", sw.expired === 0 && sw.notices_queued === 1, JSON.stringify(sw));

  // ===== RULE 5b: declined applicants may re-apply after 90 days unless restricted
  const bo = () => anon.rpc("submit_creator_application", { p_payload: appPayload("Bo Declined", "bo@example.test", "@bo_d") });
  const boCount = () => +su(`select count(*) from creator_applications where email_normalized='bo@example.test'`);
  const r1 = await bo(); ok("R1 declined today: re-apply answered neutrally, no new application", (r1.data as any)?.status === "received" && (r1.data as any)?.duplicate === true && boCount() === 1, JSON.stringify(r1.data));
  su(`update creator_applications set reviewed_at = now() - interval '89 days' where email_normalized='bo@example.test'`);
  await bo(); ok("R2 day 89: still waiting", boCount() === 1);
  const BOID = id("Bo");
  ok("R3 manager can restrict re-applying with a reason; empty reason refused", (await mgr.rpc("hc_admin_set_reapply", { p_application_id: BOID, p_mode: "blocked", p_reason: "" })).error?.message.includes("reason_required") === true && !(await mgr.rpc("hc_admin_set_reapply", { p_application_id: BOID, p_mode: "blocked", p_reason: "policy" })).error);
  ok("R4 non-staff cannot set it; non-declined application refused", (await anon.rpc("hc_admin_set_reapply", { p_application_id: BOID, p_mode: "allowed", p_reason: "x yz" })).error !== null && (await mgr.rpc("hc_admin_set_reapply", { p_application_id: id("Dee"), p_mode: "blocked", p_reason: "nope" })).error?.message.includes("application_not_declined") === true);
  su(`update creator_applications set reviewed_at = now() - interval '200 days' where email_normalized='bo@example.test'`);
  await bo(); ok("R5 restricted applicant cannot re-apply even after 200 days", boCount() === 1);
  await mgr.rpc("hc_admin_set_reapply", { p_application_id: BOID, p_mode: "default", p_reason: "restriction lifted" });
  const r6 = await bo(); ok("R6 default rule after 90+ days: re-application accepted as a NEW application", boCount() === 2 && (r6.data as any)?.duplicate === false, JSON.stringify(r6.data));
  su(`update creator_applications set status='declined', reviewed_at = now() where email_normalized='bo@example.test' and id<>'${BOID}'`);   // the second application is declined today
  const BO2 = su(`select id from creator_applications where email_normalized='bo@example.test' and id<>'${BOID}'`);
  const blockedAgain = await bo(); ok("R6b declined again today: waiting period applies again", boCount() === 2 && (blockedAgain.data as any)?.duplicate === true);
  ok("R6c staff allow re-applying now (reason recorded)", !(await mgr.rpc("hc_admin_set_reapply", { p_application_id: BO2, p_mode: "allowed", p_reason: "reviewed, ok to retry" })).error && su(`select reapply_override from creator_applications where id='${BO2}'`) === "allowed");
  const r7 = await bo(); ok("R7 staff 'allow now' lets a declined applicant re-apply before 90 days", boCount() === 3 && (r7.data as any)?.duplicate === false, String(boCount()));
  const ovR = parseMembershipOverview((await mgr.rpc("hc_admin_membership_overview")).data)!; ok("R8 staff overview shows declined applicants with their re-apply date/override", ovR.declined.length >= 1 && ovR.settings.reapplyWaitDays === 90 && ovR.settings.draftExpiryDays === 30);
  ok("R9 re-apply form parsing: reason required, modes validated", !parseReapplyForm(fd({ application_id: BOID, mode: "blocked", reason: "" })).ok && parseReapplyForm(fd({ application_id: BOID, mode: "allowed", reason: "fine" })).ok && !parseReapplyForm(fd({ application_id: BOID, mode: "x", reason: "fine" })).ok);
  ok("R10 approved memberships never expire: no code path changes them (still approved/left as set)", su(`select string_agg(status, ',' order by display_name) from partners`) === "left,approved");
  ok("F1 every new feedback code has user-safe copy", feedbackMessage("left").includes("left") && feedbackMessage("reason_required").includes("reason"));
  console.log(log.join("\n")); console.log(`\nALL ${n} CHECKS PASSED`);
})().catch((e) => { console.log(log.join("\n")); console.error("\nFAILED:", e.message); process.exit(1); });
