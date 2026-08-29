import type { Metadata } from "next";
import Link from "next/link";
import SignUpForm from "./SignUpForm";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalBough } from "@/components/Botanical";
import { Display } from "@/components/Display";
import { WEB_ONLY_PROMISE, CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";
import { FREE_LIMITS_NOTE } from "@/lib/pricing";

// /signup — WEB ACCOUNT CREATION, a V1 requirement.
//
// This is the widest door into the product and the only conversion the
// website can complete end to end today. It sits in (marketing) rather
// than the host shell for the same reason /login does: someone here is
// not yet a host, and the host chrome has nothing to show them.
//
// noindex, follow: a sign-up form has nothing to offer search, and
// indexing it competes with the pages that explain why anyone would fill
// it in. The links out of it still carry weight.
//
// THE LEFT COLUMN IS NOT DECORATION. A person who has just clicked
// "Start Free" needs three questions answered before typing: what do I
// actually get for nothing, do I have to install anything, and am I
// buying the wrong version of this. In that order, which is the order
// below.

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free Place & Plenty account and plan your gathering in the browser. Same account in the app — nothing to download first.",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: true },
};

const REASSURANCE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "laptop",
    title: "Everything works in the browser",
    body: WEB_ONLY_PROMISE,
  },
  {
    icon: "check",
    title: "Free is genuinely useful",
    body: FREE_LIMITS_NOTE,
  },
  {
    icon: "phone",
    title: "One account, web and app",
    body: CROSS_PLATFORM_PROMISE,
  },
];

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <section className="relative isolate overflow-hidden bg-parchment py-16 md:py-24">
      <BotanicalBough
        className="pointer-events-none absolute -left-16 top-1/2 hidden -translate-y-1/2 text-olive/35 lg:block"
        width={230}
      />

      <div className="relative mx-auto grid max-w-editorial gap-12 px-6 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">
            Start free on the web
          </p>

          <Display
            as="h1"
            emphasis="are coming"
            className="mt-5 text-4xl leading-[1.08] text-forest md:text-5xl"
          >
            People are coming. Let’s get you ready.
          </Display>

          <span aria-hidden className="mt-7 block h-[2px] w-16 bg-gold" />

          <p className="mt-6 max-w-prose font-body text-base leading-relaxed text-forest/80">
            Create your account and plan your first gathering right here — the
            menu, the people, the shopping, who’s bringing what, and whether
            you’re actually ready.
          </p>

          <ul className="mt-10 space-y-7">
            {REASSURANCE.map((r) => (
              <li key={r.title} className="flex gap-4">
                <span className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest">
                  <Icon name={r.icon} size={20} />
                </span>
                <div>
                  <h2 className="font-display text-lg text-forest">
                    {r.title}
                  </h2>
                  <p className="mt-1.5 max-w-prose font-body text-sm leading-relaxed text-forest/70">
                    {r.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-10 font-body text-sm text-forest/70">
            Want to see what’s in each plan first?{" "}
            <Link
              href="/pricing"
              className="font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4"
            >
              Compare Free, a Gathering Pass and Plus
            </Link>
            .
          </p>
        </div>

        <SignUpForm next={searchParams.next} />
      </div>
    </section>
  );
}
