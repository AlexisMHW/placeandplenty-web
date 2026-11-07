import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCommission, previewPayout, type VerifiedPurchase } from "../lib/affiliate-policy.ts";

const partner = {id:"partner",ownerUserId:"creator",email:"creator@example.invalid",status:"approved" as const};
const referral = {partnerId:"partner",customerUserId:"customer",attributedAt:"2026-10-01T00:00:00Z"};
const payment: VerifiedPurchase = {id:"pi_first",customerUserId:"customer",customerEmail:"host@example.invalid",
  channel:"web",product:"plus_annual",currency:"usd",subtotalCents:5999,refundedCents:0,
  paidAt:"2026-10-02T00:00:00Z",status:"paid",isRenewal:false,livemode:false};
const base = {partner,referral,paymentId:payment.id,purchases:[payment],historyComplete:true,now:"2026-11-16T00:00:00Z",mode:"test" as const};

test("Plus is $12 after 45 days; Pass accrues $0.50 without a batch requirement",()=>{
  assert.equal(evaluateCommission(base).commission?.amountCents,1200);
  assert.equal(evaluateCommission(base).commission?.state,"available");
  assert.equal(evaluateCommission({...base,purchases:[{...payment,product:"gathering_pass",subtotalCents:999}]}).commission?.amountCents,50);
});
test("45-day hold uses paid time, with exact release boundary",()=>{
  assert.equal(evaluateCommission({...base,now:"2026-11-15T23:59:59.999Z"}).commission?.state,"pending");
  assert.equal(evaluateCommission(base).commission?.state,"available");
});
test("free signup may precede attribution; no signup timestamp limits free-to-paid",()=>{
  assert.ok(evaluateCommission(base).commission);
});
test("30-day window includes boundary but not a millisecond beyond",()=>{
  const atBoundary={...payment,paidAt:"2026-10-31T00:00:00Z"};
  assert.ok(evaluateCommission({...base,purchases:[atBoundary]}).commission);
  assert.equal(evaluateCommission({...base,purchases:[{...atBoundary,paidAt:"2026-10-31T00:00:00.001Z"}]}).reason,"outside_attribution_window");
});
test("later Plus upgrade after first Pass does not get another commission",()=>{
  const first={...payment,product:"gathering_pass",subtotalCents:999};
  const upgrade={...payment,id:"pi_upgrade",paidAt:"2026-10-03T00:00:00Z"};
  assert.equal(evaluateCommission({...base,paymentId:upgrade.id,purchases:[upgrade,first]}).reason,"not_first_purchase");
});
test("earlier native purchase consumes first-purchase eligibility",()=>{
  assert.equal(evaluateCommission({...base,purchases:[payment,{...payment,id:"store_old",channel:"apple",paidAt:"2026-09-01T00:00:00Z"}]}).reason,"not_first_purchase");
});
test("earlier unsupported product and refunded purchase also consume eligibility",()=>{
  for(const prior of [{...payment,product:"multi_day_pass"},{...payment,status:"refunded" as const,refundedCents:5999}])
    assert.equal(evaluateCommission({...base,purchases:[payment,{...prior,id:"old",paidAt:"2026-09-01T00:00:00Z"}]}).reason,"not_first_purchase");
});
test("renewals and native purchases never qualify",()=>{
  assert.equal(evaluateCommission({...base,purchases:[{...payment,isRenewal:true}]}).reason,"not_first_purchase");
  assert.equal(evaluateCommission({...base,purchases:[{...payment,channel:"google"}]}).reason,"web_only");
});
test("refunds, partial refunds and disputes reverse the commission",()=>{
  for(const patch of [{status:"refunded" as const},{refundedCents:1},{status:"disputed" as const}])
    assert.equal(evaluateCommission({...base,purchases:[{...payment,...patch}]}).commission?.state,"reversed");
});
test("manual approval and suspension gate commission and payout",()=>{
  for(const status of ["pending","suspended"] as const)
    assert.equal(evaluateCommission({...base,partner:{...partner,status}}).reason,"partner_not_approved");
  assert.equal(previewPayout({...partner,status:"suspended"},[],[],base.now).readyForManualApproval,false);
});
test("self-referrals blocked by canonical identity or normalized email",()=>{
  assert.equal(evaluateCommission({...base,partner:{...partner,ownerUserId:"customer"}}).commission,null);
  assert.equal(evaluateCommission({...base,partner:{...partner,email:" HOST@EXAMPLE.INVALID "}}).commission,null);
});
test("incomplete history, conflicting snapshots and wrong mode fail closed",()=>{
  assert.equal(evaluateCommission({...base,historyComplete:false}).reason,"history_incomplete");
  assert.equal(evaluateCommission({...base,purchases:[payment,{...payment,subtotalCents:999}]}).reason,"conflicting_payment_snapshot");
  assert.equal(evaluateCommission({...base,mode:"live"}).reason,"payment_not_found");
});
test("identical replays do not generate an extra purchase",()=>{
  assert.deepEqual(evaluateCommission({...base,purchases:[payment,payment]}),evaluateCommission(base));
});
test("invalid money and dates cannot enter accounting",()=>{
  for(const subtotalCents of [NaN,Infinity,5.5,-1])
    assert.throws(()=>evaluateCommission({...base,purchases:[{...payment,subtotalCents}]}),/invalid_money/);
  assert.throws(()=>evaluateCommission({...base,now:"invalid"}),/invalid_timestamp/);
});
test("wrong product, currency, referral and predating the click are rejected",()=>{
  assert.equal(evaluateCommission({...base,purchases:[{...payment,product:"paper_suite"}]}).reason,"unsupported_product");
  assert.equal(evaluateCommission({...base,purchases:[{...payment,currency:"eur"}]}).reason,"unsupported_currency");
  assert.equal(evaluateCommission({...base,referral:{...referral,partnerId:"other"}}).reason,"invalid_referral");
  assert.equal(evaluateCommission({...base,referral:{...referral,attributedAt:"2026-10-03T00:00:00Z"}}).reason,"outside_attribution_window");
});
test("combined $50 threshold, idempotence and already-paid exclusion",()=>{
  const commission=evaluateCommission(base).commission!;
  const plus=Array.from({length:4},(_,i)=>({...commission,paymentId:`plus_${i}`}));
  const pass=Array.from({length:4},(_,i)=>({...commission,paymentId:`pass_${i}`,amountCents:50}));
  assert.equal(previewPayout(partner,plus,[],base.now).readyForManualApproval,false);
  const ready=previewPayout(partner,[...plus,...pass,pass[0]],[],base.now);
  assert.equal(ready.availableCents,5000);
  assert.equal(ready.paymentIds.length,8);
  assert.equal(ready.readyForManualApproval,true);
  assert.equal(previewPayout(partner,[...plus,...pass],["plus_0"],base.now).availableCents,3800);
  assert.equal(previewPayout(partner,[{...commission,state:"reversed"}],[],base.now).availableCents,0);
});
test("conflicting payout snapshots fail closed and sandbox commissions cannot enter live payouts",()=>{
  const c=evaluateCommission(base).commission!;
  assert.throws(()=>previewPayout(partner,[c,{...c,state:"reversed"}],[],base.now),/conflicting_commission_snapshot/);
  assert.equal(previewPayout(partner,[c],[],base.now,"live").availableCents,0);
});
