import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildInvitationUrl,
  buildInviteMessage,
  cleanHostName,
  buildSmsUri,
  cleanText,
  detectWebPlatform,
  formatInviteWhen,
  MAX_SHARE_MESSAGE_LENGTH,
  pickPartyPhone,
  planShareQueue,
  sanitizeDialableNumber,
} from "../lib/share-by-text.ts";
import { SHARE_BY_TEXT_COPY } from "../lib/share-by-text-copy.ts";

const TOKEN = "3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9b1e44";
const URL_ = `https://placeandplenty.com/invite/${TOKEN}`;

describe("phone handling", () => {
  test("sanitises to digits and a leading plus", () => {
    assert.equal(sanitizeDialableNumber("(555) 123-4567"), "5551234567");
    assert.equal(sanitizeDialableNumber("+1 (555) 123-4567"), "+15551234567");
    assert.equal(sanitizeDialableNumber("555-123-4567 ext. 22"), "5551234567");
  });
  test("rejects unusable numbers and URI syntax cannot survive", () => {
    assert.equal(sanitizeDialableNumber(null), null);
    assert.equal(sanitizeDialableNumber("12345"), null);
    assert.equal(sanitizeDialableNumber("1234567890123456"), null);
    assert.match(sanitizeDialableNumber("5551234567&body=evil") ?? "", /^\+?\d+$/);
  });
  test("picks the first dialable household phone", () => {
    assert.equal(pickPartyPhone([null, "n/a", "555-987-6543"]), "5559876543");
    assert.equal(pickPartyPhone([]), null);
  });
});

describe("link", () => {
  test("uses the existing party token; never guesses", () => {
    assert.equal(buildInvitationUrl(TOKEN), URL_);
    assert.equal(buildInvitationUrl(null), null);
    assert.equal(buildInvitationUrl("nope"), null);
    assert.equal(buildInvitationUrl(TOKEN, "http://placeandplenty.com/invite"), null);
  });
});

describe("message", () => {
  const base = {
    locale: "en" as const,
    url: URL_,
    gatheringName: "Fall Supper",
    hostName: "Alexis",
    guestFirstName: "Maria",
    gatheringDate: "2026-11-21",
    arrivalTime: "17:00:00",
  };
  test("is branded and concise: host, gathering name, then the unique link; nothing private", () => {
    const msg = buildInviteMessage(base);
    assert.equal(
      msg,
      `You have received an invitation from Alexis on Place & Plenty.\nFall Supper\nView the invitation and RSVP: ${URL_}`
    );
    assert.ok(msg.length <= MAX_SHARE_MESSAGE_LENGTH);
    // no guest name, date or time in the shared text (the link page shows what the host chose to show)
    assert.doesNotMatch(msg, /Maria|Nov|5 PM|17:00/);
  });
  test("never claims delivery", () => {
    assert.doesNotMatch(buildInviteMessage(base).toLowerCase(), /delivered|\bread\b|sent you/);
  });
  test("Spanish and missing fields", () => {
    assert.equal(
      buildInviteMessage({ ...base, locale: "es" }),
      `Has recibido una invitación de Alexis en Place & Plenty.\nFall Supper\nVer la invitación y confirmar asistencia: ${URL_}`
    );
    assert.equal(
      buildInviteMessage({ locale: "en", url: URL_, gatheringName: "Fall Supper" }),
      `You have received an invitation on Place & Plenty.\nFall Supper\nView the invitation and RSVP: ${URL_}`
    );
  });
  test("host name is never an email, id or the email local part; missing host is neutral", () => {
    for (const hostName of ["jane@example.com", "3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9b1e44", "   ", "!!!", null, undefined]) {
      const msg = buildInviteMessage({ ...base, hostName });
      assert.ok(msg.startsWith("You have received an invitation on Place & Plenty.\n"), String(hostName));
    }
    assert.equal(cleanHostName("jane.doe", "Jane.Doe@example.com"), null);
    assert.equal(cleanHostName("Jane Doe", "jane.doe@example.com"), "Jane Doe");
    assert.equal(cleanHostName('Al "The <Host>"\r\nBcc: x'), "Al The Host Bcc: x");
    assert.equal(Array.from(cleanHostName("W".repeat(200)) ?? "").length, 40);
  });
  test("unicode, emoji and HTML stay inert text; truncation never splits an emoji", () => {
    const emoji = buildInviteMessage({ ...base, gatheringName: "🎉".repeat(400) });
    assert.ok(Array.from(emoji).length <= MAX_SHARE_MESSAGE_LENGTH);
    assert.doesNotMatch(emoji, /[\ud800-\udbff](?![\udc00-\udfff])/);
    assert.ok(emoji.endsWith(URL_));
    const html = buildInviteMessage({ ...base, gatheringName: "<b>Tom & Jerry's</b> <script>x</script>" });
    assert.ok(html.includes("<b>Tom & Jerry's</b>")); // plain text: SMS never interprets markup, so it is left as typed
  });
  test("long names shorten, link stays; control characters removed", () => {
    const msg = buildInviteMessage({ ...base, gatheringName: "A".repeat(400) });
    assert.ok(msg.length <= MAX_SHARE_MESSAGE_LENGTH);
    assert.ok(msg.includes(URL_));
    assert.equal(cleanText("Fall\nSupper‮  night"), "Fall Supper night");
  });
  test("dates are not shifted by time zone", () => {
    assert.equal(formatInviteWhen("2026-11-21", null, "en"), "Sat, Nov 21");
    assert.equal(formatInviteWhen("soon", null, "en"), null);
  });
});

describe("sms URI", () => {
  const body = "Hi! A & B: https://x.test/a?b=c#d";
  test("iOS uses & and Android/web use ?", () => {
    assert.equal(buildSmsUri({ platform: "ios", phone: "+15551234567", body }), `sms:+15551234567&body=${encodeURIComponent(body)}`);
    assert.equal(buildSmsUri({ platform: "android", phone: "5551234567", body }), `sms:5551234567?body=${encodeURIComponent(body)}`);
    assert.equal(buildSmsUri({ platform: "web", phone: "5551234567", body }), `sms:5551234567?body=${encodeURIComponent(body)}`);
  });
  test("no phone opens an empty composer", () => {
    assert.equal(buildSmsUri({ platform: "ios", body: "x" }), "sms:&body=x");
    assert.equal(buildSmsUri({ platform: "android", phone: null, body: "x" }), "sms:?body=x");
  });
  test("body cannot inject parameters or recipients", () => {
    const uri = buildSmsUri({ platform: "android", phone: "5551234567", body: "a&body=b,c?d" });
    assert.equal(uri.split("?").length, 2);
    assert.ok(!uri.includes("&"));
  });
  test("web platform detection", () => {
    assert.equal(detectWebPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "ios");
    assert.equal(detectWebPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
    assert.equal(detectWebPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "web");
    assert.equal(detectWebPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "android");
  });
});

describe("bulk vs individual", () => {
  const T2 = "7d1e0c52-1b2a-4c33-9d44-0a1b2c3d4e5f";
  test("one private link per household, no duplicate households", () => {
    const { queue, skipped, withoutPhone } = planShareQueue([
      { partyId: "p1", token: TOKEN, phones: ["555-123-4567"] },
      { partyId: "p1", token: TOKEN, phones: ["555-765-4321"] },
      { partyId: "p2", token: T2, phones: [] },
      { partyId: "p3", token: null, phones: ["555-123-4567"] },
    ]);
    assert.equal(queue.length, 2);
    assert.equal(new Set(queue.map((q) => q.url)).size, 2);
    assert.equal(withoutPhone, 1);
    assert.deepEqual(skipped, [{ partyId: "p3", reason: "no_link" }]);
  });
});

describe("host copy and wiring", () => {
  test("English and Spanish strings never claim sent/delivered/read", () => {
    for (const locale of ["en", "es"] as const) {
      const c = SHARE_BY_TEXT_COPY[locale];
      for (const [key, value] of Object.entries(c)) {
        if (typeof value !== "string") continue;
        const v = value.replace(/whether it was delivered or read/i, "").replace(/si se entregó o se leyó/i, "");
        assert.doesNotMatch(v, /\b(was|has been|ha sido|fue) (sent|delivered|read|enviad|entregad)/i, key);
      }
    }
    assert.match(SHARE_BY_TEXT_COPY.en.opened, /Nothing is sent until you press Send/);
  });
  test("web action never touches guests, parties or RSVP tables", () => {
    const src = readFileSync(new URL("../lib/share-by-text-actions.ts", import.meta.url), "utf8");
    assert.match(src, /record_invitation_share_initiated/);
    assert.doesNotMatch(src, /\.from\(|\.insert\(|\.update\(|\.delete\(/);
  });
  test("people page renders the button for the household lead only and never when archived", () => {
    const src = readFileSync(new URL("../app/(host)/host/g/[id]/people/page.tsx", import.meta.url), "utf8");
    assert.match(src, /isPartyLead && g\.party && !isArchived && \(\s*<ShareByTextButton/);
  });
});
