// The approved founder photograph, defined once.
//
// Directive §17 is specific about this image and why it is this image:
// the warm at-home photo also used for Life with Lexi, chosen because it
// is in a real home, the Place & Plenty palette is rooted in the
// founder's actual home, and it avoids generic startup-founder
// portraiture. It must not be swapped for stock photography.
//
// §17 also asks for restraint — one strong About image, an optional
// smaller homepage teaser, nothing more. Both surfaces read from here so
// the alt text stays identical and a third use is a deliberate act rather
// than a copy-paste.
//
// PENDING FOUNDER CONFIRMATION (28 Aug 2026). This is the photograph that
// was in the repository. The approved Visual Identity board shows a
// DIFFERENT founder photo — cream sweater, seated at a table with a mug —
// so there are two candidates for "the approved founder photo" and only
// the founder can say which is meant. Replacing the file at this path is
// the entire change; nothing else needs to move. Update the dimensions
// below if the replacement is not square.

export const FOUNDER_PHOTO = {
  src: "/images/alexis-founder.jpg",
  width: 958,
  height: 960,
  alt: "Alexis, the founder of Place & Plenty, smiling at home.",
} as const;

export const FOUNDER_FIRST_NAME = "Alexis";
