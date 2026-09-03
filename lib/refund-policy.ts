export const REFUND_POLICY = {
  gatheringPass: {
    short:
      "Gathering Pass purchases are for one specific gathering. Once that gathering is completed and the Pass is locked to it, the purchase is non-refundable and non-transferable, except where required by law or the payment platform.",
    full:
      "A Gathering Pass is purchased for one specific gathering. Once the create-gathering flow is completed and the Pass is applied or locked to that gathering, the purchase is non-refundable and non-transferable, except where required by applicable law or the rules of the payment platform through which it was purchased.",
  },
  plus: {
    short:
      "Plus renews annually until cancelled. Cancelling stops the next renewal; it does not automatically refund the current paid term.",
    full:
      "Place & Plenty Plus is an annual subscription that renews automatically until cancelled. Cancelling Plus stops the next renewal. It does not automatically refund or end the current paid term, and access ordinarily continues through the end of that term unless a refund is actually issued or access is otherwise required to end by law or the payment platform.",
  },
  initialPlusRefund:
    "For a first-time Plus purchase made directly on placeandplenty.com, you may request a discretionary refund within 7 days of purchase if fewer than 3 gatherings have been locked in during that subscription term. Once 3 or more gatherings have been locked in, the voluntary refund window is closed. This does not limit refunds required by law, duplicate-charge corrections, confirmed billing errors, fraud corrections, or rights provided by the payment platform.",
  renewals:
    "Renewal charges are generally non-refundable once a new annual term begins, except where required by law, where the payment platform provides otherwise, or where Place & Plenty confirms a duplicate charge or billing error.",
  stores:
    "Purchases made through the Apple App Store or Google Play are billed and refunded through that store under its rules. Place & Plenty does not issue store refunds directly; when a store reports that a refund has been completed, Place & Plenty updates access to match that verified payment state.",
  web:
    "Purchases made directly on placeandplenty.com are billed through our web payment provider. Refund requests for those purchases are reviewed by Place & Plenty Support under this policy. Place & Plenty does not automatically issue a refund merely because a subscription is cancelled.",
  errors:
    "Duplicate charges, confirmed billing errors, fraud, and similar payment mistakes may be corrected regardless of the ordinary voluntary-refund limits.",
  law:
    "Nothing in this policy limits any non-waivable right you have under applicable law.",
} as const;

export const REFUND_POLICY_SUMMARY =
  "Gathering Passes become non-refundable and non-transferable once locked to a gathering. Plus renews annually until cancelled; cancellation stops the next renewal but does not automatically refund the current term. First-time web Plus purchases may be eligible for a discretionary refund within 7 days if fewer than 3 gatherings have been locked in. Store purchases follow Apple or Google refund rules. Legal rights and genuine billing-error corrections are unaffected.";
