import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanupArtworkObject, type ArtworkCleanupClient } from "../lib/invitation-artwork-cleanup.ts";

function fake(opts: { allowed?: unknown; rpcError?: unknown; removeError?: unknown; throwRpc?: boolean }) {
  const calls: { rpc: Array<[string, Record<string, unknown>]>; removed: string[][] } = { rpc: [], removed: [] };
  const client: ArtworkCleanupClient = {
    rpc: async (fn, args) => {
      calls.rpc.push([fn, args]);
      if (opts.throwRpc) throw new Error("network");
      return { data: opts.allowed, error: opts.rpcError ?? null };
    },
    storage: { from: () => ({ remove: async (p) => (calls.removed.push(p), { error: opts.removeError ?? null }) }) },
  };
  return { client, calls };
}

describe("artwork cleanup (207000 guard)", () => {
  test("deletes only when the server says true", async () => {
    const { client, calls } = fake({ allowed: true });
    assert.equal(await cleanupArtworkObject(client, "invitation-artwork", "g1", "g1/old.png"), "deleted");
    assert.deepEqual(calls.rpc[0], ["invitation_artwork_cleanup_allowed", { p_gathering_id: "g1", p_path: "g1/old.png" }]);
    assert.deepEqual(calls.removed, [["g1/old.png"]]);
  });
  test("keeps a file another gathering still references (false)", async () => {
    const { client, calls } = fake({ allowed: false });
    assert.equal(await cleanupArtworkObject(client, "b", "g1", "g1/x.png"), "kept");
    assert.equal(calls.removed.length, 0);
  });
  test("fails closed: missing function, error, truthy non-true, thrown", async () => {
    for (const o of [{ rpcError: { message: "function does not exist" } }, { allowed: "true" }, { allowed: 1 }, { allowed: null }, { throwRpc: true }]) {
      const { client, calls } = fake(o);
      assert.equal(await cleanupArtworkObject(client, "b", "g1", "g1/x.png"), "kept");
      assert.equal(calls.removed.length, 0);
    }
  });
  test("a failed storage delete is reported as kept, never thrown", async () => {
    const { client } = fake({ allowed: true, removeError: { message: "denied" } });
    assert.equal(await cleanupArtworkObject(client, "b", "g1", "g1/x.png"), "kept");
  });
  test("no previous path means nothing to do and no calls", async () => {
    const { client, calls } = fake({ allowed: true });
    assert.equal(await cleanupArtworkObject(client, "b", "g1", null), "skipped");
    assert.equal(calls.rpc.length, 0);
  });
});

describe("replacement journey wiring (web)", () => {
  const mgr = readFileSync(new URL("../components/host/InvitationArtworkManager.tsx", import.meta.url), "utf8");
  test("old object is considered only AFTER the new artwork is saved", () => {
    const savedAt = mgr.indexOf("const saved = await saveInvitationArtwork");
    const oldCleanup = mgr.indexOf("gatheringId, savedPath)");
    assert.ok(savedAt > 0 && oldCleanup > savedAt);
  });
  test("a failed save cleans up the NEW object, not the old one", () => {
    assert.match(mgr, /if \(!saved\.ok\) \{[^}]*cleanupArtworkObject\(supabase, INVITATION_ARTWORK_BUCKET, gatheringId, path\)/);
  });
  test("the page passes the current storage path through", () => {
    const page = readFileSync(new URL("../app/(host)/host/g/[id]/invitations/page.tsx", import.meta.url), "utf8");
    assert.match(page, /invitation_artwork_path/);
    assert.match(page, /currentArtworkPath=/);
  });
});
