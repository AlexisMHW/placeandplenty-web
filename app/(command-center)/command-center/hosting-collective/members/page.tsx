import { requireStaff } from "@/lib/admin/server";
import { parseMembers } from "@/lib/admin/hc";

export default async function MembersPage() {
  const { supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/members");
  const { data, error } = await supabase.rpc("hc_admin_list_members");
  const rows = error ? null : parseMembers(data);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Members</h1>
      {rows === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No members yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-forest/15">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream"><tr>
              {["Name", "Status", "Tier", "Account linked", "Codes", "Referred sign-ups", "Onboarding steps done", "Submissions"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.partnerId} className="border-t border-forest/10">
                <td className="px-3 py-2">{m.displayName}</td><td className="px-3 py-2">{m.status}</td><td className="px-3 py-2">{m.tier ?? "none"}</td>
                <td className="px-3 py-2">{m.accountLinked ? "yes" : "not yet"}</td>
                <td className="px-3 py-2 tabular-nums">{m.codes ?? "n/a"}</td><td className="px-3 py-2 tabular-nums">{m.signups ?? "n/a"}</td>
                <td className="px-3 py-2 tabular-nums">{m.onboardingDone ?? "n/a"}</td><td className="px-3 py-2 tabular-nums">{m.submissions ?? "n/a"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
