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
        "relative isolate overflow-hidden rounded-xl border " +
        (compact ? "aspect-[4/3] p-3" : "aspect-[4/3] p-4")
      }
      style={{
        background:
          modern
            ? "linear-gradient(145deg,#f7f8f6 0%,#eef1ed 100%)"
            : botanical
              ? "linear-gradient(145deg,#edf2e9 0%,#dfe8dc 100%)"
              : celebration
                ? "linear-gradient(145deg,#f1e7d6 0%,#e7d5b6 100%)"
                : "linear-gradient(145deg,#f5efe2 0%,#ebe2d3 100%)",
        borderColor: design.rule,
      }}
    >
      {botanical ? (
        <>
          <span
            className="absolute -right-8 -top-10 h-28 w-28 rounded-full border"
            style={{ borderColor: design.accent, opacity: 0.28 }}
          />
          <span
            className="absolute -right-1 top-4 h-20 w-px rotate-[38deg]"
            style={{ backgroundColor: design.accent, opacity: 0.32 }}
          />
          <span
            className="absolute right-7 -top-1 h-px w-20 rotate-[38deg]"
            style={{ backgroundColor: design.accent, opacity: 0.32 }}
          />
        </>
      ) : null}

      <div
        className={
          "absolute bottom-[9%] left-[8%] w-[44%] rounded-md border shadow-sm " +
          (modern ? "rotate-[-2deg]" : "rotate-[-4deg]")
        }
        style={{
          aspectRatio: "5 / 3.4",
          backgroundColor: modern ? "#ffffff" : design.background,
          borderColor: design.rule,
        }}
      >
        <div className="flex h-full flex-col justify-between p-[9%]">
          <div
            className="h-[2px] w-8"
            style={{ backgroundColor: design.accent, opacity: modern ? 0.3 : 0.75 }}
          />
          <div>
            <p
              className={
                "font-body uppercase tracking-[0.18em] " +
                (compact ? "text-[0.34rem]" : "text-[0.42rem]")
              }
              style={{ color: design.accent }}
            >
              Menu
            </p>
            <div className="mt-1 space-y-[3px]">
              <div className="h-px w-4/5" style={{ backgroundColor: design.text, opacity: 0.2 }} />
              <div className="h-px w-3/5" style={{ backgroundColor: design.text, opacity: 0.14 }} />
              <div className="h-px w-2/3" style={{ backgroundColor: design.text, opacity: 0.14 }} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={
          "absolute bottom-[8%] right-[7%] w-[33%] rounded-md border shadow-sm " +
          (celebration ? "rotate-[4deg]" : "rotate-[3deg]")
        }
        style={{
          aspectRatio: "1 / 1.08",
          backgroundColor: celebration ? "#f8f0df" : "#fbfaf6",
          borderColor: celebration ? design.accent : design.rule,
          boxShadow: celebration
            ? "inset 0 0 0 2px #f8f0df, inset 0 0 0 3px " + design.accent
            : undefined,
        }}
      >
        <div className="flex h-full flex-col items-center justify-center px-2 text-center">
          <p
            className={"font-display leading-tight " + (compact ? "text-[0.55rem]" : "text-[0.7rem]")}
            style={{ color: design.text }}
          >
            Welcome
          </p>
          <div className="mt-2 h-px w-7" style={{ backgroundColor: design.accent, opacity: 0.6 }} />
        </div>
      </div>

      <div
        className={
          "absolute left-1/2 top-1/2 z-10 w-[43%] -translate-x-1/2 -translate-y-[56%] rounded-md border shadow-md " +
          (modern ? "rotate-0" : botanical ? "rotate-[1deg]" : celebration ? "rotate-[-1deg]" : "rotate-[1deg]")
        }
        style={{
          aspectRatio: "5 / 7",
          backgroundColor: design.background,
          borderColor: design.rule,
          boxShadow: celebration
            ? "0 8px 20px rgba(40,38,30,.12), inset 0 0 0 3px " + design.background + ", inset 0 0 0 4px " + design.accent
            : "0 8px 20px rgba(40,38,30,.12)",
        }}
      >
        <div
          className={
            "flex h-full flex-col p-[10%] " +
            (modern ? "items-start text-left" : "items-center text-center")
          }
        >
          <p
            className={
              "font-body font-bold uppercase tracking-[0.2em] " +
              (compact ? "text-[0.34rem]" : "text-[0.42rem]")
            }
            style={{ color: design.accent }}
          >
            Invitation
          </p>

          <div className={"flex flex-1 items-center " + (modern ? "justify-start" : "justify-center")}>
            <p
              className={
                (modern ? "font-body font-semibold" : "font-display") +
                " leading-[1.05] " +
                (compact ? "text-[0.68rem]" : "text-[0.9rem]")
              }
              style={{ color: design.text }}
            >
              {gatheringName}
            </p>
          </div>

          <div
            className={modern ? "w-full" : celebration ? "w-12" : "w-8"}
            style={{
              height: modern ? 1 : 2,
              backgroundColor: design.accent,
              opacity: modern ? 0.28 : 0.72,
            }}
          />
          <p
            className={
              "mt-2 font-body uppercase tracking-[0.12em] " +
              (compact ? "text-[0.28rem]" : "text-[0.34rem]")
            }
            style={{ color: design.text, opacity: 0.55 }}
          >
            Saturday · 6 PM
          </p>
        </div>
      </div>

      <div
        className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border bg-white/80 px-2 py-1 backdrop-blur-sm"
        style={{ borderColor: design.rule }}
      >
        <span
          className={
            "font-body font-semibold uppercase tracking-[0.12em] " +
            (compact ? "text-[0.32rem]" : "text-[0.38rem]")
          }
          style={{ color: design.text, opacity: 0.7 }}
        >
          Coordinated suite
        </span>
      </div>
    </div>
  );
}
