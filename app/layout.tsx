import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";

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

// ROOT LAYOUT — document shell only. Deliberately no header, no footer,
// no <main>.
//
// Directive §7 wants guest web "lighter than the host app, less
// expansive than the marketing website", and §33 says not to push app
// download at a guest doing a task that works without an account. While
// the header and footer lived here, an invitation arrived wearing the
// full marketing chrome — including a "Join the Guest List" CTA aimed at
// someone who had already been invited to something.
//
// So chrome belongs to the route groups, not to the document:
//
//   app/(marketing)/layout.tsx  header + footer, the public website
//   app/(guest)/layout.tsx      a quiet mark, no nav, no marketing CTA
//
// Route groups do not appear in URLs. Moving a page between them changes
// its chrome and nothing else. Anything genuinely global — fonts, the
// <body> background, metadataBase — stays here.
//
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
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
