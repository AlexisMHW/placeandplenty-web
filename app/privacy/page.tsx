import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy" },
  title: "Privacy Policy",
  description: "Place & Plenty's Privacy Policy.",
};

export default function PrivacyPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">Privacy Policy</h1>
        <div className="mt-8 rounded-card border border-gold bg-cream p-6 font-body text-sm text-forest/80">
          <p className="font-semibold">
            [FINAL PRIVACY POLICY TO BE INSERTED BEFORE PUBLIC LAUNCH]
          </p>
          <p className="mt-2">
            This page is a placeholder and does not constitute a legally
            reviewed privacy policy. Do not publish this site publicly until
            final, attorney-reviewed copy replaces this text.
          </p>
        </div>
      </div>
    </section>
  );
}
