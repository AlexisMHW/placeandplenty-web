import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  eligibleGathering,
  persistCanvaArtwork,
  validatePng,
} from "../lib/canva-publisher.ts";
const id = "f2f91df4-8c45-4e7e-9a16-313314324889";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
function fake({
  authorized = true,
  uploadFails = false,
  saveFails = false,
  status = "active",
} = {}) {
  const calls: string[] = [];
  let uploadedPath = "";
  const client = {
    rpc(name: string, args?: Record<string, unknown>) {
      calls.push(name);
      if (name === "list_my_gatherings_with_lifecycle")
        return {
          eq: (column: string, value: string) => {
            assert.equal(column, "id");
            assert.equal(value, id);
            return {
              maybeSingle: async () => ({
                data: authorized
                  ? { id, effective_status: status, duration_type: "multi_day" }
                  : null,
                error: null,
              }),
            };
          },
        };
      assert.equal(name, "save_invitation_artwork");
      assert.equal(args?.p_gathering_id, id);
      assert.equal(args?.p_storage_path, uploadedPath);
      return Promise.resolve({
        error: saveFails ? { message: "permission denied" } : null,
      });
    },
    storage: {
      from(bucket: string) {
        assert.equal(bucket, "invitation-artwork");
        return {
          async upload(
            path: string,
            _bytes: Uint8Array,
            options: Record<string, unknown>,
          ) {
            calls.push("upload");
            uploadedPath = path;
            assert.ok(path.startsWith(id + "/"));
            assert.equal(options.upsert, false);
            return { error: uploadFails ? {} : null };
          },
          async remove(paths: string[]) {
            calls.push("remove");
            assert.deepEqual(paths, [uploadedPath]);
            return { error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
test("Unauthorized or archived gatherings never reach storage", async () => {
  for (const options of [
    { authorized: false },
    { status: "archived" },
    { status: "completed" },
    { status: "cancelled" },
  ]) {
    const { client, calls } = fake(options);
    await assert.rejects(persistCanvaArtwork(client, id, png));
    assert.deepEqual(calls, ["list_my_gatherings_with_lifecycle"]);
  }
});
test("Storage failure never records metadata; RPC denial cleans only new artwork", async () => {
  const upload = fake({ uploadFails: true });
  await assert.rejects(persistCanvaArtwork(upload.client, id, png));
  assert.deepEqual(upload.calls, [
    "list_my_gatherings_with_lifecycle",
    "upload",
  ]);
  const save = fake({ saveFails: true });
  await assert.rejects(persistCanvaArtwork(save.client, id, png));
  assert.deepEqual(save.calls, [
    "list_my_gatherings_with_lifecycle",
    "upload",
    "save_invitation_artwork",
    "remove",
  ]);
});
test("Success is returned only after canonical upload and RPC save", async () => {
  const { client, calls } = fake();
  const result = await persistCanvaArtwork(client, id, png);
  assert.equal(result.gatheringId, id);
  assert.deepEqual(calls, [
    "list_my_gatherings_with_lifecycle",
    "upload",
    "save_invitation_artwork",
  ]);
});
test("Invalid IDs and artwork cannot upload; PNG limits reject spoofed and oversized media", async () => {
  const { client, calls } = fake();
  await assert.rejects(persistCanvaArtwork(client, "other", png));
  assert.equal(calls.length, 0);
  assert.throws(() => validatePng(Buffer.from("not a PNG")));
  assert.throws(() => validatePng(Buffer.alloc(11 * 1024 * 1024)));
  const huge = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAATiAAAAABCAQAAACRvVYFAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
    "base64",
  );
  assert.throws(() => validatePng(huge), /dimensions too large/);
  await assert.rejects(persistCanvaArtwork(client, id, Buffer.from("bad")));
  assert.deepEqual(calls, ["list_my_gatherings_with_lifecycle"]);
  assert.equal(
    eligibleGathering({
      id,
      effective_status: "unknown",
      duration_type: "single_day",
    }),
    false,
  );
});

test("PNG requires intact chunks, image data and a final IEND", () => {
  assert.doesNotThrow(() => validatePng(png));
  const corrupt = Buffer.from(png);
  corrupt[45] ^= 1;
  for (const invalid of [
    corrupt,
    png.subarray(0, 33),
    png.subarray(0, -12),
    png.subarray(0, -1),
    Buffer.concat([png, Buffer.from([0])]),
  ])
    assert.throws(() => validatePng(invalid));
});
