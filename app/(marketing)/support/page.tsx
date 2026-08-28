import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/support" },
  openGraph: { url: "/support" },
  title: "Support",
  description: "Get help with Place & Plenty — account, subscription, and technical support.",
};

const faqs = [
  {
    q: "How do I create my first gathering?",
    a: "Open Place & Plenty and start a new gathering — who's coming, when, and where. From there, Figure It Out For Me builds your preparation plan.",
  },
  {
    q: "What does HostReady™ actually measure?",
    a: "HostReady™ weighs what matters most for your specific gathering, what's already handled, how much time remains, and whether anything critical is still unresolved — not just a percentage of tasks checked off.",
  },
  {
    q: "Can I share a gathering with someone helping me host?",
    a: "Yes — Co-Host lets you share a gathering with the person helping make it happen.",
  },
  {
    q: "How do I manage my subscription?",
    a: "Gathering Passes and Place & Plenty Plus are bought through the App Store or Google Play, so they're managed in your Apple or Google account settings rather than in the app. Purchasing isn't switched on yet — when it is, that's where it will live. Current pricing is on our Terms page.",
  },
  {
    q: "How do I delete my account?",
    a: "In the app, go to Settings → Delete my account. If you no longer have it installed, you can request deletion by email — the Delete Account page below explains both routes and exactly what is removed.",
  },
  {
    q: "I'm having a technical issue with the app. What should I do?",
    a: "Contact us using the method below with details about what happened, your device type, and the app version, and we'll help you troubleshoot.",
  },
];

export default function SupportPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">Support</h1>
        <p className="mt-4 font-body text-lg text-forest/80">
          Have a question about Place &amp; Plenty? Reach us at{" "}
          <a
            href="mailto:support@placeandplenty.com"
            className="underline decoration-gold underline-offset-4"
          >
            support@placeandplenty.com
          </a>
          .
        </p>

        <h2 className="mt-12 font-display text-2xl text-forest">
          Frequently asked questions
        </h2>
        <dl className="mt-6 divide-y divide-sage/30">
          {faqs.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="font-body font-semibold text-forest">
                {item.q}
              </dt>
              <dd className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 rounded-card border border-sage/30 bg-cream p-6">
          <p className="font-body text-sm text-forest/80">
            Want to delete your account?{" "}
            <Link
              href="/delete-account"
              className="underline decoration-gold underline-offset-4"
            >
              See instructions here
            </Link>
            . Read our{" "}
            <Link href="/privacy" className="underline decoration-gold underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline decoration-gold underline-offset-4">
              Terms of Use
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
