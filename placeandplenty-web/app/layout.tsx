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

export const metadata: Metadata = {
  metadataBase: new URL("https://placeandplenty.com"),
  title: {
    default: "Place & Plenty | Home Hospitality, Made Simple",
    template: "%s | Place & Plenty",
  },
  description:
    "Place & Plenty helps you figure out what needs to happen, when it needs to happen, and whether you're actually ready before people arrive. Home hospitality, made simple.",
  openGraph: {
    title: "Place & Plenty | Home Hospitality, Made Simple",
    description:
      "People are coming. We'll help you get ready. A preparation plan for home hosting — built backward from when your guests arrive.",
    url: "https://placeandplenty.com",
    siteName: "Place & Plenty",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Place & Plenty | Home Hospitality, Made Simple",
    description:
      "People are coming. We'll help you get ready. Home hospitality, made simple.",
  },
  alternates: {
    canonical: "https://placeandplenty.com",
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
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
