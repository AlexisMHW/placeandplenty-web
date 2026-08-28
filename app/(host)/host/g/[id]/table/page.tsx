import { getMenuItems } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";

// MY TABLE — the menu (§9, food & the table).
//
// servings_recommended is the app's own suggestion and servings_planned
// is what the host settled on. Both are shown when they disagree,
// because the gap is the interesting part: it is the difference between
// what was suggested and what the host decided, and hiding it would make
// the suggestion look like a rule.

export const metadata = { title: "My Table" };

export default async function TablePage({
  params,
}: {
  params: { id: string };
}) {
  const items = await getMenuItems(params.id);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || "Everything else";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <WorkspaceHeader
        title="My Table"
        description="What you're serving, and how much of it."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing on the table yet."
          body="Add a dish and Place & Plenty will suggest a serving size based on who's coming."
          hint="Dishes are added in the app."
        />
      ) : (
        <>
          <div className="mt-8 space-y-10">
            {Object.entries(grouped).map(([category, rows]) => (
              <section key={category}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {category}
                </h3>
                <ul className="mt-4 divide-y divide-sage/20">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-lg text-forest">
                          {item.name}
                        </p>
                        {item.notes && (
                          <p className="mt-0.5 font-body text-sm text-forest/65">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right font-body text-sm">
                        {item.servings_planned != null && (
                          <p className="text-forest">
                            {item.servings_planned} servings
                          </p>
                        )}
                        {item.servings_recommended != null &&
                          item.servings_recommended !==
                            item.servings_planned && (
                            <p className="text-forest/55">
                              suggested {item.servings_recommended}
                            </p>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <ReadOnlyNote what="menu" />
        </>
      )}
    </div>
  );
}
