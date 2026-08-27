import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms" },
  title: "Terms of Use",
  description: "Place & Plenty's Terms of Use.",
};

export default function TermsPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">Terms of Use</h1>
        <div className="mt-8 rounded-card border border-gold bg-cream p-6 font-body text-sm text-forest/80">
          <p className="font-semibold">
            [FINAL TERMS OF USE TO BE INSERTED BEFORE PUBLIC LAUNCH]
          </p>
          <p className="mt-2">
            This page is a placeholder and does not constitute legally
            reviewed terms. Do not publish this site publicly until final,
            attorney-reviewed copy replaces this text.
          </p>
        </div>
      </div>
    </section>
  );
}
