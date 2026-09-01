import Link from "next/link";
import Icon from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";
import type { CanonicalNextUpAction, NextUpTarget } from "@/lib/next-up";

function hrefFor(base: string, target: NextUpTarget | null): string | null {
  if (!target) return null;
  switch (target) {
    case "overview":
      return base;
    case "hub":
      return `${base}/hub`;
    case "table":
      return `${base}/table`;
    case "shopping":
      return `${base}/shopping`;
    case "people":
      return `${base}/people`;
    case "space_mode":
      return `${base}/space-mode`;
    case "host_mode":
      return `${base}/host-mode`;
  }
}

function labelFor(action: CanonicalNextUpAction): string {
  switch (action.key) {
    case "overdue_critical":
      return `${action.count ?? 1} critical ${action.count === 1 ? "task is" : "tasks are"} overdue`;
    case "weather_risk":
      return "Review the weather plan";
    case "invite_people":
      return "Add your people";
    case "confirm_rsvps":
      return `${action.count ?? 0} ${action.count === 1 ? "person is" : "people are"} still waiting to reply`;
    case "category_gap":
      switch (action.category) {
        case "food_beverage":
          return "Keep working on food and the table";
        case "prep_cooking":
          return "Keep moving prep and cooking forward";
        case "shopping_supplies":
          return "Keep moving your shopping list forward";
        case "space_seating":
          return "Keep working on the space and seating";
        case "people_headcount":
          return "Keep tightening up the guest count";
        case "home_essentials":
          return "Finish the remaining home essentials";
        case "host_personal":
          return "Take care of the last host-ready details";
        default:
          return "Keep your plan moving";
      }
    case "review_host_mode":
      return "Open Host Mode for the day";
    case "ready":
      return "You’re in good shape right now.";
  }
}

export default function NextUpPanel({
  actions,
  base,
}: {
  actions: CanonicalNextUpAction[];
  base: string;
}) {
  if (actions.length === 0) return null;
  const readyOnly = actions.length === 1 && actions[0].key === "ready";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-sage/25 bg-cream p-6">
      <BotanicalSprig
        className="pointer-events-none absolute -right-3 -top-2 text-olive/35"
        size={92}
      />
      <p className="relative font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
        Next Up
      </p>
      <span aria-hidden className="relative mt-3 block h-[2px] w-12 bg-gold" />
      <h2 className="relative mt-3 font-display text-lg text-forest">
        {readyOnly ? "Nothing is pressing." : "What matters next"}
      </h2>

      <ul className="relative mt-4 space-y-2">
        {actions.map((action, index) => {
          const href = hrefFor(base, action.target);
          const row = (
            <div className="flex items-start gap-3 rounded-xl border border-sage/20 bg-offwhite/70 px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-parchment text-forest">
                <Icon name={action.key === "ready" ? "check" : "arrow-right"} size={14} />
              </span>
              <span className="font-body text-sm leading-relaxed text-forest/85">
                {labelFor(action)}
              </span>
            </div>
          );

          return (
            <li key={`${action.key}:${action.category ?? ""}:${index}`}>
              {href ? (
                <Link href={href} className="block rounded-xl outline-none transition hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-forest/20">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
