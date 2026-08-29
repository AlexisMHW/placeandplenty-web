// THE LINE-ICON SET, drawn to the approved references.
//
// Every reference page uses the same icon language and it is specific:
// fine single-weight strokes, round caps, generous internal space, drawn
// at 24 and shown between 20 and 40. Not filled glyphs, not duotone, not
// a third-party icon font. The references' icons sit next to Playfair
// Display at small sizes, and a heavier or busier stroke reads as UI
// chrome next to that serif rather than as part of the same drawing.
//
// WHY THIS IS ONE FILE AND NOT A DEPENDENCY. An icon package brings a
// house style with it, and the house style is the thing being matched
// here. It would also ship several hundred glyphs to render fourteen.
//
// STROKE WIDTH IS 1.25 AT 24x24 and does not scale with the icon. That
// is deliberate: at 40px a proportional stroke would go heavy and stop
// matching the botanical linework beside it, which is drawn at a fixed
// hairline for the same reason.
//
// All icons are aria-hidden. Every one on the site sits beside a text
// label that carries the meaning; an icon that had to be announced would
// be a labelling bug, not an alt-text opportunity.

export type IconName =
  | "envelope"
  | "rsvp"
  | "dish"
  | "book"
  | "cart"
  | "closet"
  | "table"
  | "people"
  | "cohosts"
  | "sparkle"
  | "music"
  | "board"
  | "camera"
  | "search"
  | "bell"
  | "calendar"
  | "clock"
  | "pin"
  | "heart"
  | "check"
  | "house"
  | "lock"
  | "card"
  | "laptop"
  | "phone"
  | "qr"
  | "leaf"
  | "gauge"
  | "chat"
  | "info"
  | "plus"
  | "arrow"
  | "gift"
  | "cake"
  | "grid"
  | "sun"
  | "users"
  | "photo"
  | "settings";

const PATHS: Record<IconName, JSX.Element> = {
  envelope: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.9 6.3L12 13l9.1-6.7" />
    </>
  ),
  rsvp: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.9 6.3L12 13l9.1-6.7" />
      <path d="M8.6 15.4l2 2 4.2-4.4" />
    </>
  ),
  dish: (
    <>
      <path d="M3 16h18" />
      <path d="M4.5 16a7.5 7.5 0 0115 0" />
      <path d="M12 5.6v2.9" />
      <circle cx="12" cy="4.6" r="1" />
      <path d="M4.5 19h15" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.6C10.3 5.3 8.2 4.7 5.5 4.9A1 1 0 004.6 5.9v11.4a1 1 0 001.05 1c2.4-.15 4.4.4 6.35 1.7" />
      <path d="M12 6.6c1.7-1.3 3.8-1.9 6.5-1.7a1 1 0 01.9 1v11.4a1 1 0 01-1.05 1c-2.4-.15-4.4.4-6.35 1.7" />
      <path d="M12 6.6V20" />
    </>
  ),
  cart: (
    <>
      <path d="M2.6 3.7h2.2l2.3 10.4a1.6 1.6 0 001.56 1.25h8.2a1.6 1.6 0 001.56-1.22L20 7.2H5.8" />
      <circle cx="9.4" cy="19.4" r="1.35" />
      <circle cx="16.9" cy="19.4" r="1.35" />
    </>
  ),
  closet: (
    <>
      <rect x="3.8" y="3" width="16.4" height="18" rx="1.6" />
      <path d="M12 3v18" />
      <path d="M10.1 11.4v1.8M13.9 11.4v1.8" />
      <path d="M3.8 8.6h16.4" />
    </>
  ),
  table: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M5 4.2v4.2a1.6 1.6 0 003.2 0V4.2M6.6 8.4V20" />
      <path d="M17.6 4.2c-1 1.5-1.3 3-1.1 4.6h2.2c.2-1.6-.1-3.1-1.1-4.6zM17.6 9V20" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3.6 19.4a5.6 5.6 0 0110.8 0" />
      <path d="M16 5.6a3 3 0 010 5.4" />
      <path d="M17.2 14.3a5.6 5.6 0 013.2 5.1" />
    </>
  ),
  cohosts: (
    <>
      <circle cx="7.6" cy="8.4" r="2.7" />
      <circle cx="16.4" cy="8.4" r="2.7" />
      <path d="M2.8 19.2a4.9 4.9 0 019.6 0" />
      <path d="M11.6 19.2a4.9 4.9 0 019.6 0" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.2l1.7 4.6 4.6 1.7-4.6 1.7L12 15.8l-1.7-4.6-4.6-1.7 4.6-1.7z" />
      <path d="M18.4 15.1l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  music: (
    <>
      <path d="M9.2 17.2V5.9l9.4-1.9v11.2" />
      <ellipse cx="6.9" cy="17.6" rx="2.4" ry="2" />
      <ellipse cx="16.3" cy="15.6" rx="2.4" ry="2" />
      <path d="M9.2 9.4l9.4-1.9" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3.4" width="18" height="17.2" rx="1.8" />
      <path d="M3 9.6h18M9.4 9.6V20.6M15.4 3.4v6.2" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.4a1.7 1.7 0 011.7-1.7h2.2l1.3-2h7.6l1.3 2h2.2A1.7 1.7 0 0121 8.4v9.3a1.7 1.7 0 01-1.7 1.7H4.7A1.7 1.7 0 013 17.7z" />
      <circle cx="12" cy="12.9" r="3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.9" cy="10.9" r="6.4" />
      <path d="M15.6 15.6L20.5 20.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.2 16.4V10.7a5.8 5.8 0 1111.6 0v5.7l1.6 2.2H4.6z" />
      <path d="M10 20.2a2.2 2.2 0 004 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="16" rx="1.8" />
      <path d="M3.2 9.8h17.6M8.2 3v4M15.8 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.2s6.6-6 6.6-11a6.6 6.6 0 10-13.2 0c0 5 6.6 11 6.6 11z" />
      <circle cx="12" cy="10.1" r="2.4" />
    </>
  ),
  heart: (
    <path d="M12 20.2l-1.3-1.2C6 14.8 3 12.1 3 8.7A4.6 4.6 0 017.6 4c1.6 0 3.2.8 4.4 2.2C13.2 4.8 14.8 4 16.4 4A4.6 4.6 0 0121 8.7c0 3.4-3 6.1-7.7 10.4z" />
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8.3 12.2l2.6 2.6 4.8-5.2" />
    </>
  ),
  house: (
    <>
      <path d="M3.6 10.4L12 3.4l8.4 7v9.2a1.4 1.4 0 01-1.4 1.4H5a1.4 1.4 0 01-1.4-1.4z" />
      <path d="M9.4 21V13.6h5.2V21" />
    </>
  ),
  lock: (
    <>
      <rect x="4.4" y="10.2" width="15.2" height="10.4" rx="1.8" />
      <path d="M8.2 10.2V7.6a3.8 3.8 0 017.6 0v2.6" />
    </>
  ),
  card: (
    <>
      <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2" />
      <path d="M2.6 9.9h18.8M6.2 14.6h3.6" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.4" y="4.6" width="15.2" height="10.6" rx="1.4" />
      <path d="M2.2 18.4h19.6l-1.2-3.2H3.4z" />
    </>
  ),
  phone: (
    <>
      <rect x="6.6" y="2.6" width="10.8" height="18.8" rx="2.2" />
      <path d="M10.6 5.2h2.8" />
      <path d="M10.8 18.6h2.4" />
    </>
  ),
  qr: (
    <>
      <rect x="3.4" y="3.4" width="6.6" height="6.6" rx="1.2" />
      <rect x="14" y="3.4" width="6.6" height="6.6" rx="1.2" />
      <rect x="3.4" y="14" width="6.6" height="6.6" rx="1.2" />
      <path d="M14 14h3v3h-3zM20.6 14v3M17.6 20.6h3M14 20.6h.6" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20C4 12.5 9 6.4 20 4.6c1 9.6-3.9 15.2-11.6 15.2A9 9 0 014 20z" />
      <path d="M6.6 17.4C9.6 12.9 13.4 9.6 18 7.8" />
    </>
  ),
  gauge: (
    <>
      <path d="M3.6 17.2a9 9 0 1116.8 0" />
      <path d="M12 17.2l4.2-5.6" />
      <circle cx="12" cy="17.4" r="1.3" />
    </>
  ),
  chat: (
    <path d="M20.6 12.6c0 3.8-3.8 6.9-8.6 6.9a10 10 0 01-2.8-.4L4 21l1.4-3.7A6.5 6.5 0 013.4 12.6c0-3.8 3.8-6.9 8.6-6.9s8.6 3.1 8.6 6.9z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5M12 7.9v.6" />
    </>
  ),
  plus: <path d="M12 4.8v14.4M4.8 12h14.4" />,
  arrow: <path d="M4.4 12h15.2M13.6 6.2l6 5.8-6 5.8" />,
  gift: (
    <>
      <rect x="3.2" y="9.4" width="17.6" height="11.2" rx="1.5" />
      <path d="M2.4 9.4h19.2M12 9.4v11.2" />
      <path d="M12 9.4C11 6.2 9.8 4.4 8.2 4.4a2 2 0 000 4h3.8zM12 9.4c1-3.2 2.2-5 3.8-5a2 2 0 010 4H12z" />
    </>
  ),
  cake: (
    <>
      <path d="M3.6 20.6h16.8v-5.2a2.4 2.4 0 00-2.4-2.4H6a2.4 2.4 0 00-2.4 2.4z" />
      <path d="M3.6 16.8c1.7 1.5 3.4 1.5 5.6 0 2.2 1.5 3.4 1.5 5.6 0 2.2 1.5 3.9 1.5 5.6 0" />
      <path d="M8.4 13V9.8M12 13V9.8M15.6 13V9.8" />
      <path d="M8.4 8.4a1 1 0 11-.6-1.6M12 8.4a1 1 0 11-.6-1.6M15.6 8.4a1 1 0 11-.6-1.6" />
    </>
  ),
  grid: (
    <>
      <rect x="3.6" y="3.6" width="7" height="7" rx="1.2" />
      <rect x="13.4" y="3.6" width="7" height="7" rx="1.2" />
      <rect x="3.6" y="13.4" width="7" height="7" rx="1.2" />
      <rect x="13.4" y="13.4" width="7" height="7" rx="1.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="7.4" r="3.2" />
      <path d="M5.4 19.6a6.6 6.6 0 0113.2 0" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="4.6" width="18" height="14.8" rx="1.8" />
      <path d="M3 15.6l4.6-4.2 4.2 3.8 3.4-3 5.8 5" />
      <circle cx="8.4" cy="9" r="1.4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8l1.3 2.4 2.7-.4 .5 2.7 2.4 1.3-1.4 2.3 1.4 2.3-2.4 1.3-.5 2.7-2.7-.4L12 21.2l-1.3-2.4-2.7.4-.5-2.7-2.4-1.3L6.5 12 5.1 9.7l2.4-1.3.5-2.7 2.7.4z" />
    </>
  ),
};

export default function Icon({
  name,
  size = 24,
  className = "",
  strokeWidth = 1.25,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * An icon inside the pale circular plate the references use whenever an
 * icon heads a column — About's five principles, Show Us's three steps,
 * Gathering Ideas' category rail. The plate is what keeps a hairline
 * icon from looking lost above a serif heading.
 */
export function IconPlate({
  name,
  size = 22,
  tone = "light",
  className = "",
}: {
  name: IconName;
  size?: number;
  /** "active" is the forest plate the references use for the selected item. */
  tone?: "light" | "dark" | "active";
  className?: string;
}) {
  const tones = {
    light: "bg-cream text-forest",
    dark: "bg-offwhite/10 text-offwhite",
    active: "bg-forest text-offwhite",
  };

  return (
    <span
      className={`inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${tones[tone]} ${className}`}
    >
      <Icon name={name} size={size} />
    </span>
  );
}
