import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import Photo from "@/components/Photo";
import { Band, Display } from "@/components/Display";
import { IconPlate, type IconName } from "@/components/Icon";
import { FOUNDER_PHOTO } from "@/lib/founder";
import { ESSENCE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description:
    "I’m Alexis. I built Place & Plenty because I needed something that could help me manage everything between “people are coming” and the doorbell ringing.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  { icon: "heart", title: "People first", body: "The preparation serves the people. The people are the point." },
  { icon: "check", title: "Thoughtful planning", body: "The right plan makes everything feel easier, and more enjoyable." },
  { icon: "house", title: "Real life, real homes", body: "Not every home is perfect. That’s fine. What matters is how we make people feel in it." },
  { icon: "leaf", title: "Simple is powerful", body: "Clear tools and smart guidance, so there’s less chaos and you can be present." },
  { icon: "cohosts", title: "Better together", body: "Hosting is better when we support and inspire each other." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About the founder"
        headline="Hi, I’m Alexis."
        emphasisLine="The organised host behind Place & Plenty."
        image={FOUNDER_PHOTO.src}
        imageAlt={FOUNDER_PHOTO.alt}
        body={
          <>
            <p>I built Place &amp; Plenty to help you host with more ease and less stress — so you can focus on what matters most:</p>
            <p className="mt-3 font-display text-xl italic text-goldInk">the people at your table.</p>
          </>
        }
      />

      <Band tone="cream">
        <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Image
            src="/images/olive-mark.png"
            alt=""
            aria-hidden
            width={150}
            height={150}
            className="pointer-events-none absolute right-4 top-8 hidden h-auto w-20 object-contain opacity-14 lg:block"
          />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">My story</p>
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.2rem]">A lifelong love of people, planning, and the little details.</Display>
              <span aria-hidden className="mt-6 block h-[2px] w-14 bg-gold" />
            </div>
            <div className="max-w-prose space-y-5 font-body text-base leading-relaxed text-forest/80">
              <p>I have always been the one who brings people together. Family dinners, celebrations with friends, the ordinary Tuesday that turns into eleven people in my kitchen — I have loved making the kind of moment where everyone feels welcome and cared for.</p>
              <p>I also knew what it costs. My son’s 17th. My youngest son’s first birthday. My husband’s 40th. My own 39th. Granny’s 80th. Thanksgiving, Christmas, Valentine’s. Every one of them was worth it, and every one of them was too many lists, too many moving parts, and too many “did I forget” moments at eleven at night.</p>
              <p className="border-l-2 border-gold pl-5 font-display text-lg italic leading-relaxed text-forest">I didn’t need another place to make a pretty invitation. I needed something that could help me manage everything between “people are coming” and the doorbell ringing. So I built it.</p>
              <p>Place &amp; Plenty is that thing — a home hosting companion that keeps it all in one place, tells you where you actually stand, and gets out of the way so you can enjoy the gathering you spent all week on.</p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <p className="text-center font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">My approach</p>
          <Display className="mt-4 text-center text-3xl leading-tight text-forest md:text-[2.2rem]">Hosting with heart. Organised with intention.</Display>
          <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className={`px-4 text-center lg:px-5 ${i > 0 ? "lg:border-l lg:border-sage/25" : ""}`}>
                <IconPlate name={p.icon} className="mx-auto" />
                <h3 className="mt-5 font-display text-lg text-forest">{p.title}</h3>
                <p className="mx-auto mt-2.5 max-w-[15rem] font-body text-sm leading-relaxed text-forest/70">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="cream">
        <div className="grid items-stretch gap-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Photo
            src="/images/hero-tabletop.jpg"
            alt="A warm Place & Plenty tablescape at home"
            caption="A warm, lived-in table at home — the kind of gathering Place & Plenty was built around"
            tone="sage"
            className="aspect-[4/3] w-full md:aspect-auto md:min-h-[26rem]"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
          <div className="relative flex items-center px-6 py-14 md:px-12 md:py-16">
            <Image
              src="/images/olive-mark.png"
              alt=""
              aria-hidden
              width={150}
              height={150}
              className="pointer-events-none absolute right-7 top-7 hidden h-auto w-20 object-contain opacity-18 xl:block"
            />
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">Why I built this</p>
              <Display className="mt-4 max-w-lg text-2xl leading-tight text-forest md:text-[2rem]">I wanted hosting to feel less overwhelming — and more you.</Display>
              <span aria-hidden className="mt-6 block h-[2px] w-14 bg-gold" />
              <div className="mt-6 max-w-prose space-y-4 font-body text-base leading-relaxed text-forest/80">
                <p>You shouldn’t have to juggle a dozen apps, sticky notes and group texts just to get people together.</p>
                <p>Place &amp; Plenty brings it into one place — so you can plan with confidence, stay organised, and be in the room for the part you actually did it for.</p>
                <p className="font-display text-lg italic text-goldInk">I built it for you, because I needed it too.</p>
              </div>
              <p className="mt-8 font-body text-sm uppercase tracking-[0.18em] text-forest/60">{ESSENCE}</p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto flex max-w-editorial flex-col items-center gap-6 px-6 py-12 text-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-full">
            <Image src={FOUNDER_PHOTO.src} alt="" aria-hidden fill sizes="80px" className="object-cover object-top" />
          </div>
          <p className="max-w-xl font-display text-xl italic leading-relaxed text-forest">Let’s make hosting simple — and unforgettable.</p>
          <p className="font-body text-sm uppercase tracking-[0.22em] text-forest/60">Alexis · Founder</p>
        </div>
      </Band>

      <CtaBand headline="Ready to host with more ease" emphasisLine="and less stress?" body="Create your account and start planning in the browser. It’s free to begin, and it’s the same account you’ll use in the app." />
    </>
  );
}
