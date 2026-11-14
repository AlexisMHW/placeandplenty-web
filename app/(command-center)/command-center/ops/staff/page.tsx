import { requireStaff } from "@/lib/admin/server";
import { STAFF_ROLES } from "@/lib/admin/access";
import { parseStaff } from "@/lib/admin/ops";
import { staffAction } from "./actions";

// STAFF ACCESS (staff.manage only; everyone else gets a 404). Grant by account id, revoke softly (history kept). Every change is audited in the database.
export default async function StaffPage() {
  const { supabase } = await requireStaff("staff.manage", "/command-center/ops/staff");
  const { data, error } = await supabase.rpc("admin_list_staff");
  const staff = error ? null : parseStaff(data);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Staff access</h1>
      {staff === null ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p> : (
        <ul className="space-y-2">{staff.map((s) => (
          <li key={s.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-forest/15 p-3 text-sm">
            <span>{s.displayName ?? s.userId} · {s.role.replace(/_/g, " ")} · {s.status}</span>
            {s.status === "active" ? (
              <form action={async (fd) => { "use server"; await staffAction(fd); }}><input type="hidden" name="kind" value="revoke" /><input type="hidden" name="user_id" value={s.userId} /><button className="rounded border border-forest/30 px-3 py-1 text-forest">Revoke</button></form>
            ) : null}
          </li>))}</ul>)}
      <form action={async (fd) => { "use server"; await staffAction(fd); }} className="space-y-2 rounded-lg border border-forest/15 p-4 text-sm">
        <h2 className="font-display text-xl text-forest">Give or change a role</h2>
        <input type="hidden" name="kind" value="grant" />
        <label className="block">Account id<input name="user_id" required pattern="[0-9a-fA-F-]{36}" className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
        <label className="block">Role<select name="role" className="mt-1 rounded border border-forest/30 px-2 py-1">{STAFF_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="confirm_owner" value="yes" /> I am granting the owner role on purpose</label>
        <button className="rounded bg-forest px-3 py-1 text-parchment">Save</button>
      </form>
    </div>
  );
}
