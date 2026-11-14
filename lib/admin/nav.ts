// Command Center navigation. Pure: decides which links a staff context may SEE. It never grants anything:
// every page and every RPC re-checks the permission on the server (see lib/admin/server.ts).
import type { StaffContext, StaffPermission } from "@/lib/admin/access";

export interface NavLink { href: string; label: string; needs: StaffPermission }

export const NAV_LINKS: NavLink[] = [
  { href: "/command-center", label: "Overview", needs: "overview.read" },
  { href: "/command-center/growth", label: "Growth", needs: "growth.read" },
  { href: "/command-center/purchases", label: "Purchases and support", needs: "support.read" },
  { href: "/command-center/finance", label: "Finance", needs: "revenue.read" },
  { href: "/command-center/comms", label: "Email and SMS", needs: "ops.read" },
  { href: "/command-center/health", label: "Integration health", needs: "ops.read" },
  { href: "/command-center/hosting-collective", label: "Hosting Collective", needs: "hc.read" },
  { href: "/command-center/hosting-collective/payouts", label: "Payouts", needs: "hc.read" },
  { href: "/command-center/ops", label: "Staff and audit", needs: "audit.read" },
];

export function navFor(context: StaffContext): NavLink[] {
  return NAV_LINKS.filter((l) => context.permissions.includes(l.needs));
}
