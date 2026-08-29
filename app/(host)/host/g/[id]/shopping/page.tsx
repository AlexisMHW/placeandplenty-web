import { getShoppingItems, getExpenses } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";
import {
  AddForm,
  Field,
  ActionButton,
  StatusSelect,
} from "@/components/host/Editable";
import StaleScoreNote from "@/components/host/StaleScoreNote";
import {
  addShoppingItem,
  setShoppingStatus,
  deleteShoppingItem,
} from "@/lib/host-actions";
import { formatCurrency, shoppingLabel } from "@/lib/host-format";

// The shopping_status enum, in the order a host actually moves through
// it. "not_needed" sits last because it is the exit, not a step.
const STATUS_OPTIONS = [
  "need",
  "have",
  "bought",
  "borrow",
  "rent",
  "hire",
  "not_needed",
].map((value) => ({ value, label: shoppingLabel(value) }));

// MY SHOPPING — List and Budget in one place (§9).
//
// §32 forbids reintroducing My Budget as a standalone card, and §9 says
// budget is "absorbed into My Shopping as List | Budget while preserving
// receipt/expense functionality". So both live here, as two sections of
// one surface rather than two destinations.
//
// SPENT COMES FROM gathering_expenses, NOT FROM THE SHOPPING LIST. That
// table's own comment is unusually explicit: expenses are "the
// authoritative source for Spent. Shopping List rows are planning only
// and never counted here." Summing estimated_cost into a "spent" figure
// would produce a number the app contradicts — so list estimates are
// labelled "still to buy" and kept visibly apart from money actually
// paid.

export const metadata = { title: "My Shopping" };

export default async function ShoppingPage({
  params,
}: {
  params: { id: string };
}) {
  const [items, expenses] = await Promise.all([
    getShoppingItems(params.id),
    getExpenses(params.id),
  ]);

  const outstanding = items.filter((i) => i.status === "need");
  const estimatedRemaining = outstanding.reduce(
    (n, i) => n + (i.estimated_cost ?? 0),
    0
  );
  const spent = expenses.reduce((n, e) => n + Number(e.amount ?? 0), 0);

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || "Everything else";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <WorkspaceHeader
        title="My Shopping"
        description="What to get, and what you're spending."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel>
          <p className="font-body text-xs font-bold uppercase tracking-[0.15em] text-forest/70">
            Spent
          </p>
          <p className="mt-2 font-display text-3xl text-forest">
            {formatCurrency(spent)}
          </p>
          <p className="mt-1 font-body text-sm text-forest/60">
            {expenses.length === 0
              ? "No receipts logged yet"
              : `across ${expenses.length} ${expenses.length === 1 ? "receipt" : "receipts"}`}
          </p>
        </Panel>
        <Panel>
          <p className="font-body text-xs font-bold uppercase tracking-[0.15em] text-forest/70">
            Still to buy
          </p>
          <p className="mt-2 font-display text-3xl text-forest">
            {outstanding.length}
          </p>
          <p className="mt-1 font-body text-sm text-forest/60">
            {estimatedRemaining > 0
              ? `estimated ${formatCurrency(estimatedRemaining)}`
              : "items on the list"}
          </p>
        </Panel>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="The list is empty."
          body="As you plan the menu, the things you need show up here — and you can add anything else yourself."
        />
      ) : (
        <>
          <h3 className="mt-12 font-display text-xl text-forest">The list</h3>
          <div className="mt-5 space-y-8">
            {Object.entries(grouped).map(([category, rows]) => (
              <section key={category}>
                <h4 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {category}
                </h4>
                <ul className="mt-3 divide-y divide-sage/20">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3"
                    >
                      <p className="min-w-0 font-body text-base text-forest">
                        {item.name}
                        {item.quantity != null && (
                          <span className="text-forest/60">
                            {" "}
                            · {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </span>
                        )}
                        {item.estimated_cost != null && (
                          <span className="text-forest/50">
                            {" "}
                            · {formatCurrency(item.estimated_cost)}
                          </span>
                        )}
                      </p>

                      <div className="flex items-center gap-4">
                        <StatusSelect
                          label={`Status for ${item.name}`}
                          value={item.status}
                          options={STATUS_OPTIONS}
                          action={setShoppingStatus.bind(
                            null,
                            params.id,
                            item.id
                          )}
                        />
                        <ActionButton
                          action={deleteShoppingItem.bind(
                            null,
                            params.id,
                            item.id
                          )}
                          confirm={`Remove ${item.name} from the list?`}
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

          {expenses.length > 0 && (
            <>
              <h3 className="mt-12 font-display text-xl text-forest">
                Receipts
              </h3>
              <ul className="mt-4 divide-y divide-sage/20">
                {expenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                  >
                    <div>
                      <p className="font-body text-base text-forest">
                        {e.merchant || e.category || "Expense"}
                      </p>
                      {e.note && (
                        <p className="font-body text-sm text-forest/60">
                          {e.note}
                        </p>
                      )}
                    </div>
                    <p className="font-body text-base text-forest">
                      {formatCurrency(Number(e.amount))}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

        </>
      )}

      <AddForm
        label="Add to the list"
        submitLabel="Add item"
        action={addShoppingItem.bind(null, params.id)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Item" required placeholder="Ice" />
          <Field name="category" label="Aisle" placeholder="Drinks" />
          <Field name="quantity" label="How many" type="number" placeholder="4" />
          <Field name="unit" label="Unit" placeholder="bags" />
          <Field
            name="estimated_cost"
            label="Rough cost"
            type="number"
            placeholder="12.00"
          />
        </div>
      </AddForm>

      <StaleScoreNote />
    </div>
  );
}
