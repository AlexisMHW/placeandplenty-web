import GuestListForm from "@/components/GuestListForm";
import Eyebrow from "@/components/Eyebrow";
import { BotanicalSprig } from "@/components/Botanical";

// The guest-list band. Forest, as on the approved board, so the page ends
// on the brand rather than fading out on another cream section.
//
// The id is load-bearing: pre-launch CTAs across the site point at
// "#guest-list" (see lib/launch-state.ts), so this anchor is the
// destination of nearly every primary button on the marketing site.

export default function CtaSection() {
  return (
    <section id="guest-list" className="bg-forest py-20 text-offwhite md:py-24">
      <div className="mx-auto grid max-w-editorial gap-10 px-6 md:grid-cols-2 md:items-center md:gap-14">
        <div className="relative">
          <BotanicalSprig
            className="absolute -left-14 -top-6 hidden text-gold/35 lg:block"
            size={64}
          />
          <Eyebrow tone="dark">Join the Guest List</Eyebrow>
          <h2 className="mt-4 font-display text-3xl leading-tight md:text-4xl">
            Let&rsquo;s take the guesswork out of guest work.
          </h2>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
            Helpful hosting ideas, checklists and inspiration — and first word
            when Place &amp; Plenty is ready for you.
          </p>
        </div>
        <GuestListForm />
      </div>
    </section>
  );
}
