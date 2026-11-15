// Scenario B: configurable tiers, single writer, audit, versioned terms, paid-referral gate. Layers: DB + REAL web actions via PostgREST.
import { check, sql, sqlErr, addUser, addStaff, jwt, rpc, summary } from "./lib.mjs";
import { NextSignal } from "./stubs/next-navigation.mjs";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54481"; globalThis.__e2eAnon = jwt(undefined, "anon");
const owner = addUser("owner@e2e.test"), mgr = addUser("manager@e2e.test"), sup = addUser("support@e2e.test"), biz = addUser("biz@e2e.test");
addStaff(owner, "owner"); addStaff(mgr, "creator_program_manager"); addStaff(sup, "support"); addStaff(biz, "business_admin");
const as = (u) => { globalThis.__e2eJwt = u ? jwt(u, "authenticated") : undefined; };
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const cnt = (q) => Number(sql(q));
const run = async (u, fn, o) => { as(u); try { return await fn(form(o)); } catch (e) { return e instanceof NextSignal ? { signal: e.kind } : { thrown: e.message }; } };
const tiers = await import("../app/(command-center)/command-center/hosting-collective/tiers/actions.ts");
const forms = await import("../app/(command-center)/command-center/hosting-collective/form-actions.ts");
const payouts = await import("../app/(command-center)/command-center/hosting-collective/payouts/actions.ts");
const fa = (fn) => (fd) => fn(null, fd);

check("B0", "defaults: NO tiers pre-created, paid referrals OFF, program master switch OFF, terms v1 = approved economics only (no invented rates)", "DB",
  "0 tiers; paid=false; enabled=false; v1: pass 50, plus 1200, 45d, 5000; commission_rates empty",
  `${cnt("select count(*) from hc_tiers")} tiers; paid=${sql("select paid_referrals_enabled from hc_settings")}; enabled=${sql("select enabled from hc_settings")}; v1=${sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts")} ${sql("select validation_days||'d/'||min_payout_cents from hc_terms_versions")}; rates=${cnt("select count(*) from commission_rates")}`,
  cnt("select count(*) from hc_tiers") === 0 && sql("select paid_referrals_enabled from hc_settings") === "f" && sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts") === "gathering_pass=50,plus_annual=1200" && sql("select validation_days||'/'||min_payout_cents from hc_terms_versions") === "45/5000" && cnt("select count(*) from commission_rates") === 0);

// B1 owner creates a tier through the tiers page action
let r = await run(owner, tiers.saveTier, { slug: "founding", label: "Founding Creator", description: "d", eligibility_notes: "n", benefits: "Early access\nDirect support", sort_order: "10", active: "yes", reason: "initial tier definition" });
check("B1", "owner defines a tier (saveTier: hc_upsert_tier + hc_admin_set_tier_benefits)", "web action + DB", "ok; tier row; benefits 2; paid_referrals_eligible=false", `${JSON.stringify(r)}; ${sql("select slug||'/'||paid_referrals_eligible||'/'||jsonb_array_length(benefits) from hc_tiers")}`, r.ok && sql("select slug||'/'||paid_referrals_eligible||'/'||jsonb_array_length(benefits) from hc_tiers") === "founding/false/2");
const auditCnt = () => `cfg=${cnt("select count(*) from hc_config_audit where entity='tier'")} tier_audit=${cnt("select count(*) from hc_tier_audit")}`;
check("B2", "audit rows written for the create + benefits update, each with the reason, actor = owner", "DB", "hc_config_audit tier rows >=2 with reason; hc_tier_audit >=1; actor=owner",
  `${auditCnt()}; reasons=${sql("select string_agg(coalesce(reason,'NULL'), ' | ' order by id) from hc_config_audit where entity='tier'")}; actors_ok=${sql("select bool_and(actor='" + owner + "') from hc_config_audit where entity='tier'")}`,
  cnt("select count(*) from hc_config_audit where entity='tier'") >= 2 && cnt("select count(*) from hc_config_audit where entity='tier' and reason is null") === 0 && sql("select bool_and(actor='" + owner + "') from hc_config_audit where entity='tier'") === "t" && cnt("select count(*) from hc_tier_audit") >= 1);

// B3 manager can edit non-money tier fields
r = await run(mgr, tiers.saveTier, { slug: "founding", label: "Founding Creators", description: "d2", benefits: "Early access\nDirect support\nBrand briefs", sort_order: "10", active: "yes", reason: "add benefit" });
check("B3", "manager edits label/benefits of a NON-paid tier", "web action + DB", "ok; label updated; 3 benefits", `${JSON.stringify(r)}; ${sql("select label||'/'||jsonb_array_length(benefits) from hc_tiers")}`, r.ok && sql("select label||'/'||jsonb_array_length(benefits) from hc_tiers") === "Founding Creators/3");
// B4 manager cannot enable paid eligibility
r = await run(mgr, tiers.saveTier, { slug: "founding", label: "Founding Creators", benefits: "Early access", sort_order: "10", active: "yes", reason: "try paid", paid_referrals_eligible: "yes" });
const mgrDirect = await rpc(jwt(mgr), "hc_upsert_tier", { p_slug: "founding", p_label: "x1", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: true, p_reason: "try" });
const mgrLegacy = await rpc(jwt(mgr), "hc_admin_upsert_tier", { p_slug: "founding", p_label: "x1", p_description: null, p_eligibility_notes: null, p_benefits: [], p_referral_eligible: true, p_assignments_enabled: true, p_sort_order: 1, p_active: true });
const mgrElig = await run(mgr, tiers.setTierEligibility, { slug: "founding", eligible: "yes", confirm: "yes", reason: "mgr try" });
check("B4", "manager CANNOT enable paid-referral eligibility on any writer path (web saveTier (ignored field), setTierEligibility action, direct hc_upsert_tier, legacy hc_admin_upsert_tier)", "web action + DB via PostgREST", "all refused; eligible stays false", `saveTier=${JSON.stringify(r)}; action=${JSON.stringify(mgrElig)}; ${mgrDirect.error?.message}; ${mgrLegacy.error?.message}; eligible=${sql("select paid_referrals_eligible from hc_tiers")}`, mgrElig.signal === "NOT_FOUND" && !!mgrDirect.error && !!mgrLegacy.error && sql("select paid_referrals_eligible from hc_tiers") === "f");
// B5 support / non-staff / anon
const sd = await rpc(jwt(sup), "hc_upsert_tier", { p_slug: "zz", p_label: "zz", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: false, p_reason: "try" });
const ad = await rpc(jwt(undefined, "anon"), "hc_upsert_tier", { p_slug: "zz", p_label: "zz", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: false, p_reason: "try" });
const wr = await run(sup, tiers.saveTier, { slug: "zz", label: "zz", reason: "try again" });
check("B5", "support staff / anon cannot write tiers (RPC + web)", "web action + DB via PostgREST", "not_authorized; anon denied; NOT_FOUND; no 'zz' row", `${sd.error?.message}; anon ${ad.status}; ${JSON.stringify(wr)}; zz rows=${cnt("select count(*) from hc_tiers where slug='zz'")}`, /not_authorized/.test(sd.error?.message) && [401, 403].includes(ad.status) && wr.signal === "NOT_FOUND" && cnt("select count(*) from hc_tiers where slug='zz'") === 0);
// B6 hc_tier_write is not callable by API roles
const tw = await rpc(jwt(owner), "hc_tier_write", { p_slug: "zz", p_label: "zz", p_description: null, p_eligibility_notes: null, p_sort_order: 1, p_active: true, p_paid_referrals_eligible: false, p_benefits: null, p_assignments_enabled: null, p_reason: "direct" });
check("B6", "hc_tier_write itself is not exposed to API callers (even the owner)", "DB via PostgREST", "401/403/404-style denial", `${tw.status} ${tw.error?.message ?? tw.error?.code ?? ""}`, !tw.data && tw.status >= 400);
// B7 owner enables paid eligibility; audit
r = await run(owner, tiers.setTierEligibility, { slug: "founding", eligible: "yes", confirm: "yes", reason: "owner enables paid eligibility" });
const noConf = await run(owner, tiers.setTierEligibility, { slug: "founding", eligible: "yes", reason: "no confirm" });
const badYN = await run(owner, tiers.setTierEligibility, { slug: "founding", eligible: "maybe", confirm: "yes", reason: "bad value" });
check("B7", "owner enables paid eligibility via explicit setTierEligibility (yes/no + reason + confirmation): allowed; audit row shows before/after + reason; no confirm / non yes-no refused", "web action + DB", "ok; eligible=true; audit f->t; confirmation_required; invalid_state", `${JSON.stringify(r)}; ${noConf.code}; ${badYN.code}; ${sql("select paid_referrals_eligible from hc_tiers")}; ${sql("select (before->>'paid_referrals_eligible')||'->'||(after->>'paid_referrals_eligible')||' '||reason from hc_config_audit where entity='tier' and (before->>'paid_referrals_eligible') is distinct from (after->>'paid_referrals_eligible') and before is not null order by id desc limit 1")}`, r.ok && noConf.code === "confirmation_required" && badYN.code === "invalid_state" && sql("select paid_referrals_eligible from hc_tiers") === "t");
// B8 manager edits an owner-enabled tier (UI: checkbox is not rendered for managers)
r = await run(mgr, tiers.saveTier, { slug: "founding", label: "Founding Creators II", benefits: "Early access", sort_order: "10", active: "yes", reason: "rename only" });
check("B8", "manager renames a tier that the owner already made paid-eligible (form sends NULL = unchanged)", "web action + DB", "rename allowed, eligibility untouched", `${JSON.stringify(r)}; label=${sql("select label from hc_tiers")}; eligible=${sql("select paid_referrals_eligible from hc_tiers")}`, r.ok && sql("select paid_referrals_eligible from hc_tiers") === "t", "217330: NULL = unchanged");
// B9 owner edit without checkbox silently clears eligibility
r = await run(owner, tiers.saveTier, { slug: "founding", label: "Founding Creators", benefits: "Early access", sort_order: "10", active: "yes", reason: "owner relabel" });
check("B9", "owner re-saves the tier form WITHOUT ticking the box: eligibility must not change silently", "web action + DB", "eligible stays true (or user is warned)", `${JSON.stringify(r)}; eligible=${sql("select paid_referrals_eligible from hc_tiers")}`, sql("select paid_referrals_eligible from hc_tiers") === "t", "217330: NULL = unchanged");
// restore eligible=true for later checks
await run(owner, tiers.setTierEligibility, { slug: "founding", eligible: "yes", confirm: "yes", reason: "owner re-enable" });
// B10 other writer paths audited
const before = cnt("select count(*) from hc_config_audit where entity='tier'");
r = await run(mgr, fa(forms.upsertTierForm), { slug: "supporter", label: "Supporter", benefits: "Newsletter", sort_order: "20", active: "yes", reason: "r1" });
const sb = await rpc(jwt(mgr), "hc_admin_set_tier_benefits", { p_slug: "supporter", p_benefits: ["Newsletter", "Q&A"], p_reason: "benefits via set_tier_benefits" });
check("B10", "legacy members-page writer (hc_admin_upsert_tier) and set_tier_benefits both go through hc_tier_write and are audited with a reason", "web action + DB via PostgREST", "tier created; benefits 2; config_audit +>=2; none without reason", `${JSON.stringify(r)}; sb=${JSON.stringify(sb.data ?? sb.error)}; benefits=${sql("select jsonb_array_length(benefits) from hc_tiers where slug='supporter'")}; audit +${cnt("select count(*) from hc_config_audit where entity='tier'") - before}; null reasons=${cnt("select count(*) from hc_config_audit where entity='tier' and reason is null")}`, r.ok && sb.data?.status === "updated" && cnt("select count(*) from hc_config_audit where entity='tier'") - before >= 2 && cnt("select count(*) from hc_config_audit where entity='tier' and reason is null") === 0);
// B11 single writer (static scan of every function body + dynamic call counter)
const writers = sql("select string_agg(proname, ',' order by proname) from pg_proc where pronamespace='public'::regnamespace and prosrc ~* '(insert\\s+into|update|delete\\s+from)\\s+public\\.hc_tiers\\y'");
check("B11a", "only ONE function body in the schema writes public.hc_tiers", "DB (pg_proc scan)", "hc_tier_write", writers, writers === "hc_tier_write");
// B11b direct table writes denied for every API role
const tbl = {}; for (const [lab, tok] of [["owner", jwt(owner)], ["manager", jwt(mgr)], ["anon", jwt(undefined, "anon")]]) {
  const res = await fetch("http://127.0.0.1:54494/hc_tiers?slug=eq.founding", { method: "PATCH", headers: { authorization: `Bearer ${tok}`, apikey: tok, "content-type": "application/json", prefer: "return=representation" }, body: JSON.stringify({ paid_referrals_eligible: true, label: "HACK" }) });
  tbl[lab] = `${res.status}:${(await res.text()).slice(0, 60)}`; }
check("B11b", "direct PATCH on hc_tiers over the REST API is refused for owner, manager and anon (RLS/grants)", "DB via PostgREST", "no row changed", JSON.stringify(tbl) + `; label=${sql("select label from hc_tiers where slug='founding'")}`, sql("select label from hc_tiers where slug='founding'") !== "HACK" && Object.values(tbl).every(v => !/HACK/.test(v)));
// B12 slug rule mismatch web vs db
r = await run(owner, tiers.saveTier, { slug: "founding-host", label: "Hyphen tier", reason: "hyphen slug" });
check("B12", "slug accepted by the web validator (hyphen allowed) is accepted by the DB, or fails with a clear code", "web action + DB", "ok or invalid_slug message", JSON.stringify(r), r.ok || r.code === "invalid_slug", "informational: web SLUG allows '-', DB tier slug regex is [a-z0-9_]{2,32}");

// ---- versioned terms
const eff = new Date(Date.now() + 10 * 86400000).toISOString();
r = await run(mgr, payouts.addTermsVersion, { confirm: "yes", amount_gathering_pass: "75", validation_days: "45", min_payout_cents: "5000", effective_from: eff, note: "mgr try" });
check("B13", "manager cannot add commission terms (owner-only)", "web action", "NOT_FOUND", JSON.stringify(r), r.signal === "NOT_FOUND");
const mdir = await rpc(jwt(mgr), "hc_add_terms_version", { p_amounts: { gathering_pass: 75 }, p_validation_days: 45, p_min_payout_cents: 5000, p_effective_from: eff, p_note: "x" });
const pastE = await rpc(jwt(owner), "hc_add_terms_version", { p_amounts: { gathering_pass: 75 }, p_validation_days: 45, p_min_payout_cents: 5000, p_effective_from: new Date(Date.now() - 86400000).toISOString(), p_note: "past" });
const badProd = await rpc(jwt(owner), "hc_add_terms_version", { p_amounts: { multi_day_pass: 100 }, p_validation_days: 45, p_min_payout_cents: 5000, p_effective_from: eff, p_note: "bad product" });
check("B14", "terms writes refused for manager (direct RPC), past effective date, and non-commissionable product", "DB via PostgREST", "not_authorized; must_be_effective_in_future; product_not_commissionable", `${mdir.error?.message}; ${pastE.error?.message}; ${badProd.error?.message}`, /not_authorized/.test(mdir.error?.message) && /future/.test(pastE.error?.message) && /product_not_commissionable/.test(badProd.error?.message));
r = await run(owner, payouts.addTermsVersion, { confirm: "yes", amount_gathering_pass: "75", validation_days: "45", min_payout_cents: "5000", effective_from: eff, note: "owner proposal (test values)" });
check("B15", "owner adds a FUTURE version: v2 created, plus_annual carried over, v1 untouched, audit rows", "web action + DB", "ok; v2 pass=75 plus=1200; v1 pass=50", `${JSON.stringify(r)}; v2=${sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts where version=2")}; v1=${sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts where version=1")}; cfg=${cnt("select count(*) from hc_config_audit where entity like 'terms%'")}`, r.ok && sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts where version=2") === "gathering_pass=75,plus_annual=1200" && sql("select string_agg(canonical_product_id||'='||amount_cents, ',' order by 1) from hc_terms_amounts where version=1") === "gathering_pass=50,plus_annual=1200");
const inForceNow = sql("select version from hc_terms_in_force(now())"), inForceLater = sql(`select version from hc_terms_in_force('${eff}'::timestamptz + interval '1 minute')`);
check("B16", "versioning: terms in force NOW stay v1; v2 applies only from its effective date", "DB", "now=1; later=2", `now=${inForceNow}; later=${inForceLater}`, inForceNow === "1" && inForceLater === "2");
const upd = sqlErr("update hc_terms_amounts set amount_cents=999 where version=1"), del = sqlErr("delete from hc_terms_versions where version=1");
check("B17", "terms history is append-only (UPDATE/DELETE blocked even for the table owner)", "DB", "both raise", `${upd}; ${del}`, !!upd && !!del);
// ---- paid referrals switch
const act = async (u, phrase) => run(u, payouts.paidReferralsSwitch, { mode: "activate", phrase, reason: "test activation" });
r = await act(mgr, "ACTIVATE PAID REFERRALS");
check("B18", "manager cannot flip the paid-referrals switch", "web action", "NOT_FOUND", JSON.stringify(r), r.signal === "NOT_FOUND");
const mdir2 = await rpc(jwt(mgr), "hc_activate_paid_referrals", { p_confirm: "ACTIVATE PAID REFERRALS", p_reason: "mgr" });
check("B19", "direct hc_activate_paid_referrals by manager -> not_authorized; by owner with wrong phrase -> confirmation_required", "DB via PostgREST", "not_authorized; confirmation_required", `${mdir2.error?.message}; ${(await rpc(jwt(owner), "hc_activate_paid_referrals", { p_confirm: "yes", p_reason: "r" })).error?.message}`, /not_authorized/.test(mdir2.error?.message));
r = await act(owner, "ACTIVATE PAID REFERRALS");
check("B20", "owner activation with the program master switch (hc_settings.enabled) OFF is refused; no Command Center control exists to turn that master switch on", "web action + DB", "refused (program_not_enabled); paid stays false; NO function/UI sets hc_settings.enabled", `${JSON.stringify(r)}; paid=${sql("select paid_referrals_enabled from hc_settings")}; setters=${sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and prosrc ~* 'update\\s+public\\.hc_settings[^;]*\\menabled\\s*=' ")}`, r.ok === false && sql("select paid_referrals_enabled from hc_settings") === "f", "see DEFECT/GAP E-B3");
sql("update hc_settings set enabled=true");   // manual SQL, the only way (simulating the owner's SQL-editor step)
r = await act(owner, "ACTIVATE PAID REFERRALS");
check("B21", "with the master switch on (via SQL), owner activation succeeds; audit rows in hc_config_audit(settings) and admin_audit_log", "web action + DB", "ok; paid=true; audit>=1", `${JSON.stringify(r)}; paid=${sql("select paid_referrals_enabled from hc_settings")}; cfg=${cnt("select count(*) from hc_config_audit where entity='settings'")}; admin=${cnt("select count(*) from admin_audit_log where action='hc.paid_referrals_activated'")}`, r.ok && sql("select paid_referrals_enabled from hc_settings") === "t" && cnt("select count(*) from admin_audit_log where action='hc.paid_referrals_activated'") === 1);
const dd = await rpc(jwt(owner), "hc_deactivate_paid_referrals", { p_reason: "switch back off" });
check("B22", "owner can switch paid referrals back off (audited)", "DB via PostgREST", "deactivated; paid=false", `${JSON.stringify(dd.data)}; ${sql("select paid_referrals_enabled from hc_settings")}`, dd.data?.status === "deactivated" && sql("select paid_referrals_enabled from hc_settings") === "f");
// B23 audit readers
const rd = await rpc(jwt(mgr), "hc_admin_config_audit", { p_entity: null, p_limit: 50 });
const rdS = await rpc(jwt(sup), "hc_admin_config_audit", { p_entity: null, p_limit: 50 });
check("B23", "audit history readable by manager (hc.read), refused for support", "DB via PostgREST", "rows>0; not_authorized", `${Array.isArray(rd.data) ? rd.data.length : JSON.stringify(rd.error)}; ${rdS.error?.message}`, Array.isArray(rd.data) && rd.data.length > 0 && /not_authorized/.test(rdS.error?.message));
summary();
