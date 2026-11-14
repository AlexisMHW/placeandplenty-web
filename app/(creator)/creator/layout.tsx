export const metadata = { title: "Creator portal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-offwhite text-charcoal">
      <header className="border-b border-forest/15 bg-forest px-4 py-3 text-parchment sm:px-6">
        <p className="mx-auto max-w-4xl font-display text-lg">Place &amp; Plenty Hosting Collective</p>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
