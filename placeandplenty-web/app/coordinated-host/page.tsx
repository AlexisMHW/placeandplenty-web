import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Coordinated Host",
  description:
    "Practical ideas for getting ready for people without doing more than you need to.",
};

export default function CoordinatedHostPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl text-forest">
          The Coordinated Host
        </h1>
        <p className="mt-4 font-body text-lg text-forest/80">
          Practical ideas for getting ready for people without doing more
          than you need to.
        </p>
        <div className="mt-10 rounded-card border border-sage/30 bg-cream p-6 font-body text-sm text-forest/70">
          <p>
            Articles are coming soon — including things like how much ice you
            need for a party, a Thanksgiving preparation timeline, and how to
            organize a potluck.
          </p>
        </div>
      </div>
    </section>
  );
}
