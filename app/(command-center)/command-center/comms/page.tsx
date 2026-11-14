import { requireStaff } from "@/lib/admin/server";
import { parseComms, smsState } from "@/lib/admin/cc";

// EMAIL AND SMS MONITOR (read-only). Counts only: no addresses, no phone numbers, no message text. SMS state is shown exactly as the
// database reports it; this page has no switch for either channel.
const CountList = ({ title, data }: { title: string; data: Record<string, number> | null }) => (
  <div><p className="font-medium">{title}</p>
    {data === null ? <p className="text-charcoal/70">not available</p> : Object.keys(data).length === 0 ? <p className="text-charcoal/70">none</p> :
      <ul className="list-disc pl-5">{Object.entries(data).map(([k, n]) => <li key={k}>{k.replace(/[._]/g, " ")}: <span className="tabular-nums">{n}</span></li>)}</ul>}</div>
);
export default async function CommsPage() {
  const { supabase } = await requireStaff("ops.read", "/command-center/comms");
  const { data, error } = await supabase.rpc("admin_comms_monitor");
  const c = error ? null : parseComms(data);
  const sms = c ? smsState(c) : "unknown";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Email and SMS</h1>
      {!c ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now.</p> : (
        <>
          <section aria-labelledby="email" className="space-y-3 text-sm"><h2 id="email" className="font-display text-xl text-forest">Email (last 7 days)</h2>
            {!c.emailAvailable ? <p role="status" className="text-charcoal/70">Email delivery tracking is not set up in this environment yet.</p> : (<>
              <CountList title="Delivery events from the email provider" data={c.emailEvents7d} />
              <CountList title="Addresses currently suppressed, by reason" data={c.suppressed} />
              {c.deliveries7d ? <CountList title="Invitation deliveries by status" data={c.deliveries7d} /> : null}</>)}
          </section>
          <section aria-labelledby="sms" className="space-y-3 text-sm"><h2 id="sms" className="font-display text-xl text-forest">SMS</h2>
            <p role="status" className="rounded-lg border border-forest/20 bg-cream p-3">{sms === "off" ? "Sending is OFF." : sms === "on" ? "Sending is ON." : "SMS status is not available in this environment."} This page cannot change it.</p>
            {c.smsMessages7d ? <CountList title="Messages in the last 7 days" data={c.smsMessages7d} /> : null}
          </section>
        </>)}
    </div>
  );
}
