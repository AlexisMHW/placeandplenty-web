import { getHelpCandidates } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";

// FIND HELP (§9, the look & the day).
//
// "Work out where an extra pair of hands would genuinely change the day."
//
// BACKED BY TASKS, WHICH IS THE HONEST IMPLEMENTATION. There is no
// find_help table, because the question is really "what is still open,
// matters, and could be someone else's" — and that is exactly the open
// critical and important tasks. Ordering by priority puts the answer
// first.
//
// Already-assigned work is separated out rather than hidden, because
// "who has this" is half of what a host is checking.
//
// NO ASSIGNMENT CONTROL HERE YET. tasks.assigned_to_user_id points at a
// co-host and assigned_to_guest_id at a guest, so assigning from web
// means choosing between two different people-pickers and deciding what
// an assignment notifies. That belongs with the flow rather than bolted
// onto a list — and communications do not deliver yet in any case (§22),
// so an assignment made here would silently notify nobody.

export const metadata = { title: "Find Help" };

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  important: "Important",
  optional: "If there's time",
};

export default async function FindHelpPage({
  params,
}: {
  params: { id: string };
}) {
  const tasks = await getHelpCandidates(params.id);

  const assigned = tasks.filter(
    (t) => t.assigned_to_user_id || t.assigned_to_guest_id
  );
  const unassigned = tasks.filter(
    (t) => !t.assigned_to_user_id && !t.assigned_to_guest_id
  );

  const worthHanding = unassigned.filter(
    (t) => t.priority === "critical" || t.priority === "important"
  );
  const rest = unassigned.filter(
    (t) => t.priority !== "critical" && t.priority !== "important"
  );

  return (
    <div>
      <WorkspaceHeader
        title="Find Help"
        description="Where an extra pair of hands would actually change the day."
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing outstanding."
          body="When there's a plan with open work on it, the things worth handing to someone show up here."
        />
      ) : (
        <div className="mt-8 space-y-6">
          {worthHanding.length > 0 && (
            <Panel>
              <h3 className="font-display text-xl text-forest">
                Worth handing to someone
              </h3>
              <p className="mt-1 font-body text-sm text-forest/65">
                Still open, and matters.
              </p>
              <ul className="mt-4 divide-y divide-sage/20">
                {worthHanding.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-base text-forest">
                        {t.title}
                      </p>
                      {t.description && (
                        <p className="mt-0.5 font-body text-sm text-forest/60">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <p className="font-body text-sm text-forest/65">
                      {PRIORITY_LABEL[t.priority ?? ""] ?? ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {assigned.length > 0 && (
            <Panel>
              <h3 className="font-display text-xl text-forest">
                Already someone else&rsquo;s
              </h3>
              <ul className="mt-4 divide-y divide-sage/20">
                {assigned.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <p className="font-body text-base text-forest">{t.title}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {rest.length > 0 && (
            <Panel>
              <h3 className="font-display text-xl text-forest">
                If there&rsquo;s time
              </h3>
              <ul className="mt-4 divide-y divide-sage/20">
                {rest.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <p className="font-body text-base text-forest">{t.title}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <p className="font-body text-sm leading-relaxed text-forest/65">
            Assigning work to a co-host or a guest is done in the app,
            where the message that goes with it lives.
          </p>
        </div>
      )}
    </div>
  );
}
