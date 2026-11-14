import { test } from "node:test";
import assert from "node:assert/strict";
import { CanvaBodyTooLarge, readCanvaBody } from "../lib/canva-request.ts";
function streamed(chunks: number[][], headers = {}) {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift();
      if (next) controller.enqueue(Uint8Array.from(next));
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);
  return { request, cancelled: () => cancelled };
}
test("Bounded request reader accepts the exact limit across chunks", async () => {
  const { request } = streamed([
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(
    await readCanvaBody(request, 4),
    Uint8Array.from([1, 2, 3, 4]),
  );
  assert.equal(request.body?.locked, false);
});
test("Oversized streams are cancelled even with absent or false Content-Length", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    const fixture = streamed([[1, 2], [3, 4], [5]], headers);
    await assert.rejects(readCanvaBody(fixture.request, 3), CanvaBodyTooLarge);
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.request.body?.locked, false);
  }
});
test("Empty bodies are accepted and stream errors propagate", async () => {
  assert.equal(
    (await readCanvaBody(new Request("https://example.test"), 4)).length,
    0,
  );
  const body = new ReadableStream({
    start(controller) {
      controller.error(new Error("disconnected"));
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(readCanvaBody(request, 4), /disconnected/);
  assert.equal(body.locked, false);
});
