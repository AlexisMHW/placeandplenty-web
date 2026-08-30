import Image from "next/image";
import Link from "next/link";
import { BotanicalBough } from "@/components/Botanical";
import Icon, { type IconName } from "@/components/Icon";
import QrCode from "@/components/QrCode";
import Wordmark from "@/components/Wordmark";
import { BRAND_NAME, TAGLINE } from "@/lib/brand";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  UTILITY_NAV,
  ACCOUNT_NAV,
  SOCIAL_LINKS,
  type NavItem,
} from "@/lib/nav";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  APP_DOWNLOAD_URL,
  STORE_BADGES,
  hasAnyStoreLink,
} from "@/lib/app-links";

const EXPLORE: NavItem[] = [
  ...PRIMARY_NAV,
  SECONDARY_NAV.find((item) => item.href === "/show-us-how-you-gather")!,
];

const COMPANY: NavItem[] = SECONDARY_NAV.filter(
  (item) => item.href === "/about",
);

const SUPPORT: NavItem[] = [
  SECONDARY_NAV.find((item) => item.href === "/support")!,
  ...ACCOUNT_NAV,
];

const LEGAL: NavItem[] = UTILITY_NAV;

const COLUMNS = [
  { heading: "Explore", items: EXPLORE },
  { heading: "Company", items: COMPANY },
  { heading: "Support", items: SUPPORT },
  { heading: "Legal", items: LEGAL },
];

const SOCIAL_ICONS: Record<string, IconName> = {
  Instagram: "camera",
  Facebook: "chat",
  TikTok: "music",
  YouTube: "photo",
};

function StoreBadge({
  href,
  badge,
  alt,
  eyebrow,
  label,
}: {
  href: string | null;
  badge: string | null;
  alt: string;
  eyebrow: string;
  label: string;
}) {
  if (!href) {
    return (
      <div className="flex min-w-[10.4rem] items-center gap-3 rounded-xl border border-forest/15 bg-offwhite/70 px-4 py-2.5 text-left opacity-70">
        <Icon name="phone" size={18} className="text-forest/55" />
        <span className="font-body leading-tight text-forest">
          <span className="block text-[0.58rem] uppercase tracking-[0.12em] text-forest/50">
            {eyebrow}
          </span>
          <span className="block text-sm font-semibold">{label}</span>
        </span>
      </div>
    );
  }

  if (badge) {
    return (
      <a href={href} className="inline-block rounded-lg">
        <Image src={badge} alt={alt} width={168} height={50} />
      </a>
    );
  }

  return (
    <a
      href={href}
      className="flex min-w-[10.4rem] items-center gap-3 rounded-xl border border-forest/15 bg-offwhite px-4 py-2.5 text-left transition-colors duration-300 hover:bg-cream"
    >
      <Icon name="phone" size={18} className="text-forest/65" />
      <span className="font-body leading-tight text-forest">
        <span className="block text-[0.58rem] uppercase tracking-[0.12em] text-forest/50">
          {eyebrow}
        </span>
        <span className="block text-sm font-semibold">{label}</span>
      </span>
    </a>
  );
}

export default function SiteFooter() {
  const appLinksLive = hasAnyStoreLink();

  return (
    <footer className="bg-forest text-offwhite">
      {/* Universal conversion panel */}
      <section className="relative overflow-hidden bg-cream text-forest">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 py-14 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:gap-16">
          <div>
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Place &amp; Plenty, wherever you are
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-[2.8rem]">
              Host with confidence. <em className="italic">Anywhere you are.</em>
            </h2>
            <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-forest/75 md:text-lg">
              Start hosting free on the web or get the app. One account keeps your gathering connected from the first idea to the doorbell ringing.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-forest px-6 py-3.5 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
              >
                Start Hosting Free
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-forest/25 px-6 py-3.5 font-body text-sm font-semibold text-forest transition-colors duration-300 hover:bg-forest/5"
              >
                See How It Works
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <StoreBadge
                href={APP_STORE_URL}
                badge={STORE_BADGES.apple}
                alt="Download on the App Store"
                eyebrow={APP_STORE_URL ? "Download on the" : "Coming with app release"}
                label="App Store"
              />
              <StoreBadge
                href={PLAY_STORE_URL}
                badge={STORE_BADGES.google}
                alt="Get it on Google Play"
                eyebrow={PLAY_STORE_URL ? "Get it on" : "Coming with app release"}
                label="Google Play"
              />
            </div>

            <p className="mt-4 font-body text-xs leading-relaxed text-forest/55">
              {appLinksLive
                ? "Scan to download Place & Plenty or choose your store above."
                : "Store links and the live download QR switch on when the app listings are published."}
            </p>
          </div>

          <div className="relative mx-auto flex w-full max-w-[31rem] items-end justify-center gap-5 lg:justify-end">
            <div className="relative z-10 w-[10.5rem] overflow-hidden rounded-[2rem] border-[6px] border-forest bg-forest shadow-lift sm:w-[12rem]">
              <Image
                src="/images/hero-app-screen.png"
                alt="Place & Plenty on a phone"
                width={510}
                height={1080}
                sizes="12rem"
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="mb-4 hidden rounded-2xl border border-sage/35 bg-offwhite p-4 text-center shadow-softer sm:block">
              {appLinksLive ? (
                <>
                  <div className="rounded-lg bg-offwhite p-1.5">
                    <QrCode value={APP_DOWNLOAD_URL} size={112} />
                  </div>
                  <p className="mt-3 max-w-[8.5rem] font-body text-xs leading-relaxed text-forest/65">
                    Scan to download Place &amp; Plenty.
                  </p>
                </>
              ) : (
                <div className="flex h-[112px] w-[112px] items-center justify-center rounded-lg border border-dashed border-sage/55 bg-parchment px-3">
                  <p className="font-body text-[0.66rem] font-semibold uppercase leading-relaxed tracking-[0.12em] text-forest/45">
                    QR activates at app release
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Universal navigation footer */}
      <section className="relative overflow-hidden bg-forest">
        <BotanicalBough
          className="pointer-events-none absolute -right-10 bottom-0 hidden text-gold/18 lg:block"
          width={250}
          flip
        />

        <div className="relative mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.7fr)] lg:gap-16">
            <div>
              <Link href="/" className="inline-block" aria-label="Place & Plenty, home">
                <Wordmark tone="offwhite" />
              </Link>
              <p className="mt-5 font-display text-xl italic text-gold">{TAGLINE}</p>
              <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-offwhite/65">
                Everything between “people are coming” and the doorbell ringing.
              </p>

              <div className="mt-8">
                <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
                  Let&apos;s Connect
                </h2>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {SOCIAL_LINKS.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-offwhite/25 text-offwhite/80 transition-colors duration-300 hover:border-gold hover:text-offwhite"
                      >
                        <span className="sr-only">{social.label}</span>
                        <Icon name={SOCIAL_ICONS[social.label] || "heart"} size={17} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
              {COLUMNS.map((column) => (
                <nav key={column.heading} aria-label={column.heading}>
                  <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
                    {column.heading}
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {column.items.map((item) => (
                      <li key={`${column.heading}-${item.href}`}>
                        <Link
                          href={item.href}
                          className="font-body text-sm text-offwhite/78 transition-colors duration-300 hover:text-offwhite"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-offwhite/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-xs text-offwhite/50">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
            <p className="font-body text-xs text-offwhite/50">
              Home Hosting. Made Simple.
            </p>
          </div>
        </div>
      </section>
    </footer>
  );
}
