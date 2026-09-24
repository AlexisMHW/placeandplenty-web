import { getChecklist, checklistPdf } from "./checklists.ts";

import { checklistSignupUrl } from "./checklist-flow.ts";

type Config = { supabaseUrl?: string; anonKey?: string; brevoKey?: string; sender?: string; listIds?: Partial<Record<string, string>>; mailerliteKey?: string; mailerliteGroupIds?: Partial<Record<string, string>> };
const htmlEscape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Isolated for mocked transport tests. Never log form content or provider responses. */
export async function deliverChecklist(body: unknown, ip: string, config: Config, transport: typeof fetch = fetch): Promise<Response> {
  if (!body || typeof body !== "object") return reply({ message: "Please check your details." }, 400);
  const data = body as Record<string, unknown>;
  const kit = typeof data.edition === "string" ? getChecklist(data.edition) : undefined;
  const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!kit || !firstName || firstName.length > 120 || email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof data.consent !== "boolean") return reply({ message: "Please add your first name and a valid email address." }, 400);
  const download = checklistPdf(kit.slug);
  const signupUrl = `https://placeandplenty.com${checklistSignupUrl(kit.slug)}`;
  if (typeof data.website === "string" && data.website.trim()) return reply({ download, emailSent: false });
  if (!config.supabaseUrl || !config.anonKey) return reply({ message: "Checklist signup is temporarily unavailable. Please try again shortly." }, 503);

  try {
    // Preserve the existing server-side limiter and canonical lead insert.
    const saved = await transport(`${config.supabaseUrl}/functions/v1/public-form-submit`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", apikey: config.anonKey, "x-forwarded-for": ip, "user-agent": "placeandplenty-checklist-v1" },
      body: JSON.stringify({ formType: "guest_list", data: { first_name: firstName, email, upcoming_gathering_type: kit.name, source: `checklist_${kit.slug}`, consent: data.consent, website: "" } }),
    });
    if (!saved.ok) return reply({ message: saved.status === 429 ? "You've made several requests. Please try again in a little while." : "We couldn't save your request. Please try again." }, saved.status === 429 ? 429 : 502);
    const confirmation = await saved.json().catch(() => null);
    if (confirmation?.success !== true) return reply({ message: "We couldn't confirm your request. Please try again." }, 502);
  } catch { return reply({ message: "We couldn't save your request. Please try again." }, 502); }

  // Downloads remain available if the email provider is unavailable.
  let emailSent = false;
  let newsletterSynced = false;
  if (config.brevoKey && config.sender) {
    const headers = { "Content-Type": "application/json", "api-key": config.brevoKey };
    const url = `https://placeandplenty.com${download}`;
    try {
      const sent = await transport("https://api.brevo.com/v3/smtp/email", {
        method: "POST", signal: AbortSignal.timeout(10000), headers,
        body: JSON.stringify({ sender: { email: config.sender, name: "Alexis | Place & Plenty" }, replyTo: { email: "alexis@placeandplenty.com", name: "Alexis" }, to: [{ email, name: firstName }], subject: `Your ${kit.name} checklist is here`,
          textContent: `Hi ${firstName},\n\nHere is your Put-Together Get-Together Starter Kit - ${kit.name} Edition:\n${url}\n\n${kit.note}\n\nI built it for you because I needed it too. I hope this gives you a little less to keep in your head.\n\nWhen you're ready, you can organize your gathering on the website: ${signupUrl}\n\nWarmly,\nAlexis Hughes-Williams\nPlace & Plenty | Home Hosting. Made Simple.\n\nYou received this email because you requested this free checklist.`,
          htmlContent: `<div style="font-family:Arial,sans-serif;color:#244438;max-width:580px;margin:auto;line-height:1.7;padding:24px"><p>Hi ${htmlEscape(firstName)},</p><h1 style="font-family:Georgia,serif;font-size:28px">Your ${kit.name} checklist is here.</h1><p>The Put-Together Get-Together Starter Kit is ready for you.</p><p><a style="color:#244438;font-weight:bold" href="${url}">Download your free ${kit.name} checklist</a></p><p>${htmlEscape(kit.note)}</p><p><strong>I built it for you because I needed it too.</strong> I hope this gives you a little less to keep in your head.</p><p>When you're ready, <a href="${signupUrl}">start planning on the website</a>. No app download needed.</p><p>Warmly,<br>Alexis Hughes-Williams<br>Place &amp; Plenty<br>Home Hosting. Made Simple.</p><p style="font-size:12px">You received this email because you requested this free checklist.</p></div>`,
          tags: [`checklist_${kit.slug}`],
        }),
      });
      emailSent = sent.ok;
      if (!sent.ok) console.warn("checklist_email_not_accepted", { edition: kit.slug, status: sent.status });
    } catch { console.warn("checklist_email_unavailable", { edition: kit.slug }); }

    const listId = Number(config.listIds?.[kit.slug]);
    if (!config.mailerliteKey && data.consent === true && Number.isSafeInteger(listId) && listId > 0) {
      try {
        const synced = await transport("https://api.brevo.com/v3/contacts", { method: "POST", signal: AbortSignal.timeout(10000), headers,
          // Add this edition's list; never reset suppression or remove previous lists.
          body: JSON.stringify({ email, attributes: { FIRSTNAME: firstName }, listIds: [listId], updateEnabled: true }),
        });
        newsletterSynced = synced.ok;
        if (!synced.ok) console.warn("checklist_newsletter_sync_failed", { edition: kit.slug, status: synced.status });
      } catch { console.warn("checklist_newsletter_sync_unavailable", { edition: kit.slug }); }
    }
  }
  const groupId = config.mailerliteGroupIds?.[kit.slug];
  if (data.consent === true && config.mailerliteKey && groupId && /^\d+$/.test(groupId)) {
    try {
      const synced = await transport("https://connect.mailerlite.com/api/subscribers", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${config.mailerliteKey}` },
        // Upsert adds this group without removing others. Never force re-subscription.
        body: JSON.stringify({ email, fields: { name: firstName }, groups: [groupId] }),
      });
      newsletterSynced = synced.ok;
      if (!synced.ok) console.warn("checklist_mailerlite_sync_failed", { edition: kit.slug, status: synced.status });
    } catch { console.warn("checklist_mailerlite_unavailable", { edition: kit.slug }); }
  }
  return reply({ download, emailSent, newsletterSynced, emailConfigured: Boolean(config.brevoKey && config.sender) });
}
