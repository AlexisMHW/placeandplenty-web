export type PaperPieceKind =
  | "invitation"
  | "details"
  | "menu"
  | "itinerary"
  | "welcome-sign"
  | "thank-you";

export type PaperSizeId =
  | "a6"
  | "5x7"
  | "4x9"
  | "square-525"
  | "a5"
  | "8x10"
  | "a4";

export type PaperSize = {
  id: PaperSizeId;
  label: string;
  widthInches: number;
  heightInches: number;
  widthPx: number;
  heightPx: number;
  family: "portrait" | "tall" | "square" | "sign";
};

export const PAPER_SIZES: Record<PaperSizeId, PaperSize> = {
  a6: {
    id: "a6",
    label: "A6 · 4.1 × 5.8",
    widthInches: 105 / 25.4,
    heightInches: 148 / 25.4,
    widthPx: 1240,
    heightPx: 1748,
    family: "portrait",
  },
  "5x7": {
    id: "5x7",
    label: "5 × 7",
    widthInches: 5,
    heightInches: 7,
    widthPx: 1500,
    heightPx: 2100,
    family: "portrait",
  },
  "4x9": {
    id: "4x9",
    label: "4 × 9",
    widthInches: 4,
    heightInches: 9,
    widthPx: 1200,
    heightPx: 2700,
    family: "tall",
  },
  "square-525": {
    id: "square-525",
    label: "5.25 × 5.25 Square",
    widthInches: 5.25,
    heightInches: 5.25,
    widthPx: 1575,
    heightPx: 1575,
    family: "square",
  },
  a5: {
    id: "a5",
    label: "A5",
    widthInches: 148 / 25.4,
    heightInches: 210 / 25.4,
    widthPx: 1748,
    heightPx: 2480,
    family: "tall",
  },
  "8x10": {
    id: "8x10",
    label: "8 × 10",
    widthInches: 200 / 25.4,
    heightInches: 250 / 25.4,
    widthPx: 2362,
    heightPx: 2953,
    family: "sign",
  },
  a4: {
    id: "a4",
    label: "A4",
    widthInches: 210 / 25.4,
    heightInches: 297 / 25.4,
    widthPx: 2480,
    heightPx: 3508,
    family: "sign",
  },
};

export type PaperPieceDefinition = {
  id: PaperPieceKind;
  label: string;
  description: string;
  sizes: PaperSizeId[];
  defaultSize: PaperSizeId;
  source: string;
};

export const PAPER_PIECES: PaperPieceDefinition[] = [
  {
    id: "invitation",
    label: "Invitation",
    description: "Gathering name, date, time and location pulled from the gathering.",
    sizes: ["a6", "5x7", "square-525"],
    defaultSize: "5x7",
    source: "Gathering details",
  },
  {
    id: "details",
    label: "Details / Welcome Card",
    description: "A companion card for location, timing and gathering details.",
    sizes: ["a6", "5x7", "4x9"],
    defaultSize: "a6",
    source: "Gathering details",
  },
  {
    id: "menu",
    label: "Menu Card",
    description: "Builds directly from My Table.",
    sizes: ["4x9", "5x7", "a5"],
    defaultSize: "4x9",
    source: "My Table",
  },
  {
    id: "itinerary",
    label: "Weekend Itinerary",
    description: "Builds from the Multi-Day schedule and activity details.",
    sizes: ["4x9", "5x7", "a5", "8x10", "a4"],
    defaultSize: "5x7",
    source: "My Schedule",
  },
  {
    id: "welcome-sign",
    label: "Welcome Sign",
    description: "A larger-format welcome piece using the gathering identity, date and location.",
    sizes: ["8x10", "a4"],
    defaultSize: "8x10",
    source: "Gathering details",
  },
  {
    id: "thank-you",
    label: "Thank-You Card",
    description: "A coordinated post-gathering card with editable message copy.",
    sizes: ["a6", "5x7", "square-525"],
    defaultSize: "a6",
    source: "Gathering identity",
  },
];

export function paperPiece(kind: PaperPieceKind) {
  return PAPER_PIECES.find((piece) => piece.id === kind) ?? null;
}

export function paperSize(size: PaperSizeId) {
  return PAPER_SIZES[size] ?? null;
}
