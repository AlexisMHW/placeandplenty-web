import type { Metadata } from "next";
import FoundingHostForm from "@/components/FoundingHostForm";

export const metadata: Metadata = {
  alternates: { canonical: "/founding-host" },
  openGraph: { url: "/founding-host" },
  title: "Become a Founding Host",
  description:
    "We're looking for a small group of real hosts to put Place & Plenty through real life before launch.",
};

export default function FoundingHostPage() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto grid max-w-editorial gap-12 px-6 md:grid-cols-2 md:items-start">
        <div>
          <h1 className="font-display text-4xl leading-tight text-forest md:text-5xl">
            Have people coming?
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            We&rsquo;re looking for a small group of real hosts to put Place
            &amp; Plenty through real life before launch.
          </p>
        </div>
        <FoundingHostForm />
      </div>
    </section>
  );
}
