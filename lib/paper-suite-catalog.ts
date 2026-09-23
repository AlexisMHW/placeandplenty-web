export type PaperPieceKind =
  | "invitation"
  | "details"
  | "menu"
  | "itinerary"
  | "welcome-sign"
  | "thank-you";

export type PaperSizeId =
  | "4x6"
  | "5x7"
  | "4x9"
  | "square-5"
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
  // Legacy id retained so existing UI/order references remain stable.
  // Gelato's North American Small card trim is 4.25 × 5.5 in.
  "4x6": {
    id: "4x6",
    label: "Small · 4.25 × 5.5",
    widthInches: 4.25,
    heightInches: 5.5,
    widthPx: 1275,
    heightPx: 1650,
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
  // Legacy id retained; Gelato's DL trim is 99 × 210 mm.
  "4x9": {
    id: "4x9",
    label: "DL · 3.9 × 8.27",
    widthInches: 3.9,
    heightInches: 8.27,
    widthPx: 1170,
    heightPx: 2480,
    family: "tall",
  },
  // Legacy id retained; Gelato's North American Square trim is 5.25 in.
  "square-5": {
    id: "square-5",
    label: "Square · 5.25 × 5.25",
    widthInches: 5.25,
    heightInches: 5.25,
    widthPx: 1575,
    heightPx: 1575,
    family: "square",
  },
  a5: {
    id: "a5",
    label: "A5",
    widthInches: 5.83,
    heightInches: 8.27,
    widthPx: 1748,
    heightPx: 2480,
    family: "tall",
  },
  "8x10": {
    id: "8x10",
    label: "8 × 10",
    widthInches: 8,
    heightInches: 10,
    widthPx: 2400,
    heightPx: 3000,
    family: "sign",
  },
  a4: {
    id: "a4",
    label: "A4",
    widthInches: 8.27,
    heightInches: 11.69,
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
    sizes: ["4x6", "5x7", "square-5"],
    defaultSize: "5x7",
    source: "Gathering details",
  },
  {
    id: "details",
    label: "Details / Welcome Card",
    description: "A companion card for location, timing and gathering details.",
    sizes: ["4x6", "5x7", "4x9"],
    defaultSize: "4x6",
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
    sizes: ["4x6", "5x7", "square-5"],
    defaultSize: "4x6",
    source: "Gathering identity",
  },
];

export function paperPiece(kind: PaperPieceKind) {
  return PAPER_PIECES.find((piece) => piece.id === kind) ?? null;
}

export function paperSize(size: PaperSizeId) {
  return PAPER_SIZES[size] ?? null;
}
