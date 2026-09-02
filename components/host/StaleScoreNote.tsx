// HostReady is authoritative in the backend.
//
// Web planning writes call hostready_recalculate(gathering_id), the same
// canonical recalculation contract used across Place & Plenty. Keep this
// component as a no-op temporarily so existing imports do not need a
// broad presentation refactor during convergence.

export default function StaleScoreNote() {
  return null;
}
