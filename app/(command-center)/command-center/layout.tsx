import Link from "next/link";
import { requireStaff } from "@/lib/admin/server";
import { navFor } from "@/lib/admin/nav";

// COMMAND CENTER GROUP GATE. Any active staff member passes this layout; each page then requires its own
// permission. Not indexed, never cached, never static.
export const metadata = {
  title: "Command Center",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireStaff(undefined, "/command-center");
  return (
    <div className="min-h-screen bg-offwhite text-charcoal">
      <header className="border-b border-forest/15 bg-forest px-4 py-3 text-parchment sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p className="font-display text-lg">Place &amp; Plenty Command Center</p>
          <p className="text-sm text-parchment/80">Signed in as {context.role.replace(/_/g, " ")}</p>
        </div>
      </header>
      <nav aria-label="Command Center sections" className="border-b border-forest/15 bg-parchment px-4 py-2 sm:px-6">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-4 text-sm">
          {navFor(context).map((l) => (
            <li key={l.href}><Link href={l.href} className="text-forest underline-offset-2 hover:underline">{l.label}</Link></li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
