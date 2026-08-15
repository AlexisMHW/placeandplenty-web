import Link from "next/link";
import Image from "next/image";
import CtaButton from "@/components/CtaButton";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-sage/30 bg-offwhite/90 backdrop-blur">
      <div className="mx-auto flex max-w-editorial items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-forest"
        >
          <Image
            src="/images/pp-mark.png"
            alt="Place & Plenty"
            width={36}
            height={36}
            className="rounded-md"
            priority
          />
          <span>Place &amp; Plenty</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 font-body text-sm text-forest/80 md:flex"
        >
          <Link href="/#how-it-works" className="hover:text-forest">
            How It Works
          </Link>
          <Link href="/#features" className="hover:text-forest">
            Features
          </Link>
          <Link href="/coordinated-host" className="hover:text-forest">
            The Coordinated Host
          </Link>
          <Link href="/support" className="hover:text-forest">
            Support
          </Link>
        </nav>

        <CtaButton size="sm" />
      </div>
    </header>
  );
}

