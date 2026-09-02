import Link from "next/link";
import Icon from "@/components/Icon";
import { Panel } from "@/components/host/Workspace";
import { getMyEntitlements } from "@/lib/entitlement-data";
import {
  summarise,
  channelLabel,
  billingHomeFor,
  isLive,
  CROSS_PLATFORM_PROMISE,
  FEATURE_AVAILABILITY_NOTE,
} from "@/lib/entitlements";
import {
  FREE_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
  PLUS_LIMITS_NOTE,
  PURCHASE_AVAILABILITY_NOTE,
} from "@/lib/pricing";

// Account billing is a read of canonical gathering_entitlements, never a
// website-side plan cache. Free is the absence of a live paid entitlement.
// Purchase channel is provenance only; access follows the account everywhere.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PlanPanel() {
  const entitlements = await getMyEntitlements();
  const state = summarise(entitlements);
  const live = entitlements.filter((e) => isLive(e));
  const free = state.tier === "Free";

  return (
    <Panel className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-forest">Your plan</h3>
          <p className="mt-1.5 font-body text-sm text-forest/65">
            Whatever you own, wherever you bought it.
          </p>
        </div>
        <span className="rounded-full bg-forest px-4 py-1.5 font-body text-xs font-bold uppercase tracking-[0.16em] text-offwhite">
          {state.tier}
        </span>
      </div>

      {free ? (
        <div className="mt-6">
          <p className="max-w-prose font-body text-base leading-relaxed text-forest/80">
            {FREE_LIMITS_NOTE}
          </p>
          <p className="mt-3 max-w-prose font-body text-sm leading-relaxed text-forest/65">
            {PURCHASE_AVAILABILITY_NOTE}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/get"
              className="rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
            >
              Get the app to unlock
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-forest/30 px-5 py-3 text-center font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
            >
              Compare plans
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-sage/20">
          {live.map((e) => {
            const channel = e.provider || e.source || "";
            const isPlus = e.entitlement_type === "plus";
            return (
              <li key={e.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-display text-lg text-forest">
                    {isPlus ? "Place & Plenty Plus" : "Gathering Pass"}
                  </p>
                  <p className="font-body text-xs uppercase tracking-[0.14em] text-forest/60">
                    {e.scope === "account" ? "Whole account" : "One gathering"}
                  </p>
                </div>

                <p className="mt-1.5 font-body text-sm text-forest/70">
                  Bought {formatDate(e.purchased_at)}
                  {channel ? ` through ${channelLabel(channel)}` : ""}
                  {e.expires_at ? ` · renews ${formatDate(e.expires_at)}` : ""}
                </p>

                <p className="mt-2 max-w-3xl font-body text-sm leading-relaxed text-forest/70">
                  {isPlus ? PLUS_LIMITS_NOTE : PASS_LIMITS_NOTE}
                </p>

                <p className="mt-2 max-w-prose font-body text-sm leading-relaxed text-forest/65">
                  {billingHomeFor(channel)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-cream px-5 py-4">
        <Icon
          name="check"
          size={19}
          className="mt-0.5 flex-shrink-0 text-forest/70"
        />
        <p className="font-body text-sm leading-relaxed text-forest/75">
          {CROSS_PLATFORM_PROMISE}
        </p>
      </div>

      <p className="mt-3 font-body text-xs leading-relaxed text-forest/60">
        {FEATURE_AVAILABILITY_NOTE}
      </p>

      {!free && (
        <p className="mt-4 font-body text-sm text-forest/65">
          <Link
            href="/pricing"
            className="underline decoration-gold decoration-2 underline-offset-4 hover:text-forest"
          >
            Compare the plans
          </Link>
        </p>
      )}
    </Panel>
  );
}
