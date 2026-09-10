import Image from "next/image";
import type { Checklist } from "@/lib/checklists";

/** Live type stays crisp at every size; each edition has its own illustrated scene. */
export default function ChecklistCover({ kit, priority = false }: { kit: Checklist; priority?: boolean }) {
  return (
    <div role="img" aria-label={`${kit.name} starter kit: a printable P&P checklist with an illustrated hosting scene`} className="relative isolate aspect-[3/2] w-full overflow-hidden bg-parchment" style={{ containerType: "inline-size" }}>
      <Image src={kit.image} alt="" fill sizes="(min-width: 1024px) 550px, (min-width: 768px) 50vw, 100vw" priority={priority} className="object-contain" />
      <div aria-hidden="true" className="absolute left-[5%] top-[7%] flex h-[86%] w-[47%] -rotate-2 flex-col border border-gold/60 bg-parchment p-[4%] text-forest shadow-lift">
        <p className="font-display" style={{ fontSize: "3.6cqw" }}>Place &amp; Plenty</p>
        <div className="my-[6%] h-px w-full shrink-0 bg-gold" />
        <p className="font-body uppercase tracking-wider" style={{ fontSize: "1.7cqw" }}>The Put-Together<br />Get-Together Starter Kit</p>
        <p className="mt-[6%] font-display leading-tight" style={{ fontSize: kit.slug === "before-the-doorbell" ? "4.4cqw" : "5cqw" }}>{kit.name}</p>
        <p className="mt-[2%] font-body uppercase tracking-widest" style={{ fontSize: "1.6cqw" }}>Edition</p>
        <ul className="mt-[8%] space-y-[5%] font-body leading-snug" style={{ fontSize: "1.8cqw" }}>
          {kit.sections.map(section => <li key={section.title} className="flex items-start gap-[4%]"><span className="mt-[2%] inline-block h-[1.4cqw] w-[1.4cqw] shrink-0 border border-gold" />{section.title}</li>)}
        </ul>
        <p className="mt-auto pt-[4%] font-body" style={{ fontSize: "1.5cqw" }}>Home Hosting. Made Simple.</p>
      </div>
    </div>
  );
}
