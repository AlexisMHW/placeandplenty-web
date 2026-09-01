import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, ActionButton } from "@/components/host/Editable";
import {
  LeftoverPreferenceControl,
  ServingsControl,
} from "@/components/host/MyTableControls";
import { RecipeSourceEditor } from "@/components/host/RecipeSourceEditor";
import { getMyTableData } from "@/lib/menu-data";
import { getRecipeSourceOptions } from "@/lib/recipe-source-data";
import {
  addCanonicalMenuItemWeb,
  deleteCanonicalMenuItemWeb,
  seedCanonicalMenuWeb,
  setCanonicalLeftoversWeb,
  setCanonicalMenuServingsWeb,
} from "@/lib/menu-actions";

export const metadata = { title: "My Table" };

const CATEGORY_LABEL: Record<string, string> = {
  protein: "Proteins",
  side: "Sides",
  appetizer: "Appetizers",
  dessert: "Desserts",
  beverage: "Beverages",
  other: "Everything else",
};

export default async function TablePage({
  params,
}: {
  params: { id: string };
}) {
  const [{ items, context }, sourceOptions] = await Promise.all([
    getMyTableData(params.id),
    getRecipeSourceOptions(params.id),
  ]);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  const existingNames = new Set(items.map((item) => item.name.trim().toLowerCase()));
  const recommendations = context.last_plan_output?.menuRecommendations ?? [];
  const hasUnseededFigureItOut = recommendations.some(
    (recommendation) =>
      recommendation.name &&
      !existingNames.has(recommendation.name.trim().toLowerCase())
  );

  const planningNeeds = [context.dietary_notes, context.accessibility_notes].filter(
    (value): value is string => Boolean(value?.trim())
  );

  const dietaryNeeds = context.dietary_notes ? [context.dietary_notes] : [];
  const accessibilityNeeds = context.accessibility_notes ? [context.accessibility_notes] : [];

  return (
    <div>
      <WorkspaceHeader
        title="My Table"
        description="What you're serving, how much you need, and the food details that matter for your people."
      />

      <div className="mt-7 max-w-3xl">
        <LeftoverPreferenceControl
          value={context.leftover_preference}
          action={setCanonicalLeftoversWeb.bind(null, params.id)}
        />
      </div>

      {planningNeeds.length > 0 && (
        <section className="mt-5 max-w-3xl rounded-card border border-sage/30 bg-cream px-5 py-4">
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
            Keep in mind
          </p>
          <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
          <ul className="mt-3 space-y-1.5 font-body text-sm leading-relaxed text-forest/75">
            {planningNeeds.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </section>
      )}

      {hasUnseededFigureItOut && (
        <section className="mt-5 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-card border border-gold/35 bg-parchment px-5 py-4">
          <div>
            <p className="font-display text-lg text-forest">Your Figure It Out plan has menu ideas ready.</p>
            <p className="mt-1 font-body text-sm text-forest/65">
              Add the dishes that aren’t already here. Existing names are skipped, not duplicated.
            </p>
          </div>
          <ActionButton
            action={seedCanonicalMenuWeb.bind(null, params.id)}
            className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite"
          >
            Add plan suggestions
          </ActionButton>
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nothing on the table yet."
          body="Add a dish and Place & Plenty will work out a starting quantity from your guest count, menu mix, and leftovers preference."
        />
      ) : (
        <div className="mt-8 max-w-4xl space-y-10">
          {Object.entries(grouped).map(([category, rows]) => (
            <section key={category}>
              <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                {CATEGORY_LABEL[category] ?? category}
              </h3>
              <ul className="mt-4 space-y-3">
                {rows.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-card border border-sage/25 bg-offwhite px-5 py-4 shadow-soft"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg text-forest">{item.name}</p>
                        {item.notes && (
                          <p className="mt-1 font-body text-sm text-forest/65">{item.notes}</p>
                        )}
                        {item.servings_recommended != null && (
                          <p className="mt-2 font-body text-sm text-forest/70">
                            Place &amp; Plenty recommends {item.servings_recommended} servings
                            {item.user_override ? " · you adjusted this dish" : ""}.
                          </p>
                        )}
                      </div>

                      <div className="flex items-start gap-4">
                        <div>
                          <p className="mb-1 text-right font-body text-[0.65rem] font-bold uppercase tracking-[0.12em] text-forest/50">
                            Planned servings
                          </p>
                          <ServingsControl
                            value={item.servings_planned}
                            label={`Planned servings for ${item.name}`}
                            action={setCanonicalMenuServingsWeb.bind(
                              null,
                              params.id,
                              item.id
                            )}
                          />
                        </div>
                        <ActionButton
                          action={deleteCanonicalMenuItemWeb.bind(null, params.id, item.id)}
                          confirm={`Remove ${item.name} from the menu?`}
                          title={`Remove ${item.name}`}
                          className="mt-5 font-body text-sm text-forest/55 underline decoration-sage/50 underline-offset-4 transition hover:text-error"
                        >
                          Remove
                        </ActionButton>
                      </div>
                    </div>

                    <RecipeSourceEditor
                      gatheringId={params.id}
                      item={item}
                      recipes={sourceOptions.recipes}
                      guests={sourceOptions.guests}
                      coHosts={sourceOptions.coHosts}
                      dietaryNeeds={dietaryNeeds}
                      accessibilityNeeds={accessibilityNeeds}
                    />
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
        action={addCanonicalMenuItemWeb.bind(null, params.id)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Dish" required placeholder="Baked chicken" />
          <label className="block">
            <span className="mb-1 block font-body text-sm font-semibold text-forest">Category</span>
            <select
              name="category"
              defaultValue="protein"
              className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
            >
              <option value="protein">Protein</option>
              <option value="side">Side</option>
              <option value="appetizer">Appetizer</option>
              <option value="dessert">Dessert</option>
              <option value="beverage">Beverage</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Field
            name="notes"
            label="Note"
            placeholder="Make the day before"
            className="sm:col-span-2"
          />
        </div>
      </AddForm>

      <p className="mt-5 max-w-3xl font-body text-xs leading-relaxed text-forest/55">
        Quantities are estimates for home hosting, not catering guarantees. Adjust them anytime for your people.
      </p>
    </div>
  );
}
