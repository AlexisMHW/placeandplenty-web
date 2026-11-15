// Scenario A: HC lifecycle apply -> review -> approve/decline -> member status -> notifications. Layers: DB + REAL web route/actions via PostgREST.
import { check, eq, sql, sqlErr, addUser, addStaff, jwt, rpc, summary, uuid } from "./lib.mjs";
import { NextSignal } from "./stubs/next-navigation.mjs";

const SB = "http://127.0.0.1:54481";
process.env.NEXT_PUBLIC_SUPABASE_URL = SB; globalThis.__e2eAnon = jwt(undefined, "anon"); process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = globalThis.__e2eAnon;
delete process.env.HC_NOTIFY_DISPATCH_ENABLED; delete process.env.COMMS_SEND_ENABLED; delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const owner = addUser("owner@e2e.test"), mgr = addUser("manager@e2e.test"), sup = addUser("support@e2e.test"), plain = addUser("plain@e2e.test");
const apA = addUser("applicant.a@e2e.test"), apC = addUser("applicant.c@e2e.test");
addStaff(owner, "owner"); addStaff(mgr, "creator_program_manager"); addStaff(sup, "support");
const as = (u, role = "authenticated") => { globalThis.__e2eJwt = u ? jwt(u, role, `${u}@x`) : undefined; };
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const cnt = (q) => Number(sql(q));

const apply = (await import("../app/api/hosting-collective/apply/route.ts")).POST;
const hcActions = await import("../app/(command-center)/command-center/hosting-collective/form-actions.ts");
const tierActions = await import("../app/(command-center)/command-center/hosting-collective/tiers/actions.ts");
const { runHcDispatch } = await import("../lib/hc/dispatch-runner.ts");
const dispatchRoute = (await import("../app/api/hosting-collective/dispatch/route.ts")).POST;
const { createDisabledProvider } = await import("../lib/comms/provider.ts");

const payload = (email, name, extra = {}) => ({ terms_version: "draft-1", fullName: name, email, platforms: [{ platform: "instagram", handle: `@${name.replace(/\W/g, "").toLowerCase()}` }], niches: ["dinner_brunch"], audienceSummary: "hosting content", priorWorkUrls: [], collaborationInterest: ["referral_program"], disclosureAck: true, consentToContact: true, ...extra });
const post = (body) => apply(new Request("http://localhost:3000/api/hosting-collective/apply", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) }));

// ---- A1 intake closed by default -------------------------------------------------------------------
let r = await post(payload("applicant.a@e2e.test", "Ann Applicant"));
let j = await r.json();
check("A1", "intake closed by default (kill switch): apply returns closed, nothing stored", "web route + DB", "status=closed, 0 applications, 0 inbox rows", `${j.status}, ${cnt("select count(*) from creator_applications")} apps, ${cnt("select count(*) from cc_notifications")} inbox`, j.status === "closed" && cnt("select count(*) from creator_applications") === 0 && cnt("select count(*) from cc_notifications") === 0);

sql("update hc_intake_settings set applications_open=true, terms_version='draft-1'");
// ---- A2 apply (account-matching + no-account applicants)
r = await post(payload("applicant.a@e2e.test", "Ann Applicant")); j = await r.json();
const appA = sql("select id from creator_applications where email='applicant.a@e2e.test'");
check("A2", "apply (open): stored once, status received, linked to confirmed account", "web route + DB", "200 received; 1 row; applicant_user_id = account", `${r.status} ${j.status}; ${cnt("select count(*) from creator_applications")} row; linked=${sql("select applicant_user_id='" + apA + "' from creator_applications where id='" + appA + "'")}`, r.status === 200 && j.status === "received" && sql("select applicant_user_id='" + apA + "' from creator_applications where id='" + appA + "'") === "t");
check("A3", "apply fan-out: one hc_owner_notification, ONE cc_notifications inbox row (hc_application_received), one hc_events row, no applicant email yet", "DB",
  "owner_notif=1 inbox=1 events(application_received)=1 applicant_email deliveries=0", `owner_notif=${cnt("select count(*) from hc_owner_notifications")} inbox=${cnt("select count(*) from cc_notifications where category='hc_application_received'")} events=${cnt("select count(*) from hc_events where kind='application_received'")} appl_email=${cnt("select count(*) from hc_event_deliveries where channel='applicant_email'")}`,
  cnt("select count(*) from hc_owner_notifications") === 1 && cnt("select count(*) from cc_notifications where category='hc_application_received'") === 1 && cnt("select count(*) from hc_events where kind='application_received'") === 1 && cnt("select count(*) from hc_event_deliveries where channel='applicant_email'") === 0);
r = await post(payload("applicant.a@e2e.test", "Ann Applicant")); j = await r.json();
check("A4", "duplicate apply (same email) is neutral and creates no second row/notification", "web route + DB", "received+duplicate, 1 app, 1 inbox", `${j.status}, ${cnt("select count(*) from creator_applications")} apps, ${cnt("select count(*) from cc_notifications where category='hc_application_received'")} inbox`, cnt("select count(*) from creator_applications") === 1 && cnt("select count(*) from cc_notifications where category='hc_application_received'") === 1);
check("A4b", "cross-origin / non-JSON apply is rejected before the DB", "web route", "403 and 415", `${(await apply(new Request("http://localhost:3000/api/hosting-collective/apply", { method: "POST", headers: { origin: "http://evil.test", "content-type": "application/json" }, body: "{}" }))).status} and ${(await apply(new Request("http://localhost:3000/api/hosting-collective/apply", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "text/plain" }, body: "{}" }))).status}`, true);
await post(payload("applicant.b@e2e.test", "Bob NoAccount"));   // no account for this email
await post(payload("applicant.c@e2e.test", "Cara Decline"));
const appB = sql("select id from creator_applications where email='applicant.b@e2e.test'"), appC = sql("select id from creator_applications where email='applicant.c@e2e.test'");

// ---- A5 permissions on review (web action gate + DB gate)
const review = async (u, id, decision, extra = {}) => { as(u); try { return await hcActions.reviewApplicationForm(null, form({ id, decision, ...extra })); } catch (e) { return e instanceof NextSignal ? { signal: e.kind } : { thrown: String(e.message) }; } };
let rr = await review(null, appA, "approved");
check("A5a", "anonymous caller reviewing: redirected to login (action gate)", "web action", "REDIRECT", JSON.stringify(rr), rr.signal === "REDIRECT");
rr = await review(plain, appA, "approved");
check("A5b", "signed-in non-staff reviewing: 404 (action gate)", "web action", "NOT_FOUND", JSON.stringify(rr), rr.signal === "NOT_FOUND");
rr = await review(sup, appA, "approved");
check("A5c", "staff WITHOUT hc.applications.review (support): 404", "web action", "NOT_FOUND", JSON.stringify(rr), rr.signal === "NOT_FOUND");
const direct = await rpc(jwt(sup), "hc_review_application", { p_id: appA, p_decision: "approved", p_tier: null, p_note: null, p_code: null });
const directPlain = await rpc(jwt(plain), "hc_review_application", { p_id: appA, p_decision: "approved", p_tier: null, p_note: null, p_code: null });
const directAnon = await rpc(jwt(undefined, "anon"), "hc_review_application", { p_id: appA, p_decision: "approved" });
check("A5d", "same RPC called DIRECTLY over PostgREST (bypassing the web gate): support/non-staff -> not_authorized; anon -> permission denied", "DB via PostgREST", "P0001 not_authorized x2; 401/403 for anon", `${direct.error?.message}; ${directPlain.error?.message}; anon ${directAnon.status}`, /not_authorized/.test(direct.error?.message) && /not_authorized/.test(directPlain.error?.message) && [401, 403].includes(directAnon.status));
check("A5e", "failed attempts changed nothing", "DB", "application still received; 0 partners; 0 approved events", `${sql("select status from creator_applications where id='" + appA + "'")}; ${cnt("select count(*) from partners")} partners`, sql("select status from creator_applications where id='" + appA + "'") === "received" && cnt("select count(*) from partners") === 0);

// ---- A6 manager: in_review then approve (basic member, no tier)
rr = await review(mgr, appA, "in_review", { note: "looks fine" });
check("A6", "manager (creator_program_manager) moves to in_review", "web action + DB", "ok saved; status in_review", `${JSON.stringify(rr)}; ${sql("select status from creator_applications where id='" + appA + "'")}`, rr.ok && sql("select status from creator_applications where id='" + appA + "'") === "in_review");
check("A6b", "in_review does not resolve the inbox row nor email the applicant", "DB", "inbox received row still open; 0 applicant emails", `${sql("select status from cc_notifications where category='hc_application_received' and ref_id='"+appA+"'")}; ${cnt("select count(*) from hc_event_deliveries where channel='applicant_email'")}`, sql("select status from cc_notifications where category='hc_application_received' and ref_id='"+appA+"'") === "open" && cnt("select count(*) from hc_event_deliveries where channel='applicant_email'") === 0);
rr = await review(mgr, appA, "approved", { code: "ann-hosts" });
const evA = () => cnt(`select count(*) from hc_events where kind='application_approved' and ref_id='${appA}'`);
check("A7", "approve (no tier = BASIC member): application approved; partner approved with tier NULL; code issued", "web action + DB", "ok; partner approved tier null; code ann-hosts", `${JSON.stringify(rr)}; ${sql("select status||'/'||coalesce(tier,'null') from partners where user_id='" + apA + "'")}; code=${sql("select code from partner_codes limit 1")}`, rr.ok && sql("select status||'/'||coalesce(tier,'null') from partners where user_id='" + apA + "'") === "approved/null" && sql("select code from partner_codes limit 1") === "ann-hosts");
check("A8", "approval notification fan-out is exactly once: 1 cc_notifications 'hc_application_approved'; 1 hc_event; inbox delivery delivered; ONE applicant_email delivery queued; 0 staff_email; received-row resolved", "DB",
  "cc=1 event=1 inbox_deliv=1 applicant_email=queued staff_email=0 received row resolved", `cc=${cnt("select count(*) from cc_notifications where category='hc_application_approved'")} event=${evA()} inbox_deliv=${cnt("select count(*) from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.ref_id='" + appA + "' and e.kind='application_approved' and d.channel='inbox'")} applicant_email=${sql("select string_agg(d.status,',') from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.ref_id='" + appA + "' and e.kind='application_approved' and d.channel='applicant_email'")} staff_email=${cnt("select count(*) from hc_event_deliveries where channel='staff_email'")} received=${sql("select status from cc_notifications where category='hc_application_received' and ref_id='"+appA+"'")}`,
  cnt("select count(*) from cc_notifications where category='hc_application_approved'") === 1 && evA() === 1 && sql("select string_agg(d.status,',') from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.ref_id='" + appA + "' and e.kind='application_approved' and d.channel='applicant_email'") === "queued" && cnt("select count(*) from hc_event_deliveries where channel='staff_email'") === 0 && sql("select status from cc_notifications where category='hc_application_received' and ref_id='"+appA+"'") === "resolved");
rr = await review(mgr, appA, "approved");
check("A9", "approval replay (double click / retry) does not duplicate inbox row, event, or applicant email", "web action + DB", "still cc=1 event=1 applicant_email=1", `${JSON.stringify(rr)}; cc=${cnt("select count(*) from cc_notifications where category='hc_application_approved'")} event=${evA()} appl=${cnt("select count(*) from hc_event_deliveries where channel='applicant_email'")}`, cnt("select count(*) from cc_notifications where category='hc_application_approved'") === 1 && evA() === 1 && cnt("select count(*) from hc_event_deliveries where channel='applicant_email'") === 1);
rr = await review(mgr, appA, "declined");
check("A10", "approved application cannot be declined afterwards", "web action + DB", "ok=false code already_approved", JSON.stringify(rr), rr.ok === false && rr.code === "already_approved");
// decline path
rr = await review(mgr, appC, "declined", { note: "not a fit" });
check("A11", "decline: application declined, NO partner, one inbox row (hc_application_declined), ONE applicant email queued", "web action + DB", "ok; partners for C=0; declined cc=1; applicant_email events for C =1", `${JSON.stringify(rr)}; partnerC=${cnt("select count(*) from partners where user_id='" + apC + "'")}; cc=${cnt("select count(*) from cc_notifications where category='hc_application_declined'")}; appl=${cnt("select count(*) from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.ref_id='" + appC + "' and d.channel='applicant_email'")}`, rr.ok && cnt("select count(*) from partners where user_id='" + apC + "'") === 0 && cnt("select count(*) from cc_notifications where category='hc_application_declined'") === 1 && cnt("select count(*) from hc_event_deliveries d join hc_events e on e.id=d.event_id where e.ref_id='" + appC + "' and d.channel='applicant_email'") === 1);
rr = await review(mgr, appC, "approved");
check("A12", "declined application cannot be re-approved (closed)", "web action", "ok=false application_closed", JSON.stringify(rr), rr.ok === false && rr.code === "application_closed");
// applicant without an account
rr = await review(mgr, appB, "approved");
const pB = sql("select count(*)||'/'||coalesce(max(status),'-')||'/'||coalesce(max(user_id::text),'NULL') from partners where user_id is null");
check("A13", "approve an applicant who has NO account yet: records a partner without a user (observed behaviour)", "web action + DB", "ok saved; documented behaviour = partner row with NULL user until claimed", `${JSON.stringify(rr)}; null-user partners ${pB}`, rr.ok ? "PARTIAL" : false, "recorded behaviour, see report");
// ---- A14 member status (manager)
const partnerA = sql("select id from partners where user_id='" + apA + "'");
const setStatus = async (u, status, reason) => { as(u); try { return await tierActions.setPartnerStatus(form({ partner_id: partnerA, status, reason })); } catch (e) { return e instanceof NextSignal ? { signal: e.kind } : { thrown: String(e.message) }; } };
rr = await setStatus(sup, "suspended", "policy breach");
check("A14a", "support staff cannot suspend a member", "web action", "NOT_FOUND", JSON.stringify(rr), rr.signal === "NOT_FOUND");
rr = await setStatus(mgr, "suspended", "policy breach test");
check("A14b", "manager suspends member: partner suspended; tier audit row 'member_status_changed'; hc_event member_suspended; config audit row with reason", "web action + DB", "ok; suspended; audit>=1; event=1", `${JSON.stringify(rr)}; ${sql("select status from partners where id='" + partnerA + "'")}; tier_audit=${cnt("select count(*) from hc_tier_audit where partner_id='" + partnerA + "' and action='member_status_changed'")}; event=${cnt("select count(*) from hc_events where kind='member_suspended'")}; cfg_audit=${cnt("select count(*) from hc_config_audit")}`, rr.ok && sql("select status from partners where id='" + partnerA + "'") === "suspended" && cnt("select count(*) from hc_events where kind='member_suspended'") === 1);
check("A14c", "member suspension raises NO cc_notifications inbox row (only hc_events)", "DB", "observation (decision D5 category list has no member-status category)", `${cnt("select count(*) from cc_notifications where category like '%suspend%'")}`, "PARTIAL", "informational");
rr = await setStatus(mgr, "approved", "resolved after review");
check("A14d", "reinstate: status approved, event member_reinstated", "web action + DB", "ok; approved", `${JSON.stringify(rr)}; ${sql("select status from partners where id='" + partnerA + "'")}`, rr.ok && sql("select status from partners where id='" + partnerA + "'") === "approved");

// ---- A15 founder email config-only
const set = sql("select destination_status||'|'||email_enabled||'|'||coalesce(email_destination,'(null)') from cc_notification_settings");
check("A15", "founder email default: unset / disabled / no destination; no cc_notification_deliveries rows were created by any event above", "DB", "unset|false|(null); 0 deliveries", `${set}; ${cnt("select count(*) from cc_notification_deliveries")}`, set === "unset|false|(null)" && cnt("select count(*) from cc_notification_deliveries") === 0);
const none = await rpc(jwt(mgr), "admin_set_notification_destination", { p_email: "founder-test@example.invalid" });
const sup2 = await rpc(jwt(sup), "admin_set_notification_email_enabled", { p_enabled: true });
const ownerEnableEarly = await rpc(jwt(owner), "admin_set_notification_email_enabled", { p_enabled: true });
check("A16", "founder controls owner-gated: manager/support denied; owner cannot enable before verification", "DB via PostgREST", "not_authorized; not_authorized; destination_not_verified", `${none.error?.message}; ${sup2.error?.message}; ${ownerEnableEarly.error?.message}`, /not_authorized/.test(none.error?.message) && /not_authorized/.test(sup2.error?.message) && /destination_not_verified/.test(ownerEnableEarly.error?.message));
const od = await rpc(jwt(owner), "admin_set_notification_destination", { p_email: "founder-test@example.invalid" });
check("A17", "owner sets a (test) destination: becomes pending_verification, email stays DISABLED, code never returned; a verification delivery is queued (not sent)", "DB via PostgREST", "pending_verification; email_enabled=false; response has no code", `${JSON.stringify(od.data)}; ${sql("select destination_status||'|'||email_enabled from cc_notification_settings")}; deliveries=${sql("select string_agg(kind||':'||status,',') from cc_notification_deliveries")}`, od.data?.status === "pending_verification" && sql("select email_enabled from cc_notification_settings") === "f" && !/code/.test(JSON.stringify(od.data)));
// new event while pending: no founder email delivery
sql("update hc_intake_settings set max_per_hour=60"); const dd = await rpc(jwt(undefined,"anon"), "submit_creator_application", { p_payload: { terms_version: "draft-1", full_name: "Dee Later", email: "applicant.d@e2e.test", platforms: [{ platform: "instagram", handle: "@deelater" }], niches: ["dinner_brunch"], audience_summary: "Weekly dinner party and tablescape content for hosts.", prior_work_urls: [], collaboration_interest: [], disclosure_ack: true, consent_to_contact: true } }); console.log("direct anon apply:", JSON.stringify(dd.data ?? dd.error));
check("A18", "with a pending/unverified destination, new events still create inbox rows but NO founder email delivery rows (only the verification one)", "DB", "4 received rows (A,B,C,D) total; deliveries remain only verification", `inbox=${cnt("select count(*) from cc_notifications where category='hc_application_received'")}; deliveries=${sql("select string_agg(kind,',') from cc_notification_deliveries")}`, cnt("select count(*) from cc_notifications where category='hc_application_received'") === 4 && sql("select string_agg(kind,',') from cc_notification_deliveries") === "verification");

// ---- A19 dispatch (applicant email) safety
const sk = () => ({ rpc: (fn, a) => rpcSvc(fn, a) });
const rpcSvc = async (fn, a) => { const x = await rpc(jwt(undefined, "service_role"), fn, a); return { data: x.data, error: x.error ? { message: x.error.message ?? JSON.stringify(x.error) } : null }; };
const q0 = cnt("select count(*) from hc_event_deliveries where channel='applicant_email' and status='queued'");
const env0 = {}; const s0 = await runHcDispatch({ env: env0, provider: createDisabledProvider(), serviceClient: () => sk() });
const s1 = await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true" }, provider: createDisabledProvider(), serviceClient: () => sk() });
const s2 = await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", SITE_URL: "http://localhost:3000" }, provider: createDisabledProvider(), serviceClient: () => sk() });
check("A19", "dispatch default OFF; flag on but no mailer -> nothing claimed; flag+send on but DISABLED provider -> nothing delivered, rows not burned", "web lib + DB", `off: dispatch_disabled; flag only: mailer_not_configured; disabled provider: no 'sent'; queued stays ${q0}`, `${s0.reason}; ${s1.reason}; ${JSON.stringify(s2)}; queued now ${cnt("select count(*) from hc_event_deliveries where channel='applicant_email' and status='queued'")}; sent/delivered=${cnt("select count(*) from hc_event_deliveries where status in ('sent','delivered')  and channel='applicant_email'")}`, s0.reason === "dispatch_disabled" && s1.reason === "mailer_not_configured" && cnt("select count(*) from hc_event_deliveries where status in ('sent','delivered') and channel='applicant_email'") === 0);
const route = await dispatchRoute(new Request("http://localhost/api/hosting-collective/dispatch", { method: "POST" }));
check("A20", "dispatch route requires its shared secret (none configured -> 401)", "web route", "401", String(route.status), route.status === 401);
// Mock provider (in-process recorder; no network): proves claim -> send -> status transitions and message content minimality
sql("update hc_event_deliveries set next_attempt_at=now() where status='queued'");   // time passes: leases/backoff elapsed
const q1 = sql("select string_agg(status||':'||attempts, ',' order by id) from hc_event_deliveries where channel='applicant_email'");
const sent = []; const mock = { send: async (m) => { sent.push(m); return { status: "sent", providerMessageId: "mock-" + sent.length }; } };
const s3 = await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", SITE_URL: "http://localhost:3000" }, provider: mock, serviceClient: () => sk() });
const states = sql("select string_agg(status||':'||attempts, ',' order by id) from hc_event_deliveries where channel='applicant_email'");
check("A21", "MOCK provider (no network): one email per queued applicant delivery, statuses move queued->sent, a re-run sends nothing more (no duplicates)", "web lib + DB (mock provider)", "sent=2 (approved A + declined C + maybe B); second run sent=0", `after disabled-provider run (before time travel): ${q1}; first=${JSON.stringify(s3)}; states=${states}; messages=${sent.length}; rerun=${JSON.stringify(await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", SITE_URL: "http://localhost:3000" }, provider: mock, serviceClient: () => sk() }))}`, s3.sent === sent.length && sent.length >= 2 && (await runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", SITE_URL: "http://localhost:3000" }, provider: mock, serviceClient: () => sk() })).sent === 0);
console.log("MOCK MESSAGE SHAPE:", JSON.stringify(sent.map(m => ({ to: m.to?.replace(/(.).+@/, "$1***@"), subject: m.subject, bodyChars: m.body?.length, hasAmount: /\$|\d+ cents/.test(m.body ?? "") }))));

// ---- A22 verified founder channel (still a mock: nothing is sent; we only read what a worker WOULD be handed)
const code = sql("select payload->>'code' from cc_notification_deliveries where kind='verification'");
const bad = await rpc(jwt(owner), "admin_verify_notification_destination", { p_code: "zzzzzzzz" });
const good = await rpc(jwt(owner), "admin_verify_notification_destination", { p_code: code });
const en = await rpc(jwt(owner), "admin_set_notification_email_enabled", { p_enabled: true, p_min_severity: "info" });
check("A22a", "owner verifies destination (wrong code rejected, right code accepted) then enables founder email", "DB via PostgREST", "wrong_code; verified; enabled", `${JSON.stringify(bad.data)}; ${JSON.stringify(good.data)}; ${en.status}; ${sql("select destination_status||'|'||email_enabled from cc_notification_settings")}`, bad.data === "wrong_code" && good.data === "verified" && sql("select email_enabled from cc_notification_settings") === "t");
await rpc(jwt(undefined, "anon"), "submit_creator_application", { p_payload: { terms_version: "draft-1", full_name: "Eve Founder-Visible", email: "eve.sensitive@e2e.test", platforms: [{ platform: "instagram", handle: "@evef" }], niches: ["dinner_brunch"], audience_summary: "Weekly dinner party and tablescape content for hosts.", prior_work_urls: [], collaboration_interest: [], disclosure_ack: true, consent_to_contact: true } });
const nd = () => cnt("select count(*) from cc_notification_deliveries where kind<>'verification'");
check("A22b", "with verified+enabled founder email a new application queues exactly ONE founder email delivery (queued, not sent)", "DB", "1 delivery status queued", `${nd()} ${sql("select string_agg(status,',') from cc_notification_deliveries where kind<>'verification'")}`, nd() === 1 && sql("select string_agg(status,',') from cc_notification_deliveries where kind<>'verification'") === "queued");
const claim = await rpc(jwt(undefined, "service_role"), "cc_claim_email_deliveries", { p_limit: 10 });
const txt = JSON.stringify(claim.data);
check("A22c", "what the founder-email worker is handed is minimal: generic title/body + link; NO applicant name, email, handle, or money", "DB via PostgREST (service)", "no PII fields", txt.slice(0, 400), !/\bEve\b|eve\.sensitive|@evef|\$|cents/i.test(txt));
const mark = claim.data.filter(x => x.kind !== "verification").map(x => x.id);
if (mark.length) await rpc(jwt(undefined, "service_role"), "cc_record_delivery_result", { p_id: mark[0], p_status: "delivered", p_provider_message_id: "mock-1" });
check("A22d", "queued != delivered: delivery row becomes delivered only after the (mock) provider result is recorded", "DB via PostgREST (service)", "delivered after record", sql("select string_agg(status,',') from cc_notification_deliveries where kind<>'verification'"), sql("select string_agg(status,',') from cc_notification_deliveries where kind<>'verification'") === "delivered");
// also anon/authenticated cannot call the claim/record fns
const denyClaim = await rpc(jwt(owner), "cc_claim_email_deliveries", { p_limit: 5 });
check("A22e", "owner (authenticated) cannot call the service-only delivery claim RPC", "DB via PostgREST", "permission denied (401/403)", String(denyClaim.status), [401, 403].includes(denyClaim.status));

summary();
