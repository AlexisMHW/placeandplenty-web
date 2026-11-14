import { requireStaff } from "@/lib/admin/server";

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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
