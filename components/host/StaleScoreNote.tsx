// HostReady after a web edit.
//
// `current_hostready_score` and `readiness_state` are computed in the
// APP and stored on the gathering. No database trigger recalculates
// them, so a change made here — a dish added, an item bought — updates
// the record immediately and leaves the score showing the app's last
// judgement until the app recomputes it.
//
// Recomputing on the web was considered and rejected: it would be a
// second implementation of a rule this repo does not own, and the first
// time web said 71% while the phone said 68%, neither number would be
// trusted again. §30 also warns against equating green infrastructure
// with a finished experience — quietly showing a number that no longer
// matches its inputs is exactly that.
//
// So the score is shown, labelled honestly, and the limitation is stated
// once where a host can actually see it. Recorded for the §38 seam
// audit as a real cross-platform item.

export default function StaleScoreNote() {
  return (
    <p className="mt-3 font-body text-xs leading-relaxed text-forest/60">
      Your HostReady score is worked out in the app. Changes you make here
      are saved straight away — the score catches up next time you open
      Place &amp; Plenty.
    </p>
  );
}
