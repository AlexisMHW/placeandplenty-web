import { PRICING_TIERS } from "@/lib/pricing";

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <h2 className="font-display text-4xl text-forest md:text-5xl">
          Choose how you gather.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-card border p-8 shadow-softer ${
                tier.highlight
                  ? "border-gold bg-forest text-offwhite"
                  : "border-sage/30 bg-cream text-forest"
              }`}
            >
              <h3 className="font-display text-xl">{tier.name}</h3>
              <p className="mt-4 font-display text-4xl">
                {tier.price}
                <span
                  className={`ml-1 font-body text-sm font-normal ${
                    tier.highlight ? "text-offwhite/70" : "text-forest/60"
                  }`}
                >
                  {tier.billing}
                </span>
              </p>
              <p
                className={`mt-4 font-body text-sm leading-relaxed ${
                  tier.highlight ? "text-offwhite/80" : "text-forest/70"
                }`}
              >
                {tier.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
