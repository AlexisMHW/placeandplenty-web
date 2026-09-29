import {
  paperTemplateDefinition,
  type PaperTemplateId,
} from "@/lib/paper-suite-templates";

export default function PaperHouseDesignPreview({
  template,
  gatheringName = "A Gathering at Home",
  compact = false,
}: {
  template: PaperTemplateId;
  gatheringName?: string;
  compact?: boolean;
}) {
  const design = paperTemplateDefinition(template);
  const modern = design.previewMode === "modern";
  const botanical = design.previewMode === "botanical";
  const celebration = design.previewMode === "celebration";

  return (
    <div
      className={
        "relative overflow-hidden border " +
        (compact ? "aspect-[5/7] rounded-lg p-3" : "aspect-[5/7] rounded-xl p-4")
      }
      style={{
        backgroundColor: design.background,
        color: design.text,
        borderColor: design.rule,
        boxShadow: celebration ? "inset 0 0 0 3px " + design.background + ", inset 0 0 0 4px " + design.accent : undefined,
      }}
    >
      {botanical ? (
        <>
          <div
            className="absolute -right-3 -top-3 h-14 w-14 rounded-full border"
            style={{ borderColor: design.accent, opacity: 0.45 }}
          />
          <div
            className="absolute right-3 top-5 h-8 w-px rotate-45"
            style={{ backgroundColor: design.accent, opacity: 0.55 }}
          />
          <div
            className="absolute right-5 top-3 h-px w-8 rotate-45"
            style={{ backgroundColor: design.accent, opacity: 0.55 }}
          />
        </>
      ) : null}

      <div
        className={
          "flex h-full flex-col " +
          (modern ? "items-start text-left" : "items-center text-center")
        }
      >
        <div
          className={
            "font-body font-bold uppercase " +
            (compact ? "text-[0.42rem]" : "text-[0.5rem]") +
            (modern ? " tracking-[0.22em]" : " tracking-[0.18em]")
          }
          style={{ color: design.accent }}
        >
          Invitation
        </div>

        <div
          className={
            (modern ? "font-body font-semibold" : "font-display") +
            " mt-auto mb-auto leading-tight " +
            (compact ? "text-sm" : "text-lg")
          }
        >
          {gatheringName}
        </div>

        <div
          className={modern ? "w-full" : celebration ? "w-16" : "w-10"}
          style={{
            height: modern ? 1 : 2,
            backgroundColor: design.accent,
            opacity: modern ? 0.35 : 0.8,
          }}
        />

        <div
          className={
            "mt-3 font-body uppercase " +
            (compact ? "text-[0.38rem]" : "text-[0.44rem]") +
            " tracking-[0.14em]"
          }
          style={{ opacity: 0.62 }}
        >
          Saturday · 6 PM
        </div>
        <div
          className={"mt-1 font-body " + (compact ? "text-[0.42rem]" : "text-[0.5rem]")}
          style={{ opacity: 0.62 }}
        >
          Nashville, Tennessee
        </div>
      </div>
    </div>
  );
}
