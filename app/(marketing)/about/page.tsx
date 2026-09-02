import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import Photo from "@/components/Photo";
import { Band, Display } from "@/components/Display";
import { FOUNDER_PHOTO } from "@/lib/founder";

export const metadata: Metadata = {
  title: "About",
  description:
    "I’m Alexis. I built Place & Plenty because I needed something that could help me manage everything between “people are coming” and the doorbell ringing.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Place & Plenty"
        headline="Made for real hosts."
        emphasisLine="With real lives."
        image={FOUNDER_PHOTO.src}
        imageAlt={FOUNDER_PHOTO.alt}
        body={
          <>
            <p className="font-display text-xl leading-relaxed text-forest">
              I’m Alexis — the organized-ish host behind Place &amp; Plenty.
            </p>
            <p className="mt-3">
              I built the thing I kept wishing existed: one place for everything between “people are coming” and the doorbell ringing.
            </p>
          </>
        }
      />

      <Band tone="cream">
        <div className="mx-auto grid max-w-editorial gap-10 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">The real-life part</p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.35rem]">
              I love bringing people together. I just got tired of holding the whole plan in my head.
            </Display>
            <span aria-hidden className="mt-6 block h-[2px] w-14 bg-gold" />
          </div>

          <div className="max-w-prose space-y-5 font-body text-base leading-relaxed text-forest/80">
            <p>
              Family dinners, birthdays, holidays, the gathering that starts small and somehow ends with eleven people in the kitchen — I have always loved creating the kind of moment where people feel welcome and cared for.
            </p>
            <p>
              But the part before everyone arrived was another story. My son’s 17th. My youngest son’s first birthday. My husband’s 40th. My own 39th. Granny’s 80th. Thanksgiving, Christmas, Valentine’s. Too many lists. Too many tabs. Too many group texts. Too many “did I forget something?” moments at eleven at night.
            </p>
            <p className="border-l-2 border-gold pl-5 font-display text-xl italic leading-relaxed text-forest">
              I didn’t need another place to make a pretty invitation. I needed help getting the whole house, plan and people ready.
            </p>
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16">
          <Photo
            src="/images/hero-tabletop.jpg"
            alt="A warm Place & Plenty tablescape at home"
            caption="The kind of real, lived-in gathering Place & Plenty was built around"
            tone="sage"
            className="aspect-[4/3] w-full"
            sizes="(min-width: 1024px) 54vw, 100vw"
          />

          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">Why I built this</p>
            <Display className="mt-4 text-3xl leading-[1.12] text-forest md:text-[2.55rem]">
              I built Place &amp; Plenty for you because I needed it too.
            </Display>
            <span aria-hidden className="mt-6 block h-[2px] w-14 bg-gold" />
            <div className="mt-6 max-w-prose space-y-4 font-body text-base leading-relaxed text-forest/80">
              <p>
                I wanted one connected place to keep the menu, guest list, shopping, what I already owned, contributions, readiness and the hundred little details that make hosting feel bigger than it should.
              </p>
              <p>
                Not because the planning is the point. It isn’t. The preparation serves the people. The people are the point.
              </p>
              <p>
                Place &amp; Plenty exists so the work before the gathering can feel clearer, calmer and more manageable — and so you can actually be there when your people walk through the door.
              </p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="forest">
        <div className="mx-auto max-w-editorial px-6 py-16 text-center md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-offwhite/65">What I believe</p>
          <p className="mx-auto mt-5 max-w-3xl font-display text-3xl leading-tight text-offwhite md:text-[2.6rem]">
            A good plan should make more room for the people — not become the whole experience.
          </p>
          <p className="mx-auto mt-6 max-w-2xl font-body text-base leading-relaxed text-offwhite/78">
            Home hosting does not need to look perfect to feel thoughtful. Real homes, real budgets, real families and real life belong here.
          </p>
        </div>
      </Band>

      <CtaBand
        headline="Less scrambling."
        emphasisLine="More gathering."
        body="Create your account and start planning in the browser. It’s free to begin, and it’s the same account you’ll use in the app."
      />
    </>
  );
}
