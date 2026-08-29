import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase-server";

// THE HOST GROUP'S GATE, and nothing else.
//
// This layout used to draw the chrome too, which stopped working the
// moment the gathering workspace needed a DIFFERENT shell from the
// account area — §15 anchors the account level in forest, §16 keeps the
// gathering level predominantly warm. Two shells nested inside each
// other is two sidebars.
//
// So the chrome moved down a level and this file kept the one job that
// genuinely belongs to the whole group:
//
//   app/(host)/layout.tsx                  auth gate           <- here
//   app/(host)/host/(account)/layout.tsx   the forest shell
//   app/(host)/host/g/[id]/layout.tsx      the pale shell
//
// The route group (account) does not appear in any URL, so /host,
// /host/closet, /host/guest-book and /host/account are all unchanged.
//
// THE MIDDLEWARE ALREADY GATES /host. This check is not redundant:
// middleware can be bypassed if its matcher is ever edited carelessly,
// and these routes are what actually render host data. A gate at the
// render boundary is the one that cannot be routed around.

export const metadata = {
  title: "My Host Hub",
  robots: { index: false, follow: false },
};

// Host pages read per-request session data, so they are never static.
export const dynamic = "force-dynamic";

export default async function HostGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login?next=/host");

  return <>{children}</>;
}
