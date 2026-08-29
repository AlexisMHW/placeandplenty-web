import Link from "next/link";
import { BotanicalSprig } from "@/components/Botanical";
import StaleScoreNote from "@/components/host/StaleScoreNote";

// THE HOSTREADY DIAL, from `host_web_gathering.png`.
//
// The reference draws it as a wide ring with the percentage centred, a
// short verdict under it, and the focus list beside it. This is the
// single most prominent thing on Command Central and it should be —
// "am I ready?" is the question the host came to the page with.
//
// THE SCORE IS READ, NEVER RECOMPUTED. `current_hostready_score` and
// `readiness_state` are computed in the app against rules this repository
// does not own, and stored on the gathering. A second implementation
// here would drift, and the first time the web said 71% while the phone
// said 68%, neither number would be trusted again.
//
// THAT HAS A CONSEQUENCE WORTH BEING HONEST ABOUT: no database trigger
// recomputes the score, so a change made on the web updates the record
// immediately and leaves the score showing the app's last judgement until
// the app recalculates. StaleScoreNote says so in the interface rather
// than letting a host discover it. Whether a server-side recompute
// belongs in the shared backend is App Claude's call.
//
// THE RING IS AN SVG, NOT A CHART LIBRARY. One arc, drawn with
// stroke-dasharray on a circle. Adding a charting dependency to draw a
// single ring would be several hundred kilobytes for something the
// browser already does.
//
// aria: the ring itself is decorative because the number beside it is
// real text. A progressbar role announcing the same value twice is
// noise.

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const VERDICTS: Record<string, string> = {
  on_track: "You’re well on your way.",
  ready: "You’re ready. Go and enjoy it.",
  needs_attention: "A few things still need you.",
  behind: "You’re behind — let’s handle the essentials first.",
  at_risk: "A few important things are still open.",
};

export default function HostReadyDial({
  score,
  state,
  gatheringId,
}: {
  score: number | null;
  state: string | null;
  gatheringId: string;
}) {
  const value = score == null ? null : Math.max(0, Math.min(100, Math.round(score)));
  const dash =
    value == null ? 0 : (value / 100) * CIRCUMFERENCE;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-sage/25 bg-offwhite p-6">
      <BotanicalSprig
        className="pointer-events-none absolute -bottom-3 -right-3 text-olive/25"
        size={110}
      />

      <h2 className="relative font-display text-lg text-forest">
        HostReady Score
      </h2>

      <div className="relative mt-5 flex flex-wrap items-center gap-7">
        {value == null ? (
          <p className="font-body text-sm leading-relaxed text-forest/70">
            No score yet. HostReady appears once there is enough of a plan to
            judge — add your people and a few dishes and it will start
            reading.
          </p>
        ) : (
          <>
            <div className="relative flex-shrink-0">
              <svg
                aria-hidden
                viewBox="0 0 120 120"
                width={128}
                height={128}
                className="-rotate-90"
              >
                <circle
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-sage/25"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                  className="text-forest"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-3xl leading-none text-forest">
                  {value}
                  <span className="text-lg">%</span>
                </p>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-snug text-forest">
                {(state && VERDICTS[state]) || "Here’s where you stand."}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                HostReady weighs what actually matters for this gathering —
                what is handled, how much time is left, and whether anything
                important is still open. It is not a count of ticked boxes.
              </p>
              <Link
                href={`/host/g/${gatheringId}/people`}
                className="mt-4 inline-block font-body text-xs font-semibold text-forest/80 underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-forest"
              >
                Start with your people <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="relative mt-5">
        <StaleScoreNote />
      </div>
    </section>
  );
}
