import Image from "next/image";
import Link from "next/link";
import { Display, Band } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import hostingClosetVisual from "../homepage/product-hosting-closet.png";
import invitationsVisual from "../homepage/product-invitations.png";

const GUEST_FLOW: { name: string; icon: IconName }[] = [
  { name: "Invitations", icon: "envelope" },
  { name: "RSVPs", icon: "rsvp" },
  { name: "My People", icon: "people" },
  { name: "Who’s Bringing What", icon: "dish" },
  { name: "My Guest Book", icon: "book" },
];

const CLOSET_EXAMPLES = [
  "12 wine glasses",
  "2 serving platters",
  "Cloth napkins",
  "Large beverage dispenser",
];

export default function DifferenceBand() {
  return (
    <Band tone="sage">
      <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
        <Image
          src="/images/olive-mark.png"
          alt=""
          aria-hidden
          width={150}
          height={150}
          className="pointer-events-none absolute right-2 top-8 hidden h-auto w-20 object-contain opacity-15 lg:block"
        />

        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-forest/65">The Place & Plenty difference</p>
          <Display emphasis="real life" className="mt-4 text-3xl leading-tight text-forest md:text-[2.65rem]">The hosting platform built for real life.</Display>
          <p className="mt-5 font-body text-lg leading-relaxed text-forest/80">Place & Plenty brings the moving pieces of hosting together — your people, menu, shopping, contributions, what you already own, and what still needs doing — so you can focus on the gathering instead of the scramble.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-[68rem] gap-6 lg:grid-cols-2">
          <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft">
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image src={invitationsVisual} alt="Place & Plenty invitation and guest-management feature preview" fill className="object-cover" sizes="(min-width: 1024px) 34rem, 100vw" />
            </div>
            <div className="flex flex-1 flex-col p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-body text-[0.66rem] font-bold uppercase tracking-[0.18em] text-forest/60">Your people, connected</p>
                  <h3 className="mt-2 font-display text-[1.45rem] leading-snug text-forest">An invitation is the beginning, not the whole product.</h3>
                </div>
                <span className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-forest text-offwhite sm:inline-flex"><Icon name="people" size={21} /></span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {GUEST_FLOW.map((item, index) => (
                  <div key={item.name} className="contents">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-parchment px-3 py-1.5 font-body text-xs font-semibold text-forest"><Icon name={item.icon} size={14} className="text-goldInk" />{item.name}</span>
                    {index < GUEST_FLOW.length - 1 && <span aria-hidden className="font-body text-xs text-forest/35">→</span>}
                  </div>
                ))}
              </div>

              <p className="mt-6 font-body text-sm leading-relaxed text-forest/75">Invite them, know who is coming, keep track of what they are bringing, and save the people you host most for next time. No rebuilding the same guest list every time people come over.</p>
              <div className="mt-auto pt-6"><p className="border-l-2 border-gold pl-4 font-display text-lg italic leading-snug text-forest">Got your own invitations? Bring them over. Yeah, we handle that too.</p></div>
            </div>
          </article>

          <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-forest/15 bg-forest text-offwhite shadow-soft">
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image src={hostingClosetVisual} alt="Place & Plenty My Hosting Closet feature preview" fill className="object-cover" sizes="(min-width: 1024px) 34rem, 100vw" />
            </div>
            <div className="relative flex flex-1 flex-col p-6 md:p-7">
              <Image
                src="/images/olive-mark.png"
                alt=""
                aria-hidden
                width={140}
                height={140}
                className="pointer-events-none absolute right-3 top-3 h-auto w-16 object-contain opacity-10"
              />
              <div className="relative">
                <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-offwhite/10 text-gold"><Icon name="closet" size={20} /></span><p className="font-body text-[0.66rem] font-bold uppercase tracking-[0.18em] text-gold">My Hosting Closet</p></div>
                <Display emphasis="again" className="mt-4 text-[1.85rem] leading-tight text-offwhite">Stop buying things you already own again.</Display>
                <p className="mt-4 font-body text-sm leading-relaxed text-offwhite/80">Keep the serving pieces, linens, glasses, decor and hosting basics you already have in one place — then let your gathering plan start with what is already in your house.</p>
                <div className="mt-6 rounded-xl border border-offwhite/15 bg-offwhite/7 p-4">
                  <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-offwhite/60">Already in your Hosting Closet</p>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{CLOSET_EXAMPLES.map((item) => <li key={item} className="flex items-center gap-2 font-body text-xs text-offwhite/90"><Icon name="check" size={15} className="flex-shrink-0 text-gold" />{item}</li>)}</ul>
                </div>
              </div>
              <p className="relative mt-auto pt-6 font-display text-lg italic leading-snug text-gold">The smartest shopping list sometimes starts with: don’t buy it.</p>
            </div>
          </article>
        </div>

        <div className="mx-auto mt-8 flex max-w-[68rem] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl font-body text-sm leading-relaxed text-forest/70">HostReady™ can see the bigger picture too — what is decided, what is still open, and what deserves your attention next.</p>
          <Link href="/what-it-does" className="inline-flex flex-shrink-0 items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage">See what it does <span aria-hidden>→</span></Link>
        </div>
      </div>
    </Band>
  );
}
