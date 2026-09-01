"use client";

import { useMemo, useState, useTransition } from "react";
import type { SavedRecipeOption } from "@/lib/recipe-source-data";
import {
  applyPreparedRecipeSourceWeb,
  applySavedRecipeSourceWeb,
  applySelfManagedRecipeSourceWeb,
  approveSuggestedRecipeWeb,
  assignBringingRecipeSourceWeb,
  createRecipeAndApplyWeb,
  suggestRecipeWeb,
  type SuggestedRecipeDraft,
} from "@/lib/recipe-source-actions";

type Mode =
  | "closed"
  | "saved"
  | "create"
  | "suggested"
  | "prepared"
  | "bringing";

type IngredientDraft = { name: string; quantity: string; unit: string };

export function RecipeSourceEditor({
  gatheringId,
  item,
  recipes,
  guests,
  coHosts,
  dietaryNeeds,
  accessibilityNeeds,
}: {
  gatheringId: string;
  item: {
    id: string;
    name: string;
    recipe_source: string;
    recipe_id: string | null;
    prepared_item_description: string | null;
    servings_planned: number | null;
    servings_recommended: number | null;
  };
  recipes: SavedRecipeOption[];
  guests: Array<{ id: string; label: string }>;
  coHosts: Array<{ id: string; label: string }>;
  dietaryNeeds: string[];
  accessibilityNeeds: string[];
}) {
  const [mode, setMode] = useState<Mode>("closed");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState(item.prepared_item_description ?? "");
  const [assignee, setAssignee] = useState("");
  const [recipeName, setRecipeName] = useState(item.name);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { name: "", quantity: "", unit: "" },
  ]);
  const [instructions, setInstructions] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestedRecipeDraft | null>(null);

  const targetServings = item.servings_planned ?? item.servings_recommended ?? 1;
  const currentLabel = useMemo(() => {
    switch (item.recipe_source) {
      case "saved_recipe": return "Saved recipe";
      case "suggested_recipe": return "Place & Plenty suggested recipe";
      case "prepared_item": return "Prepared item";
      case "bringing_guest": return "Someone else is bringing it";
      case "self_managed": return "You’re handling this your own way";
      default: return "Choose how you’re making this";
    }
  }, [item.recipe_source]);

  function finish(result: { ok: boolean; message?: string }) {
    if (result.ok) {
      setMode("closed");
      setError(null);
    } else setError(result.message ?? "That didn’t save.");
  }

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    start(async () => finish(await action()));
  }

  function cleanIngredients(rows: IngredientDraft[]) {
    return rows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity.trim() ? Number(row.quantity) : undefined,
        unit: row.unit.trim() || undefined,
      }));
  }

  return (
    <div className="mt-4 rounded-xl border border-sage/20 bg-cream/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">How are you making it?</p>
          <p className="mt-1 font-body text-sm text-forest/75">{currentLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setMode(mode === "closed" ? "saved" : "closed")}
          className="rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest"
        >
          {mode === "closed" ? "Choose source" : "Close"}
        </button>
      </div>

      {mode !== "closed" && (
        <div className="mt-4 border-t border-sage/20 pt-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["saved", "Use my recipe"],
              ["create", "Create a recipe"],
              ["suggested", "Suggest a simple recipe"],
              ["prepared", "Prepared item"],
              ["bringing", "Someone else is bringing it"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setMode(value as Mode); setError(null); }}
                className={`rounded-full px-3.5 py-2 font-body text-xs font-semibold ${mode === value ? "bg-forest text-offwhite" : "border border-sage/35 bg-offwhite text-forest"}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => applySelfManagedRecipeSourceWeb(gatheringId, item.id))}
              className="rounded-full border border-sage/35 bg-offwhite px-3.5 py-2 font-body text-xs font-semibold text-forest disabled:opacity-50"
            >
              I’ll handle it myself
            </button>
          </div>

          {mode === "saved" && (
            <div className="mt-4 space-y-2">
              {recipes.length === 0 ? (
                <p className="font-body text-sm text-forest/65">You don’t have a saved recipe yet. Create one here and it will be available again later.</p>
              ) : recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => applySavedRecipeSourceWeb(gatheringId, item.id, recipe.id))}
                  className="flex w-full items-center justify-between rounded-xl border border-sage/25 bg-offwhite px-4 py-3 text-left disabled:opacity-50"
                >
                  <span className="font-body text-sm text-forest">{recipe.name}</span>
                  <span className="font-body text-xs text-forest/50">{recipe.source === "ai_suggested" ? "P&P suggested" : recipe.base_servings ? `${recipe.base_servings} servings` : "Saved"}</span>
                </button>
              ))}
            </div>
          )}

          {mode === "create" && (
            <div className="mt-4 space-y-3">
              <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Recipe name" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
              {ingredients.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
                  <input value={row.name} onChange={(e) => setIngredients((prev) => prev.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} placeholder="Ingredient" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
                  <input value={row.quantity} onChange={(e) => setIngredients((prev) => prev.map((x, i) => i === index ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" type="number" step="any" min="0" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
                  <input value={row.unit} onChange={(e) => setIngredients((prev) => prev.map((x, i) => i === index ? { ...x, unit: e.target.value } : x))} placeholder="Unit" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
                  <button type="button" onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== index))} className="font-body text-xs text-forest/55">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }])} className="font-body text-sm font-semibold text-forest">+ Add ingredient</button>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Optional brief instructions" rows={3} className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => createRecipeAndApplyWeb(gatheringId, item.id, { name: recipeName, baseServings: targetServings, instructions, ingredients: cleanIngredients(ingredients) }))}
                className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
              >
                Save recipe & use it
              </button>
            </div>
          )}

          {mode === "prepared" && (
            <div className="mt-4 flex flex-wrap gap-3">
              <input value={prepared} onChange={(e) => setPrepared(e.target.value)} placeholder="Bakery tray, store-bought lasagna…" className="min-w-[16rem] flex-1 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
              <button type="button" disabled={pending || !prepared.trim()} onClick={() => run(() => applyPreparedRecipeSourceWeb(gatheringId, item.id, prepared))} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Use prepared item</button>
            </div>
          )}

          {mode === "bringing" && (
            <div className="mt-4 flex flex-wrap gap-3">
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="min-w-[16rem] flex-1 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest">
                <option value="">Choose a person</option>
                {guests.map((guest) => <option key={`guest:${guest.id}`} value={`guest:${guest.id}`}>{guest.label}</option>)}
                {coHosts.map((member) => <option key={`co_host:${member.id}`} value={`co_host:${member.id}`}>{member.label} · co-host</option>)}
              </select>
              <button
                type="button"
                disabled={pending || !assignee}
                onClick={() => {
                  const [type, id] = assignee.split(":", 2) as ["guest" | "co_host", string];
                  run(() => assignBringingRecipeSourceWeb(gatheringId, item.id, type, id));
                }}
                className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
              >
                Assign it
              </button>
            </div>
          )}

          {mode === "suggested" && (
            <div className="mt-4">
              {!suggestion ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    start(async () => {
                      const result = await suggestRecipeWeb({ gatheringId, dishName: item.name, targetServings, dietaryNeeds, accessibilityNeeds });
                      if (result.ok) setSuggestion(result.value);
                      else setError(result.message);
                    });
                  }}
                  className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
                >
                  {pending ? "Working…" : "Suggest a recipe"}
                </button>
              ) : (
                <div className="rounded-xl border border-gold/30 bg-parchment p-4">
                  <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-forest/55">Place & Plenty suggestion</p>
                  <ul className="mt-3 space-y-1.5 font-body text-sm text-forest/80">
                    {suggestion.ingredients.map((ingredient, index) => <li key={`${ingredient.name}:${index}`}>{ingredient.quantity ?? ""} {ingredient.unit ?? ""} {ingredient.name}</li>)}
                  </ul>
                  {suggestion.instructions && <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">{suggestion.instructions}</p>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" disabled={pending} onClick={() => run(() => approveSuggestedRecipeWeb(gatheringId, item.id, item.name, { ...suggestion, baseServings: targetServings }))} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Approve & use it</button>
                    <button type="button" onClick={() => setSuggestion(null)} className="font-body text-sm text-forest/65">Try again</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p role="alert" className="mt-3 font-body text-sm text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
