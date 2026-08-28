import Eyebrow from "@/components/Eyebrow";
import {
  PRICING_TIERS,
  PLUS_LIMITS_NOTE,
  FREE_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
  PURCHASE_AVAILABILITY_NOTE,
} from "@/lib/pricing";

// Every price rendered here comes from lib/pricing.ts as a pre-assembled
// `priceLine`, never as an amount this component formats itself. That is
// what keeps "+ applicable taxes and fees" attached to the number: a
// surface cannot drop the qualifier without deliberately taking the
// string apart.
//
// No buttons. Purchasing is not live — the app has no monetization client
// yet — so a "Choose Plus" control here would be a promise the product
// cannot keep, and §8's rule about not claiming things are live applies
// to commerce as much as to communications.

export default function PricingSection({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  return (
    <section id="pricing" className="bg-offwhite py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        {showHeading ? (
          <>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
              Choose how you gather.
            </h2>
          </>
        ) : (
          // The tier names are h3. Without an h2 above them the document
          // outline jumps h1 -> h3, which is how a screen-reader user
          // loses the structure. /pricing supplies its own visible
          // heading, so this one is for the outline only.
          <h2 className="sr-only">Plans</h2>
        )}

        <p className="mt-4 max-w-prose font-body text-base text-forest/70">
          {PURCHASE_AVAILABILITY_NOTE}
        </p>

        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <li
              key={tier.name}
              className={`flex flex-col rounded-card border p-8 shadow-softer ${
                tier.highlight
                  ? "border-gold bg-forest text-offwhite"
                  : "border-sage/30 bg-cream text-forest"
              }`}
            >
              <h3 className="font-display text-xl">{tier.name}</h3>

              <p
                className={`mt-4 font-display text-3xl ${
                  tier.highlight ? "text-offwhite" : "text-forest"
                }`}
              >
                {tier.price}
                {tier.billing && (
                  <span
                    className={`ml-1 font-body text-base font-normal ${
                      tier.highlight ? "text-offwhite/70" : "text-forest/60"
                    }`}
                  >
                    {tier.billing}
                  </span>
                )}
              </p>

              {/* The qualifier, always, on every paid tier. Free has no
                  tax line because there is nothing to tax. */}
              {tier.price !== "$0" && (
                <p
                  className={`mt-1.5 font-body text-sm ${
                    tier.highlight ? "text-offwhite/70" : "text-forest/65"
                  }`}
                >
                  + applicable taxes and fees
                </p>
              )}

              <p
                className={`mt-4 font-body text-sm leading-relaxed ${
                  tier.highlight ? "text-offwhite/80" : "text-forest/75"
                }`}
              >
                {tier.description}
              </p>

              <ul className="mt-5 space-y-2">
                {tier.includes.map((item) => (
                  <li
                    key={item}
                    className={`flex gap-2.5 font-body text-sm leading-relaxed ${
                      tier.highlight ? "text-offwhite/85" : "text-forest/80"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-2 h-1 w-1 flex-shrink-0 rounded-full ${
                        tier.highlight ? "bg-gold" : "bg-goldInk"
                      }`}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {/* §17 entitlement truth for all three tiers, not just Plus.
            Free being bounded is the fact most likely to surprise
            someone, so it is stated as plainly as the other two. */}
        <div className="mt-8 max-w-prose space-y-2 font-body text-sm leading-relaxed text-forest/70">
          <p>{FREE_LIMITS_NOTE}</p>
          <p>{PASS_LIMITS_NOTE}</p>
          <p>{PLUS_LIMITS_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
