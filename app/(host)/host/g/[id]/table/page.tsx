import { getMenuItems } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, ActionButton } from "@/components/host/Editable";
import StaleScoreNote from "@/components/host/StaleScoreNote";
import { addMenuItem, deleteMenuItem } from "@/lib/host-actions";

// MY TABLE — the menu (§9, food & the table). Read AND write.
//
// servings_recommended is the app's suggestion, servings_planned is what
// the host settled on. Both are shown when they disagree, because the
// gap is the interesting part — hiding it would make the suggestion look
// like a rule.
//
// Actions are bound with the gathering id here on the server, so the id
// a mutation runs against is never something the browser supplies. RLS
// would refuse a foreign gathering anyway; this means the request is
// never even shaped to try.

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
          body="Add a dish and Place & Plenty suggests a serving size based on who's coming."
        />
      ) : (
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

                    <div className="flex items-baseline gap-5">
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

                      <ActionButton
                        action={deleteMenuItem.bind(null, params.id, item.id)}
                        confirm={`Remove ${item.name} from the menu?`}
                        title={`Remove ${item.name}`}
                        className="font-body text-sm text-forest/55 underline decoration-sage/50 underline-offset-4 transition-colors duration-400 hover:text-error"
                      >
                        Remove
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AddForm
        label="Add a dish"
        submitLabel="Add to the table"
        action={addMenuItem.bind(null, params.id)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Dish" required placeholder="Baked ziti" />
          <Field name="category" label="Course" placeholder="Main" />
          <Field
            name="servings_planned"
            label="Servings"
            type="number"
            placeholder="12"
          />
          <Field name="notes" label="Note" placeholder="Make the day before" />
        </div>
      </AddForm>

      <StaleScoreNote />
    </div>
  );
}
