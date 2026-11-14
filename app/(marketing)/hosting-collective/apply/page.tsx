import type { Metadata } from "next";
import CreatorApplicationForm from "@/components/CreatorApplicationForm";

export const metadata: Metadata = {
  title: "Apply to the Hosting Collective",
  robots: { index: false, follow: false },
  alternates: { canonical: "/hosting-collective/apply" },
};

export default function ApplyPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl leading-tight text-forest">Apply to the Hosting Collective</h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">Tell us about the hosting you share. Applying does not guarantee a place, and there is no cost to apply.</p>
        <div className="mt-8"><CreatorApplicationForm /></div>
      </div>
    </section>
  );
}
