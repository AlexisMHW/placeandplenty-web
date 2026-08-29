"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { WebProduct } from "@/lib/checkout";

// THE CHECKOUT PANEL. Four states, and which one shows is decided by
// facts rather than by a flag:
//
//   NOT SIGNED IN     a purchase attaches to an account, so there has to
//                     be one first. Both routes come back here.
//   ALREADY OWNED     the account already holds live Plus. Selling it
//                     again is the duplicate purchase the governing rule
//                     forbids, and only the account can catch it —
//                     Apple and Google cannot see a web checkout and it
//                     cannot see theirs.
//   NEEDS A GATHERING a Pass is bound to one. The database enforces it
//                     (`purchase_intents_pass_requires_gathering`), so
//                     this is the constraint surfaced, not a nicety.
//   READY             everything is known. Either hand off to the
//                     processor, or — while none is configured — say so
//                     plainly.
//
// NO DISABLED BUTTON THAT LOOKS LIVE. §17 and §32 forbid implying a
// purchase can be made before one can. When no processor is configured
// the panel states the timing and offers the thing that DOES work today,
// rather than rendering a greyed-out "Pay now" that teaches people the
// site is broken.

interface GatheringOption {
  id: string;
  name: string;
  date: string;
}

export default function CheckoutAction({
  product,
  signedIn,
  email,
  alreadyHasPlus,
  checkoutConfigured,
  pendingNote,
  gatherings,
}: {
  product: WebProduct;
  signedIn: boolean;
  email: string | null;
  alreadyHasPlus: boolean;
  checkoutConfigured: boolean;
  pendingNote: string;
  gatherings: GatheringOption[];
}) {
  const [gatheringId, setGatheringId] = useState(gatherings[0]?.id ?? "");
  const returnTo = `/checkout/${product.slug}`;

  const panel =
    "rounded-2xl border border-sage/30 bg-offwhite p-7 shadow-softer";

  /* ---- not signed in --------------------------------------------- */
  if (!signedIn) {
    return (
      <div className={panel}>
        <h2 className="font-display text-xl text-forest">
          First, an account to put it on
        </h2>
        <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">
          {product.name} attaches to your Place &amp; Plenty account, which is
          what carries it to your phone and back. Creating one is free and
          takes a minute.
        </p>

        <Link
          href={`/signup?next=${encodeURIComponent(returnTo)}`}
          className="mt-6 block w-full rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          Create a free account
        </Link>

        <Link
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          className="mt-3 block w-full rounded-lg border border-forest/30 px-5 py-3 text-center font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
        >
          I already have one
        </Link>

        <p className="mt-5 font-body text-xs leading-relaxed text-forest/60">
          Already bought this in the app? Log in — it is already on your
          account and there is nothing to buy again.
        </p>
      </div>
    );
  }

  /* ---- already owned --------------------------------------------- */
  if (alreadyHasPlus) {
    return (
      <div className={panel}>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream text-forest">
          <Icon name="check" size={22} />
        </span>
        <h2 className="mt-4 font-display text-xl text-forest">
          You already have Plus.
        </h2>
        <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">
          It is live on this account, whichever way you bought it. There is
          nothing to buy again here — and buying it twice is exactly what this
          check exists to prevent.
        </p>
        <Link
          href="/host/account"
          className="mt-6 block w-full rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          See your plan
        </Link>
      </div>
    );
  }

  /* ---- a Pass with nowhere to go --------------------------------- */
  if (product.requiresGathering && gatherings.length === 0) {
    return (
      <div className={panel}>
        <h2 className="font-display text-xl text-forest">
          A Pass needs a gathering
        </h2>
        <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">
          A Gathering Pass unlocks one gathering and stays with it, so there
          has to be a gathering to attach it to. Create one first — that is
          free — and come back.
        </p>
        <Link
          href="/host"
          className="mt-6 block w-full rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          Go to My Gatherings
        </Link>
      </div>
    );
  }

  /* ---- ready ------------------------------------------------------ */
  return (
    <div className={panel}>
      <h2 className="font-display text-xl text-forest">
        {product.name}
      </h2>
      <p className="mt-1.5 font-display text-lg text-forest/85">
        {product.priceLine}
      </p>

      {email && (
        <p className="mt-4 rounded-lg bg-cream px-4 py-3 font-body text-sm text-forest/80">
          Going on <strong className="font-semibold text-forest">{email}</strong>
        </p>
      )}

      {product.requiresGathering && (
        <div className="mt-5">
          <label
            htmlFor="checkout-gathering"
            className="block font-body text-sm font-semibold text-forest"
          >
            Which gathering?
          </label>
          <p className="mt-1 font-body text-xs leading-relaxed text-forest/65">
            A Pass is bound to the gathering you choose and stays with it.
          </p>
          <select
            id="checkout-gathering"
            value={gatheringId}
            onChange={(e) => setGatheringId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-sage/40 bg-parchment px-3.5 py-2.5 font-body text-base text-forest"
          >
            {gatherings.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {checkoutConfigured ? (
        // The processor hand-off. The route it posts to creates the
        // intent server-side and redirects; nothing about a payment is
        // decided in this component.
        <form action="/api/checkout" method="post" className="mt-6">
          <input type="hidden" name="product" value={product.slug} />
          {product.requiresGathering && (
            <input type="hidden" name="gatheringId" value={gatheringId} />
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-forest px-5 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Continue to payment
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-lg border border-gold/50 bg-cream px-5 py-4">
          <p className="font-body text-sm leading-relaxed text-forest/80">
            {pendingNote}
          </p>
          <Link
            href="/host"
            className="mt-4 block w-full rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Keep planning for free
          </Link>
        </div>
      )}

      <p className="mt-5 font-body text-xs leading-relaxed text-forest/60">
        Prices are shown with applicable taxes and fees called out. Nothing is
        charged until you confirm.
      </p>
    </div>
  );
}
