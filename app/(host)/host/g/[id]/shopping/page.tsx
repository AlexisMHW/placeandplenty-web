import Link from "next/link";
import {
  getGatheringClosetUse,
  gatheringHasSmartCloset,
} from "@/lib/host-data";
import { getShoppingWorkspace } from "@/lib/shopping-data";
import { getBudgetData } from "@/lib/budget-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";
import {
  AddForm,
  Field,
  ActionButton,
} from "@/components/host/Editable";
import { ShoppingFulfillmentControl } from "@/components/host/ShoppingFulfillmentControl";
import {
  ExpenseForm,
  MoneyEditor,
  ReceiptUpload,
} from "@/components/host/BudgetControls";
import {
  addCanonicalShoppingItemWeb,
  assignCanonicalBorrowWeb,
  deleteCanonicalShoppingItemWeb,
  seedCanonicalShoppingWeb,
  setCanonicalBorrowReturnedWeb,
  setCanonicalProviderWeb,
  setCanonicalShoppingStatusWeb,
} from "@/lib/shopping-actions";
import {
  attachReceiptWeb,
  createExpenseWeb,
  deleteExpenseWeb,
  updateBudgetTargetWeb,
  updateSpentOverrideWeb,
} from "@/lib/budget-actions";
import { formatCurrency } from "@/lib/host-format";

export const metadata = { title: "My Shopping" };

export default async function ShoppingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { view?: string };
}) {
  const view = searchParams?.view === "budget" ? "budget" : "list";
  const [workspace, closetUse, smartCloset, budget] = await Promise.all([
    getShoppingWorkspace(params.id),
    getGatheringClosetUse(params.id),
    gatheringHasSmartCloset(params.id),
    getBudgetData(params.id),
  ]);
  const items = workspace.items;

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || "Everything else";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  const existingNames = new Set(items.map((item) => item.name.trim().toLowerCase()));
  const planItems = workspace.lastPlanOutput?.shoppingItems ?? [];
  const hasUnseededPlanItems = planItems.some(
    (item) => item.name && !existingNames.has(item.name.trim().toLowerCase())
  );

  return (
    <div>
      <WorkspaceHeader
        title="My Shopping"
        description="One place for what you need and what the gathering is costing."
      />

      <div className="mt-6 inline-flex rounded-full border border-sage/30 bg-cream p-1">
        <Link
          href={`/host/g/${params.id}/shopping?view=list`}
          className={`rounded-full px-5 py-2 font-body text-sm font-semibold transition ${
            view === "list" ? "bg-forest text-offwhite" : "text-forest/70"
          }`}
        >
          List
        </Link>
        <Link
          href={`/host/g/${params.id}/shopping?view=budget`}
          className={`rounded-full px-5 py-2 font-body text-sm font-semibold transition ${
            view === "budget" ? "bg-forest text-offwhite" : "text-forest/70"
          }`}
        >
          Budget
        </Link>
      </div>

      {view === "list" ? (
        <>
          <section className="mt-7 max-w-4xl rounded-card border border-sage/25 bg-parchment px-5 py-4">
            <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
              The running list
            </p>
            <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
            <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
              Menu ingredients, supplies, borrowed things and anything else you need for the day all live here. Borrowing stays connected to Who’s Bringing What; rentals and hired help keep their provider here.
            </p>
          </section>

          {hasUnseededPlanItems && (
            <section className="mt-5 flex max-w-4xl flex-wrap items-center justify-between gap-4 rounded-card border border-gold/35 bg-cream px-5 py-4">
              <div>
                <p className="font-display text-lg text-forest">Your Figure It Out plan has shopping ideas ready.</p>
                <p className="mt-1 font-body text-sm text-forest/65">
                  Add the items that are not already on your list. Existing names are skipped instead of duplicated.
                </p>
              </div>
              <ActionButton
                action={seedCanonicalShoppingWeb.bind(null, params.id)}
                className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite"
              >
                Add plan suggestions
              </ActionButton>
            </section>
          )}

          {items.length === 0 ? (
            <EmptyState
              title="The list is empty."
              body="As you plan the menu, the things you need show up here — and you can add anything else yourself."
            />
          ) : (
            <div className="mt-9 max-w-4xl space-y-8">
              {Object.entries(grouped).map(([category, rows]) => (
                <section key={category}>
                  <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                    {category}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {rows.map((item) => {
                      const responsibility = workspace.contributions.find(
                        (row) => row.linked_shopping_item_id === item.id && row.status !== "cancelled"
                      );
                      const responsibilityLabel = responsibility?.guest_id
                        ? workspace.guests.find((guest) => guest.id === responsibility.guest_id)?.label
                        : responsibility?.gathering_member_id
                          ? workspace.coHosts.find((member) => member.id === responsibility.gathering_member_id)?.label
                          : null;

                      return (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 rounded-card border border-sage/20 bg-offwhite px-5 py-4 shadow-soft"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-body text-base font-semibold text-forest">
                              {item.name}
                            </p>
                            <p className="mt-1 font-body text-sm text-forest/60">
                              {item.quantity != null
                                ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                                : "Quantity not set"}
                              {item.estimated_cost != null
                                ? ` · ${formatCurrency(item.estimated_cost)} estimated`
                                : ""}
                            </p>
                            {item.covered_from_closet_quantity != null && item.covered_from_closet_quantity > 0 && (
                              <p className="mt-2 font-body text-xs font-semibold text-forest/65">
                                {item.covered_from_closet_quantity} covered from your Hosting Closet
                              </p>
                            )}
                            {responsibilityLabel && (
                              <p className="mt-2 font-body text-xs text-forest/60">
                                {item.status === "borrow" ? "Borrowing from" : "Responsible"}: {responsibilityLabel}
                              </p>
                            )}
                          </div>

                          <div className="flex min-w-[13rem] flex-col items-stretch gap-3">
                            <ShoppingFulfillmentControl
                              status={item.status}
                              itemName={item.name}
                              provider={item.fulfillment_provider}
                              returnedAt={item.returned_at}
                              guests={workspace.guests}
                              coHosts={workspace.coHosts}
                              setStatus={setCanonicalShoppingStatusWeb.bind(null, params.id, item.id)}
                              assignBorrow={assignCanonicalBorrowWeb.bind(null, params.id, item.id)}
                              setProvider={setCanonicalProviderWeb.bind(null, params.id, item.id)}
                              setReturned={setCanonicalBorrowReturnedWeb.bind(null, params.id, item.id)}
                            />
                            <ActionButton
                              action={deleteCanonicalShoppingItemWeb.bind(null, params.id, item.id)}
                              confirm={`Remove ${item.name} from the list?`}
                              title={`Remove ${item.name}`}
                              className="self-end font-body text-sm text-forest/55 underline decoration-sage/50 underline-offset-4 transition hover:text-error"
                            >
                              Remove
                            </ActionButton>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <AddForm
            label="Add to the list"
            submitLabel="Add item"
            action={addCanonicalShoppingItemWeb.bind(null, params.id)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Item" required placeholder="Ice" />
              <Field name="category" label="Aisle or category" placeholder="Drinks" />
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

          <section className="mt-12 max-w-4xl">
            <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
              From your Hosting Closet
            </p>
            <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
            <h3 className="mt-3 font-display text-xl text-forest">
              Use what you already have first.
            </h3>

            {closetUse.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {closetUse.map((use) => (
                  <li
                    key={use.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-card border border-sage/20 bg-cream px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-base text-forest">
                        {use.item?.name ?? "Something you own"}
                      </p>
                      {use.notes && (
                        <p className="font-body text-sm text-forest/60">{use.notes}</p>
                      )}
                    </div>
                    <p className="font-body text-sm text-forest/65">
                      {use.quantity_planned ?? 1} of{" "}
                      {use.item?.quantity_owned ?? use.quantity_planned ?? 1} available
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 max-w-prose font-body text-base text-forest/70">
                Nothing from your Hosting Closet is attached to this gathering yet.
              </p>
            )}

            <p className="mt-4 rounded-card border border-sage/30 bg-cream px-4 py-3 font-body text-sm leading-relaxed text-forest/75">
              {smartCloset
                ? "Smart matching is active for this gathering. Place & Plenty can compare what you need with what is already in your Hosting Closet and reduce the shopping need accordingly."
                : "Your Hosting Closet is always yours. Smart matching — comparing what you own with what this gathering needs — is available with a Gathering Pass or Place & Plenty Plus."}
            </p>
          </section>
        </>
      ) : (
        <section className="mt-8 max-w-5xl">
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel>
              <MoneyEditor
                label="Gathering budget"
                value={budget.summary.budgetTarget}
                action={updateBudgetTargetWeb.bind(null, params.id)}
              />
            </Panel>
            <Panel>
              <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                Projected
              </p>
              <p className="mt-1 font-display text-3xl text-forest">
                {formatCurrency(budget.summary.projected)}
              </p>
              <p className="mt-1 font-body text-xs text-forest/55">
                What the current buying plan is expected to cost.
              </p>
            </Panel>
            <Panel>
              <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                Remaining
              </p>
              <p className="mt-1 font-display text-3xl text-forest">
                {budget.summary.remaining == null
                  ? "—"
                  : formatCurrency(budget.summary.remaining)}
              </p>
              <p className="mt-1 font-body text-xs text-forest/55">
                Based on the budget and actual expense ledger.
              </p>
            </Panel>
          </div>

          <div className="mt-5 rounded-card border border-gold/30 bg-parchment p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
                  Spent
                </p>
                <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
                <p className="mt-3 font-display text-3xl text-forest">
                  {formatCurrency(budget.summary.spent)}
                </p>
                <p className="mt-1 font-body text-sm text-forest/65">
                  The expense ledger is the source of truth for actual spending.
                </p>
              </div>
              {budget.premium && (
                <div className="min-w-[15rem]">
                  <MoneyEditor
                    label="Manual spent override"
                    value={budget.summary.spentIsOverridden ? budget.summary.spent : null}
                    action={updateSpentOverrideWeb.bind(null, params.id)}
                  />
                  {budget.summary.spentIsOverridden && (
                    <ActionButton
                      action={updateSpentOverrideWeb.bind(null, params.id, null)}
                      className="mt-2 font-body text-xs font-semibold text-forest/65 underline underline-offset-4"
                    >
                      Use calculated spent again
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
          </div>

          {budget.premium && budget.summary.categories.length > 0 && (
            <section className="mt-8">
              <h3 className="font-display text-xl text-forest">Where the plan is going</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {budget.summary.categories.map((category) => (
                  <div key={category.category} className="rounded-card border border-sage/25 bg-offwhite p-4">
                    <p className="font-body text-sm font-semibold text-forest">
                      {category.label ?? category.category}
                    </p>
                    <p className="mt-2 font-body text-sm text-forest/65">
                      {formatCurrency(category.projected)} projected · {formatCurrency(category.spent)} spent
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
                  Expense ledger
                </p>
                <h3 className="mt-2 font-display text-xl text-forest">What you actually paid</h3>
              </div>
              <ExpenseForm action={createExpenseWeb.bind(null, params.id)} />
            </div>

            {budget.expenses.length === 0 ? (
              <EmptyState
                title="No expenses logged yet."
                body="Add purchases, rentals or other gathering costs here. Receipts are optional and can be attached afterward."
              />
            ) : (
              <ul className="mt-5 space-y-3">
                {budget.expenses.map((expense) => (
                  <li key={expense.id} className="rounded-card border border-sage/25 bg-offwhite p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div>
                        <p className="font-body text-base font-semibold text-forest">
                          {expense.merchant || expense.category || "Expense"}
                        </p>
                        <p className="mt-1 font-body text-sm text-forest/60">
                          {expense.expense_date}
                          {expense.category ? ` · ${expense.category}` : ""}
                        </p>
                        {expense.note && (
                          <p className="mt-1 font-body text-sm text-forest/65">{expense.note}</p>
                        )}
                        {expense.receipt_url ? (
                          <a
                            href={expense.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block font-body text-xs font-semibold text-forest underline underline-offset-4"
                          >
                            View receipt
                          </a>
                        ) : (
                          <ReceiptUpload
                            action={attachReceiptWeb.bind(null, params.id, expense.id)}
                          />
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl text-forest">
                          {formatCurrency(expense.amount)}
                        </p>
                        <ActionButton
                          action={deleteExpenseWeb.bind(null, params.id, expense.id)}
                          confirm="Remove this expense from the ledger?"
                          className="mt-2 font-body text-xs text-forest/50 underline underline-offset-4 hover:text-error"
                        >
                          Remove
                        </ActionButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
