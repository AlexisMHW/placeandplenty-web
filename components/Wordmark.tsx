// THE WORDMARK, as the references draw it.
//
// Every approved page opens with the same lockup and it is not the mark
// plus the words side by side — it is a two-line typographic mark:
//
//     P & P          Playfair Display, large, wide-set, with a small
//     PLACE & PLENTY olive sprig tucked into the ampersand's shoulder
//                    and the full name below in letterspaced small caps
//
// That construction is what makes the header read as an editorial
// masthead rather than as a product logo, and it is the single most
// recognisable element carried across all ten references.
//
// THE SPRIG IS PART OF THE MARK, not decoration next to it. It sits at
// the ampersand and scales with the type, which is why it is drawn here
// rather than dropped in as a separate image.
//
// A PNG mark still exists (public/images/pp-mark.png) and is still the
// right choice where a filled, full-colour, square mark is needed — the
// footer badge, the host app, favicons, social cards. This is for the
// masthead.

export default function Wordmark({
  tone = "forest",
  className = "",
}: {
  tone?: "forest" | "offwhite";
  className?: string;
}) {
  const ink = tone === "forest" ? "text-forest" : "text-offwhite";
  const sub = tone === "forest" ? "text-forest/65" : "text-offwhite/70";
  const sprig = tone === "forest" ? "text-olive" : "text-gold";

  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        className={`relative inline-flex items-center font-display text-[1.7rem] font-semibold tracking-[0.06em] ${ink}`}
      >
        P
        <span className="relative mx-[0.18em]">
          &amp;
          <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 40 26"
            className={`absolute -right-[0.42em] -top-[0.34em] h-[0.62em] w-[0.95em] ${sprig}`}
          >
            <path
              d="M4 22C10 14 18 8 34 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.9"
            />
            <g fill="currentColor" opacity="0.85">
              <path
                d="M-7 0Q-1.4-3 7 0Q-1.4 3-7 0Z"
                transform="translate(13,15) rotate(-32) scale(0.9)"
              />
              <path
                d="M-7 0Q-1.4-3 7 0Q-1.4 3-7 0Z"
                transform="translate(16,13) rotate(150) scale(0.72)"
              />
              <path
                d="M-7 0Q-1.4-3 7 0Q-1.4 3-7 0Z"
                transform="translate(24,8) rotate(-38) scale(0.78)"
              />
              <path
                d="M-7 0Q-1.4-3 7 0Q-1.4 3-7 0Z"
                transform="translate(27,6) rotate(146) scale(0.6)"
              />
            </g>
          </svg>
        </span>
        P
      </span>
      <span
        className={`mt-1.5 font-body text-[0.5rem] font-bold uppercase tracking-[0.34em] ${sub}`}
      >
        Place &amp; Plenty
      </span>
    </span>
  );
}
