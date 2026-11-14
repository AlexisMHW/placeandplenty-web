// PUBLIC TEMPLATE API (web). Other streams (Hosting Collective approve/decline, Command Center) call renderTemplate();
// they never build message text themselves. Pure and deterministic.
//
// NOTHING IS INVENTED: business wording/cadence that is still an owner decision (support@ footer wording, reminder timing and
// text) must be supplied through TemplateConfig. When it is missing the template returns { ok:false, error } rather than a default.
import { applicationApprovedMessage, applicationDeclinedMessage } from "../hc/notifications.ts";

export interface TemplateConfig {
  /** Approved footer/support wording. Absent => no footer line is added (nothing made up). */
  supportLine?: string;
  /** Required for reminder templates; owner-approved wording. */
  reminder?: { subject: string; body: string };
  /** Base URL for links (e.g. the web origin). Required for templates that carry a link. */
  baseUrl?: string;
}
export type TemplateId = "hc_application_approved" | "hc_application_declined" | "gathering_reminder" | "founder_notification";
export type TemplateResult =
  | { ok: true; subject: string; text: string }
  | { ok: false; error: "unknown_template" | "missing_variable" | "missing_config" };

const oneLine = (s: unknown, max = 80) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
const withSupport = (text: string, cfg: TemplateConfig) => (cfg.supportLine?.trim() ? `${text}\n\n${cfg.supportLine.trim()}` : text);

export function renderTemplate(id: TemplateId | string, vars: Record<string, unknown>, cfg: TemplateConfig = {}): TemplateResult {
  switch (id) {
    case "hc_application_approved": {
      if (!cfg.baseUrl) return { ok: false, error: "missing_config" };
      const m = applicationApprovedMessage(oneLine(vars.displayName), `${cfg.baseUrl.replace(/\/$/, "")}/creator`);
      return { ok: true, subject: m.subject, text: m.text };
    }
    case "hc_application_declined": {
      const m = applicationDeclinedMessage(oneLine(vars.displayName), typeof vars.note === "string" ? vars.note : null);
      return { ok: true, subject: m.subject, text: m.text };
    }
    case "gathering_reminder": {
      if (!cfg.reminder?.subject?.trim() || !cfg.reminder?.body?.trim()) return { ok: false, error: "missing_config" };
      if (!vars.gatheringName) return { ok: false, error: "missing_variable" };
      const fill = (s: string) => s.replace(/\{gatheringName\}/g, oneLine(vars.gatheringName, 120)).replace(/\{hostName\}/g, oneLine(vars.hostName ?? "your host"));
      return { ok: true, subject: fill(cfg.reminder.subject), text: withSupport(fill(cfg.reminder.body), cfg) };
    }
    case "founder_notification": {
      // Minimal-data body: category label, severity, count and a link only. No names, emails, amounts or free text.
      if (!cfg.baseUrl) return { ok: false, error: "missing_config" };
      if (!vars.categoryLabel || !vars.severity || !vars.inboxId) return { ok: false, error: "missing_variable" };
      const count = Number(vars.count ?? 1);
      const link = `${cfg.baseUrl.replace(/\/$/, "")}/command-center/inbox/${encodeURIComponent(String(vars.inboxId))}`;
      return {
        ok: true,
        subject: `[Place & Plenty] ${oneLine(vars.categoryLabel, 60)}`,
        text: [`${oneLine(vars.categoryLabel, 60)} (${oneLine(vars.severity, 16)})${count > 1 ? `, ${count} occurrences` : ""}.`, "", "Sign in to the Command Center to review:", link].join("\n"),
      };
    }
    default:
      return { ok: false, error: "unknown_template" };
  }
}
