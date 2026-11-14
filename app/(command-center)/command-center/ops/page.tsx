import { requireStaff } from "@/lib/admin/server";
import { parseAudit, parseStaff } from "@/lib/admin/ops";

// STAFF AND AUDIT (read-only). Granting or revoking staff roles is deliberately NOT in the web UI: it is a separate approved
// database statement (see OWNER_BOOTSTRAP_PLAN). This page only shows who has access and what staff did.
export default async function OpsPage() {
  const { context, supabase } = await requireStaff("audit.read", "/command-center/ops");
  const canSeeStaff = context.permissions.includes("staff.manage");
  const [staffRes, auditRes] = await Promise.all([
    canSeeStaff ? supabase.rpc("admin_list_staff") : Promise.resolve({ data: null, error: null }),
    supabase.rpc("admin_recent_audit", { p_limit: 50 }),
  ]);
  const staff = canSeeStaff && !staffRes.error ? parseStaff(staffRes.data) : null;
  const audit = auditRes.error ? null : parseAudit(auditRes.data);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-forest">Staff and audit</h1>
      {canSeeStaff && (
        <section aria-labelledby="staff">
          <h2 id="staff" className="mb-2 font-display text-xl text-forest">Staff access</h2>
          {staff === null ? (
            <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-forest/15">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream"><tr>{["Name", "Role", "Status"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>{staff.map((s) => (
                  <tr key={s.userId} className="border-t border-forest/10">
                    <td className="px-3 py-2">{s.displayName ?? "no display name"}</td>
                    <td className="px-3 py-2">{s.role.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">{s.status}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section aria-labelledby="audit">
        <h2 id="audit" className="mb-2 font-display text-xl text-forest">Recent staff actions (newest first, last 50)</h2>
        {audit === null ? (
          <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p>
        ) : audit.length === 0 ? (
          <p className="text-sm text-charcoal/70">No staff actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-forest/15">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream"><tr>{["When", "Action", "Target", "Detail"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{audit.map((a) => (
                <tr key={a.id} className="border-t border-forest/10">
                  <td className="px-3 py-2 whitespace-nowrap">{a.createdAt ? a.createdAt.slice(0, 16).replace("T", " ") : "n/a"}</td>
                  <td className="px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2">{a.targetType ?? "n/a"}</td>
                  <td className="px-3 py-2">{a.detail || "none"}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
