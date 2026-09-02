import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";

const sections: Array<{
  heading: string;
  items: Array<{ label: string; body: string; href?: string; icon: IconName; appOnly?: boolean }>;
}> = [
  {
    heading: "Food & the table",
    items: [
      { label: "My Table", body: "Menu, dishes and serving plans for this gathering.", href: "table", icon: "table" },
      { label: "My Shopping", body: "Your list and budget, together where they belong.", href: "shopping", icon: "cart" },
      { label: "My Hosting Closet", body: "See what you already own before you buy another thing.", href: "/host/closet", icon: "closet" },
    ],
  },
  {
    heading: "Your people",
    items: [
      { label: "My People", body: "Guests, RSVPs and the people coming to this gathering.", href: "people", icon: "people" },
      { label: "Who’s Bringing What", body: "Keep contributions clear without chasing people down.", href: "contributions", icon: "gift" },
      { label: "My Co-Hosts", body: "The people helping you plan and host this one.", href: "co-hosts", icon: "cohosts" },
    ],
  },
  {
    heading: "The look & the day",
    items: [
      { label: "Space Mode", body: "Use your phone camera to get room-specific setup ideas.", icon: "house", appOnly: true },
      { label: "Find Help", body: "Find the extra hands or services this gathering needs.", href: "find-help", icon: "search" },
      { label: "My Style Board", body: "Keep the visual direction for the gathering in one place.", href: "style", icon: "board" },
      { label: "My Music & Media", body: "Build the soundtrack and collect guest song requests.", href: "music", icon: "music" },
      { label: "Host Mode", body: "Gathering-day readiness lives on your phone, where you need it.", icon: "check", appOnly: true },
      { label: "My Gathering Photos", body: "See the photos shared from this gathering.", href: "photos", icon: "photo" },
    ],
  },
];

export default function HostingHubPage({ params }: { params: { id: string } }) {
  const base = `/host/g/${params.id}`;

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl border border-sage/25 bg-cream px-6 py-8 shadow-soft md:px-9 md:py-10">
        <BotanicalSprig className="pointer-events-none absolute -right-5 -top-5 text-olive/25" size={150} />
        <p className="relative font-body text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-forest/55">
          Your gathering plan
        </p>
        <div className="relative mt-3 h-0.5 w-12 bg-gold" />
        <h2 className="relative mt-4 max-w-3xl font-display text-3xl leading-tight text-forest md:text-4xl">
          My Hosting Hub
        </h2>
        <p className="relative mt-3 max-w-2xl font-body text-base leading-relaxed text-forest/70">
          Everything you need to get ready for people, organized around this gathering.
        </p>
      </section>

      <div className="mt-8 space-y-9">
        {sections.map((section) => (
          <section key={section.heading}>
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-xl text-forest">{section.heading}</h3>
              <span className="h-px flex-1 bg-sage/25" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => {
                const content = (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-forest">
                      <Icon name={item.icon} size={19} />
                    </span>
                    <div className="mt-5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-lg text-forest">{item.label}</h4>
                        {item.appOnly && (
                          <span className="rounded-full border border-gold/35 bg-cream px-2 py-0.5 font-body text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-forest/60">
                            App
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-body text-sm leading-relaxed text-forest/65">{item.body}</p>
                    </div>
                    {!item.appOnly && (
                      <span className="mt-5 inline-block font-body text-xs font-semibold text-forest/70 underline decoration-gold decoration-2 underline-offset-4">
                        Open <span aria-hidden>→</span>
                      </span>
                    )}
                  </>
                );

                if (item.appOnly || !item.href) {
                  return (
                    <div key={item.label} className="rounded-2xl border border-sage/20 bg-parchment p-5 opacity-90">
                      {content}
                    </div>
                  );
                }

                const href = item.href.startsWith("/") ? item.href : `${base}/${item.href}`;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className="rounded-2xl border border-sage/25 bg-offwhite p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-gold/45 hover:bg-cream"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
