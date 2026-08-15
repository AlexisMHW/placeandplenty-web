import Link from "next/link";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "The Coordinated Host", href: "/coordinated-host" },
  { label: "Support", href: "/support" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Delete Account", href: "/delete-account" },
];

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "Facebook", href: "https://facebook.com" },
  { label: "TikTok", href: "https://tiktok.com" },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-sage/30 bg-forest py-14 text-offwhite">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div>
            <p className="font-display text-2xl">Place &amp; Plenty</p>
            <p className="mt-1 font-body text-sm text-offwhite/70">
              Home hospitality, made simple.
            </p>
            <p className="mt-4 font-body text-xs uppercase tracking-wide text-offwhite/50">
              placeandplenty.com
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-2 font-body text-sm text-offwhite/80 sm:grid-cols-3"
          >
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-offwhite">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-offwhite/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-offwhite/50">
            © {new Date().getFullYear()} Place &amp; Plenty. All rights
            reserved.
          </p>
          <div className="flex gap-5 font-body text-xs text-offwhite/60">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-offwhite"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
