import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DELIVERY_COPY, deliveryCopy, deliveryTone, resolveDeliveryLabel } from "../lib/invitation-delivery.ts";

describe("invitation delivery label (web)", () => {
  test("server summary is authoritative for every state", () => {
    for (const s of ["queued", "accepted", "delivered", "delayed", "undeliverable", "failed"]) {
      assert.equal(resolveDeliveryLabel("2026-11-01", "sent", s), s);
    }
  });
  test("'delivered' never appears without server evidence", () => {
    for (const legacy of ["sent", "pending", "submitted", "failed", null, undefined, "delivered", "opened"]) {
      assert.notEqual(resolveDeliveryLabel("2026-11-01", legacy as string | null, null), "delivered");
    }
  });
  test("released enum fallback (old schema)", () => {
    assert.equal(resolveDeliveryLabel(null, null, null), "not_sent");
    assert.equal(resolveDeliveryLabel("t", null, null), "queued");
    assert.equal(resolveDeliveryLabel("t", "pending", null), "queued");
    assert.equal(resolveDeliveryLabel("t", "submitted", null), "queued");
    assert.equal(resolveDeliveryLabel("t", "sent", null), "accepted");
    assert.equal(resolveDeliveryLabel("t", "failed", null), "failed");
  });
  test("unknown values never produce a stronger claim", () => {
    assert.equal(resolveDeliveryLabel("t", "opened", null), "queued");
    assert.equal(resolveDeliveryLabel("t", "sent", "bounced"), "accepted");   // raw provider states are not exposed to hosts
  });
  test("no copy claims opened/read, or the word 'complaint'; delivered copy is scoped to the provider", () => {
    for (const loc of ["en", "es"] as const) {
      for (const [k, v] of Object.entries(DELIVERY_COPY[loc])) {
        assert.ok(v.label.length > 0 && v.hint.length > 0, `${loc}.${k}`);
        assert.doesNotMatch(v.label + " " + v.hint, /\b(read|opened it|spam|complain|queja|spam)\b/i, `${loc}.${k}`);
      }
    }
    assert.match(DELIVERY_COPY.en.delivered.label, /provider/);
    assert.match(DELIVERY_COPY.en.accepted.hint, /not received confirmation/);
  });
  test("en and es cover the same keys; tone", () => {
    assert.deepEqual(Object.keys(DELIVERY_COPY.en).sort(), Object.keys(DELIVERY_COPY.es).sort());
    assert.equal(deliveryTone("undeliverable"), "attention");
    assert.equal(deliveryTone("delivered"), "good");
    assert.equal(deliveryCopy("failed", "es").label, "No se pudo enviar");
  });
});
