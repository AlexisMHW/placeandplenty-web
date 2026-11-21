/**
 * SHARE BY TEXT -- pure helpers (no React Native, no network, no Supabase).
 *
 * The host's OWN messaging app sends the message. Place & Plenty only
 * prepares the text and the link and hands them to the operating system.
 * Nothing here can know whether the host pressed Send, whether the carrier
 * delivered the text, or whether the guest read it, so no function or
 * string in this feature may claim otherwise.
 *
 * The link is the party's existing invitation link
 * (`<base>/<invitation_parties.public_token>`): the guest lands on the
 * existing branded invitation page, which renders the CURRENT artwork and
 * RSVP form live. This file never creates a token, guest or party.
 *
 * Kept byte-for-byte parallel with the web copy at lib/share-by-text.ts.
 */

export type ShareLocale = 'en' | 'es';
export type SharePlatform = 'ios' | 'android' | 'web';

export const DEFAULT_GUEST_INVITE_BASE_URL = 'https://placeandplenty.com/invite';

/** Above this, shorten the gathering name. Longer texts are legal but read as spam. */
export const MAX_SHARE_MESSAGE_LENGTH = 300;

const TOKEN_PATTERN = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

/** Collapses whitespace and strips control / bidi characters from host-supplied text. */
export function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lenient "can a phone dial this" check. This is NOT E.164 normalisation
 * (that belongs to the paid-SMS provider path, which needs a country
 * default and consent). Returns the number with only a leading "+" and
 * digits, or null when it cannot plausibly be dialled.
 */
export function sanitizeDialableNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const withoutExtension = raw.replace(/\s*(?:ext\.?|extension|x|#)\s*\d+\s*$/i, '');
  const hasPlus = withoutExtension.trim().startsWith('+');
  const digits = withoutExtension.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${hasPlus ? '+' : ''}${digits}`;
}

/** First dialable number among a household's people, preserving order. */
export function pickPartyPhone(phones: Array<string | null | undefined>): string | null {
  for (const phone of phones) {
    const dialable = sanitizeDialableNumber(phone);
    if (dialable) return dialable;
  }
  return null;
}

/** Builds `<base>/<token>`; null if the token is not a UUID (never guess a link). */
export function buildInvitationUrl(
  token: string | null | undefined,
  baseUrl: string = DEFAULT_GUEST_INVITE_BASE_URL
): string | null {
  if (!token || !TOKEN_PATTERN.test(token.trim())) return null;
  const base = (baseUrl || DEFAULT_GUEST_INVITE_BASE_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) return null;
  return `${base}/${token.trim()}`;
}

function formatTime12h(time: string | null | undefined, locale: ShareLocale): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23) return null;
  if (locale === 'es') return `${hours}:${minutes}`;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === '00' ? `${h12} ${suffix}` : `${h12}:${minutes} ${suffix}`;
}

/** `date` is a calendar date (YYYY-MM-DD); it is never shifted by the device time zone. */
export function formatInviteWhen(
  date: string | null | undefined,
  time: string | null | undefined,
  locale: ShareLocale
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!match) return null;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(utc.getTime())) return null;
  const day = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(utc);
  const at = formatTime12h(time, locale);
  if (!at) return day;
  return locale === 'es' ? `${day}, ${at} h` : `${day}, ${at}`;
}

export interface InviteMessageInput {
  locale: ShareLocale;
  url: string;
  gatheringName: string;
  /** The host's preferred display name (profile). Missing, an email address or an id => neutral wording, never shown raw. */
  hostName?: string | null;
  /** The host's account email, used only to reject a "display name" that is really the email's local part. Never shown. */
  accountEmail?: string | null;
  /** @deprecated No longer part of the text (a shared message carries no date, time or guest name). Accepted so callers keep compiling. */
  guestFirstName?: string | null;
  /** @deprecated see guestFirstName. */
  gatheringDate?: string | null;
  /** @deprecated see guestFirstName. */
  arrivalTime?: string | null;
}

/** Longest host name shown in a shared message. */
export const MAX_SHARE_HOST_NAME = 40;

function truncate(value: string, max: number): string {
  // By code point: never splits an emoji / surrogate pair.
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  return `${chars.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`;
}

/**
 * The host's name as a guest should see it, or null. Same rules as supabase/functions/_shared/invitationPresentation.ts
 * sanitizeHostName (parity-tested): cleaned, quotes / angle brackets removed, capped, and null for an email address, an id / UUID,
 * the email's local part, or something with no letter or digit in it.
 */
export function cleanHostName(raw: string | null | undefined, accountEmail?: string | null): string | null {
  const cleaned = cleanText(raw).replace(/["<>\\`]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.includes('@')) return null;
  if (/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i.test(cleaned) || /^[0-9a-f]{20,}$/i.test(cleaned.replace(/[\s-]/g, ''))) return null;
  const email = (accountEmail ?? '').trim();
  const at = email.indexOf('@');
  if (at > 0) {
    // handle_new_user seeds display_name with the email's local part: exact (case-insensitive) match only.
    const local = email.slice(0, at).toLowerCase();
    if (local.length >= 3 && cleaned.toLowerCase() === local) return null;
  }
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return null;
  return truncate(cleaned, MAX_SHARE_HOST_NAME);
}

/**
 * The branded invitation text for the host's own messaging app / share sheet. Plain text, one link, no emoji of ours, no claim about
 * delivery, and nothing private: no date, time, address or guest name.
 *
 *   You have received an invitation from [Host] on Place & Plenty.
 *   [Gathering name]
 *   View the invitation and RSVP: [unique invitation URL]
 *
 * No usable host name => "You have received an invitation on Place & Plenty." Over MAX_SHARE_MESSAGE_LENGTH only the gathering
 * name is shortened; the link is never cut.
 */
export function buildInviteMessage(input: InviteMessageInput): string {
  const { locale, url } = input;
  const host = cleanHostName(input.hostName, input.accountEmail);

  const compose = (name: string): string => {
    if (locale === 'es') {
      const opening = host ? `Has recibido una invitación de ${host} en Place & Plenty.` : 'Has recibido una invitación en Place & Plenty.';
      return `${opening}\n${name}\nVer la invitación y confirmar asistencia: ${url}`;
    }
    const opening = host ? `You have received an invitation from ${host} on Place & Plenty.` : 'You have received an invitation on Place & Plenty.';
    return `${opening}\n${name}\nView the invitation and RSVP: ${url}`;
  };

  let name = cleanText(input.gatheringName) || (locale === 'es' ? 'una reunión' : 'a gathering');
  let message = compose(name);
  const length = (s: string) => Array.from(s).length;
  if (length(message) > MAX_SHARE_MESSAGE_LENGTH) {
    const overflow = length(message) - MAX_SHARE_MESSAGE_LENGTH;
    name = truncate(name, Math.max(12, length(name) - overflow));
    message = compose(name);
  }
  return message;
}

/**
 * Builds the `sms:` URI for ONE recipient (or none).
 *  - iOS separates the body with "&", Android with "?".
 *  - Web follows the same rule from the user agent (see detectWebPlatform).
 *  - No recipient: the composer opens empty so the host can pick a contact.
 * The body is percent-encoded; the number is already digits and "+".
 */
export function buildSmsUri(params: { platform: SharePlatform; phone?: string | null; body: string }): string {
  const phone = sanitizeDialableNumber(params.phone) ?? '';
  const separator = params.platform === 'ios' ? '&' : '?';
  return `sms:${phone}${separator}body=${encodeURIComponent(params.body)}`;
}

/** iPadOS 13+ reports itself as "Macintosh" with touch points; callers may pass maxTouchPoints. */
export function detectWebPlatform(userAgent: string, maxTouchPoints = 0): SharePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'web';
}

export type ShareSkipReason = 'no_link' | 'no_phone';

export interface ShareCandidate {
  partyId: string;
  token: string | null | undefined;
  phones: Array<string | null | undefined>;
}

export interface ShareQueueItem {
  partyId: string;
  url: string;
  phone: string | null;
}

/**
 * Bulk = a step-through queue with ONE composer per household. A single
 * group text is deliberately not offered: every household has its own
 * private link, and putting one link in a group thread would expose it
 * (and the RSVP it controls) to everyone in that thread.
 * Parties with no phone stay in the queue (the host picks a contact);
 * parties with no valid token are reported so nothing is silently dropped.
 */
export function planShareQueue(
  candidates: ShareCandidate[],
  baseUrl: string = DEFAULT_GUEST_INVITE_BASE_URL
): { queue: ShareQueueItem[]; skipped: Array<{ partyId: string; reason: ShareSkipReason }>; withoutPhone: number } {
  const seen = new Set<string>();
  const queue: ShareQueueItem[] = [];
  const skipped: Array<{ partyId: string; reason: ShareSkipReason }> = [];
  let withoutPhone = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.partyId)) continue; // one entry per party, never per person
    seen.add(candidate.partyId);
    const url = buildInvitationUrl(candidate.token, baseUrl);
    if (!url) {
      skipped.push({ partyId: candidate.partyId, reason: 'no_link' });
      continue;
    }
    const phone = pickPartyPhone(candidate.phones);
    if (!phone) withoutPhone += 1;
    queue.push({ partyId: candidate.partyId, url, phone });
  }
  return { queue, skipped, withoutPhone };
}
