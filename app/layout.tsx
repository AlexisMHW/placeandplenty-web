import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

// NOTE ON CANONICAL URLs — do not add `alternates` or `openGraph.url`
// here. Next merges root metadata into every child route, so a canonical
// set at this level makes EVERY page declare itself a duplicate of the
// homepage. That is exactly what happened before 27 Aug 2026: /privacy,
// /terms, /support and /coordinated-host all shipped
// <link rel="canonical" href="https://placeandplenty.com"/>, which tells
// Google to drop them from the index.
//
// Each route sets its own `alternates.canonical` and `openGraph.url` as
// a path relative to metadataBase. Add them to every new page.
//
// Canonical host is the APEX, placeandplenty.com — matching the native
// app's associated domain (`applinks:placeandplenty.com`) and its Android
// verified link for https://placeandplenty.com/invite. www must redirect
// to the apex, never the other way round.
export const metadata: Metadata = {
  metadataBase: new URL("https://placeandplenty.com"),
  title: {
    default: "Place & Plenty | Home Hosting. Made Simple.",
    template: "%s | Place & Plenty",
  },
  description:
    "Place & Plenty helps you figure out what needs to happen, when it needs to happen, and whether you're actually ready before people arrive. Home Hosting. Made Simple.",
  openGraph: {
    title: "Place & Plenty | Home Hosting. Made Simple.",
    description:
      "People are coming. We'll help you get ready. A preparation plan for home hosting — built backward from when your guests arrive.",
    siteName: "Place & Plenty",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Place & Plenty | Home Hosting. Made Simple.",
    description:
      "People are coming. We'll help you get ready. Home Hosting. Made Simple.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${lato.variable}`}>
      <body className="font-body antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
