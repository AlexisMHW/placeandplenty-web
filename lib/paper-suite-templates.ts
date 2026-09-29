export type PaperTemplateId =
  | "classic-editorial"
  | "soft-botanical"
  | "modern-clean"
  | "warm-celebration";

export type PaperTemplateDefinition = {
  id: PaperTemplateId;
  name: string;
  description: string;
  background: string;
  text: string;
  accent: string;
  rule: string;
  previewMode: "editorial" | "botanical" | "modern" | "celebration";
};

export const PAPER_TEMPLATES: PaperTemplateDefinition[] = [
  {
    id: "classic-editorial",
    name: "Classic Editorial",
    description: "Cream, forest and restrained type with a centered editorial hierarchy.",
    background: "#F7F4EC",
    text: "#1E3A2E",
    accent: "#C9A227",
    rule: "#D8D0BD",
    previewMode: "editorial",
  },
  {
    id: "soft-botanical",
    name: "Soft Botanical",
    description: "Sage-forward, organic and softly layered with a botanical frame detail.",
    background: "#E8EDE4",
    text: "#1E3A2E",
    accent: "#71856F",
    rule: "#AAB9A6",
    previewMode: "botanical",
  },
  {
    id: "modern-clean",
    name: "Modern Clean",
    description: "Crisp, contemporary and left-aligned with generous white space.",
    background: "#FFFFFF",
    text: "#142720",
    accent: "#142720",
    rule: "#D7DDD8",
    previewMode: "modern",
  },
  {
    id: "warm-celebration",
    name: "Warm Celebration",
    description: "Parchment, warm metallic accents and a framed milestone feel.",
    background: "#EFE6D5",
    text: "#1E3A2E",
    accent: "#A77C25",
    rule: "#D4BE8D",
    previewMode: "celebration",
  },
];

export function paperTemplateDefinition(id: PaperTemplateId) {
  return PAPER_TEMPLATES.find((template) => template.id === id) ?? PAPER_TEMPLATES[0];
}
