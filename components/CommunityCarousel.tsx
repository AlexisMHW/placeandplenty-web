"use client";

import { useId, useRef, type ReactNode } from "react";

/** Selected editorial stories only. No automatic ingestion or publishing. */
export default function CommunityCarousel({ children }: { children: ReactNode }) {
  const rail = useRef<HTMLUListElement>(null);
  const id = useId();
  function move(direction: number) {
    const element = rail.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * .85, behavior: reducedMotion ? "auto" : "smooth" });
  }
  return <div role="region" aria-label="Featured community gatherings" aria-roledescription="carousel" className="mt-8">
    <div className="mb-4 flex items-center justify-between gap-4"><p className="font-body text-sm text-forest/75">Real gatherings, featured with permission.</p><div className="flex gap-2"><button type="button" aria-label="Previous gatherings" aria-controls={id} onClick={() => move(-1)} className="h-11 w-11 rounded-full border border-forest/40 text-xl text-forest">←</button><button type="button" aria-label="Next gatherings" aria-controls={id} onClick={() => move(1)} className="h-11 w-11 rounded-full border border-forest/40 text-xl text-forest">→</button></div></div>
    <ul ref={rail} id={id} tabIndex={0} aria-label="Selected gatherings; scroll to explore" className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 [&>li]:w-[85%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[45%] lg:[&>li]:w-[30%]">{children}</ul>
  </div>;
}
