import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import LoginForm from "./LoginForm";

// /login — the account entry point §7 and §11 require.
//
// It sits in (marketing) rather than in the host shell on purpose: a
// person arriving here is not yet a signed-in host, and the host chrome
// (gathering switcher, gathering nav) has nothing to show them. The
// marketing header also gives them a way back out, which a bare login
// screen does not.
//
// noindex: a sign-in form has nothing to offer search, and indexing it
// competes with the pages that do.

export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to Place & Plenty on the web with the same account you use in the app.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <section className="bg-parchment py-16 md:py-24">
      <div className="mx-auto grid max-w-editorial gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
            Pick up where you left off.
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Same account as the app, same gatherings, same everything. Plan
            on a proper keyboard, then carry it in your pocket on the day.
          </p>
        </div>

        <LoginForm next={searchParams.next} />
      </div>
    </section>
  );
}
