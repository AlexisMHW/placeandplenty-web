// Command Center navigation. Pure: decides which links a staff context may SEE. It never grants anything:
// every page and every RPC re-checks the permission on the server (see lib/admin/server.ts).
import type { StaffContext, StaffPermission } from "@/lib/admin/access";

export interface NavLink { href: string; label: string; needs: StaffPermission | null }

export const NAV_LINKS: NavLink[] = [
  // The inbox is open to every active staff member: each notification is filtered per row by its own permission inside the database.
  { href: "/command-center/inbox", label: "Inbox", needs: null },
  { href: "/command-center", label: "Overview", needs: "overview.read" },
  { href: "/command-center/growth", label: "Growth", needs: "growth.read" },
  { href: "/command-center/purchases", label: "Purchases and support", needs: "support.read" },
  { href: "/command-center/finance", label: "Finance", needs: "revenue.read" },
  { href: "/command-center/comms", label: "Email and SMS", needs: "ops.read" },
  { href: "/command-center/sms", label: "SMS reporting", needs: "ops.read" },
  { href: "/command-center/health", label: "Integration health", needs: "ops.read" },
  { href: "/command-center/hosting-collective", label: "Hosting Collective", needs: "hc.read" },
  { href: "/command-center/hosting-collective/campaigns", label: "Campaigns", needs: "hc.read" },
  { href: "/command-center/hosting-collective/announcements", label: "Member announcements", needs: "hc.read" },
  { href: "/command-center/hosting-collective/tiers", label: "Tiers and terms", needs: "hc.read" },
  { href: "/command-center/hosting-collective/payouts", label: "Payouts", needs: "hc.payout" },
  { href: "/command-center/inbox/settings", label: "Notification settings", needs: "ops.read" },
  { href: "/command-center/ops/controls", label: "Operational controls", needs: "hc.read" },
  { href: "/command-center/ops", label: "Staff and audit", needs: "audit.read" },
  { href: "/command-center/ops/staff", label: "Staff access", needs: "staff.manage" },
];

export function navFor(context: StaffContext): NavLink[] {
  return NAV_LINKS.filter((l) => l.needs === null || context.permissions.includes(l.needs));
}
