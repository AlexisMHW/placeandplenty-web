import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// The public website's chrome. Everything a visitor who is *browsing*
// should get: full navigation, the launch-phase CTA, the footer with
// legal and social.
//
// Guest routes deliberately do not use this — see app/(guest)/layout.tsx.

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
