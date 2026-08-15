import GuestListForm from "@/components/GuestListForm";

export default function CtaSection() {
  return (
    <section id="guest-list" className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto grid max-w-editorial gap-12 px-6 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="font-display text-4xl leading-tight text-forest md:text-5xl">
            Join the Guest List
          </h2>
          <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Let&rsquo;s take the guesswork out of guest work. Be the first to
            know when Place &amp; Plenty is ready for you.
          </p>
        </div>
        <GuestListForm />
      </div>
    </section>
  );
}
