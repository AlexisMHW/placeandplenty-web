from pathlib import Path

p = Path('lib/host-data.ts')
s = p.read_text()
old = '''  if (error) throw error;
  return (data as GatheringSummary) ?? null;
}

/* ------------------------------------------------------------------ */
'''
new = '''  if (error) throw error;
  const gathering = (data as GatheringSummary) ?? null;
  if (!gathering) return null;

  // HostReady's stored columns are a cache/snapshot, not a second source of
  // truth. Read the canonical backend computation for every gathering
  // workspace render so web cannot show a stale score after an edit made on
  // either platform. The wrapper enforces accepted gathering membership.
  const { data: hostReady, error: hostReadyError } = await supabase.rpc(
    "hostready_read",
    { p_gathering_id: id }
  );
  if (hostReadyError) throw hostReadyError;

  if (hostReady && typeof hostReady === "object") {
    const result = hostReady as {
      score?: number;
      readinessState?: GatheringSummary["readiness_state"];
    };
    if (typeof result.score === "number") {
      gathering.current_hostready_score = result.score;
    }
    if (result.readinessState) {
      gathering.readiness_state = result.readinessState;
    }
  }

  return gathering;
}

/* ------------------------------------------------------------------ */
'''
if s.count(old) != 1:
    raise SystemExit('getGathering return seam changed; refusing broad edit.')
p.write_text(s.replace(old, new, 1))
Path('scripts/phase6-hostready-patch.py').unlink()
Path('.github/workflows/phase6-hostready-read.yml').unlink()
