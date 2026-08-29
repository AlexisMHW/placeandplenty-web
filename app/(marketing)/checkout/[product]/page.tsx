import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { BotanicalBough } from "@/components/Botanical";
import { Display } from "@/components/Display";
import {
  WEB_PRODUCTS,
  findWebProduct,
  isCheckoutConfigured,
  CHECKOUT_PENDING_NOTE,
  CHECKOUT_ASSURANCE,
} from "@/lib/checkout";
import {
  CROSS_PLATFORM_PROMISE,
  FEATURE_AVAILABILITY_NOTE,
} from "@/lib/entitlements";
import { getMyEntitlementState } from "@/lib/entitlement-data";
import { getUser } from "@/lib/supabase-server";
import { getMyGatherings } from "@/lib/host-data";
import { PLUS_LIMITS_NOTE, PASS_LIMITS_NOTE } from "@/lib/pricing";
import CheckoutAction from "./CheckoutAction";

// /checkout/[product] — BUYING ON THE WEB.
//
// The founder's V1 requirement is that a Gathering Pass and Plus can be
// bought here, and that what you get is the same canonical entitlement a
// store purchase produces. This page is the website's whole half of
// that, and it does four things in order:
//
//   1. IDENTIFIES THE BUYER. A purchase attaches to an account, so an
//      anonymous visitor is sent to sign up or log in first and comes
//      straight back. Buying before there is an account to attach it to
//      is the one way to create an orphaned purchase.
//
//   2. CHECKS WHAT THEY ALREADY OWN, against the canonical rows. Someone
//      who bought Plus on their phone must not be sold it again on the
//      web — that is precisely the duplicate purchase the governing rule
//      forbids, and it is a real risk because the two channels cannot
//      see each other's checkouts. The account can, so the account is
//      what is asked.
//
//   3. BINDS A PASS TO A GATHERING. `purchase_intents` has a CHECK
//      constraint —`purchase_intents_pass_requires_gathering` — so a
//      Pass literally cannot be created without one. The picker is not a
//      convenience; it is the database's requirement surfaced honestly.
//
//   4. HANDS OFF TO THE PROCESSOR. Or, while none is configured, says so
//      as a matter of timing rather than pretending a button works.
//
// WHY NO ROW IS WRITTEN FROM HERE. `purchase_intents` and
// `gathering_entitlements` are SELECT-only for signed-in users — there
// is no INSERT policy on either, deliberately. Entitlements are minted
// server-side by a trusted process after a payment is verified. This
// page therefore never writes; it prepares. See WEB-PURCHASE-HANDOFF.md
// for the Edge Function that does the writing and what it needs.

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return WEB_PRODUCTS.map((p) => ({ product: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { product: string };
}): Metadata {
  const product = findWebProduct(params.product);
  if (!product) return { title: "Checkout" };

  return {
    title: `Get ${product.name}`,
    description: `${product.name} — ${product.priceLine}. Buy it on the web and use it on the web and in the app.`,
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: { product: string };
}) {
  const product = findWebProduct(params.product);
  if (!product) notFound();

  const user = await getUser();
  const state = user ? await getMyEntitlementState() : null;

  // A Pass has to name its gathering before an intent can exist.
  const gatherings =
    user && product.requiresGathering
      ? (await getMyGatherings()).filter((g) =>
          ["draft", "active", "hosting"].includes(g.status)
        )
      : [];

  const alreadyHasPlus =
    product.canonicalProductId === "plus_annual" && Boolean(state?.plus);

  return (
    <section className="relative isolate overflow-hidden bg-parchment py-16 md:py-20">
      <BotanicalBough
        className="pointer-events-none absolute -left-16 top-1/2 hidden -translate-y-1/2 text-olive/30 lg:block"
        width={220}
      />

      <div className="relative mx-auto grid max-w-editorial gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        {/* ---- what you are buying --------------------------------- */}
        <div>
          <Link
            href="/pricing"
            className="font-body text-sm text-forest/70 underline decoration-gold underline-offset-4 transition-colors duration-400 hover:text-forest"
          >
            <span aria-hidden>&larr;</span> All plans
          </Link>

          <p className="mt-8 font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">
            Buy on the web
          </p>

          <Display
            as="h1"
            className="mt-4 text-4xl leading-[1.1] text-forest md:text-5xl"
          >
            {product.name}
          </Display>

          <p className="mt-4 font-display text-2xl text-forest">
            {product.priceLine}
          </p>

          <span aria-hidden className="mt-6 block h-[2px] w-16 bg-gold" />

          <p className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/80">
            {product.description}
          </p>

          <p className="mt-4 max-w-prose font-body text-sm leading-relaxed text-forest/70">
            {product.canonicalProductId === "plus_annual"
              ? PLUS_LIMITS_NOTE
              : PASS_LIMITS_NOTE}
          </p>

          <div className="mt-10 rounded-2xl border border-sage/30 bg-cream p-6">
            <div className="flex items-start gap-3">
              <Icon
                name="check"
                size={22}
                className="mt-0.5 flex-shrink-0 text-forest/70"
              />
              <div>
                <h2 className="font-display text-lg text-forest">
                  It belongs to your account, not to this browser
                </h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/75">
                  {CROSS_PLATFORM_PROMISE}
                </p>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">
                  {CHECKOUT_ASSURANCE}
                </p>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">
                  {FEATURE_AVAILABILITY_NOTE}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ---- the action ------------------------------------------ */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <CheckoutAction
            product={product}
            signedIn={Boolean(user)}
            email={user?.email ?? null}
            alreadyHasPlus={alreadyHasPlus}
            checkoutConfigured={isCheckoutConfigured()}
            pendingNote={CHECKOUT_PENDING_NOTE}
            gatherings={gatherings.map((g) => ({
              id: g.id,
              name: g.name,
              date: g.gathering_date,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
