import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { mergeGuestCounts } from "../lib/guest-counts.ts";
import {
  ALLOWED_ARTWORK_MIME_TYPES,
  ARTWORK_LIMITS_HINT,
  ARTWORK_REJECTION_MESSAGES,
  artworkObjectPath,
  artworkRejectionCode,
  artworkRejectionReason,
  INVITATION_ARTWORK_BUCKET,
  INVITATION_MODES,
  INVITATION_STATUSES,
  INVITATION_STYLES,
  isRenderableArtwork,
  MAX_ARTWORK_BYTES,
  isInvitationMode,
  isInvitationStatus,
  isInvitationStyle,
  isInvitationDecision,
  usesOwnArtwork,
  invitationModeLabel,
} from "../lib/invitations.ts";
import {
  FOOD_STYLES,
  FOOD_STYLE_LABELS,
  GATHERING_TYPES,
  hasEnoughToSaveDraft,
  isArrivalInPast,
  isFoodStyle,
  isGatheringType,
  validateGatheringInput,
} from "../lib/gathering-creation.ts";
import { isLive, summarise, WEB_CHECKOUT_LIVE } from "../lib/entitlements.ts";
import type { Entitlement } from "../lib/entitlements.ts";
import {
  PRICING_TIERS,
  TAX_QUALIFIER,
  PLUS_LIMITS_NOTE,
  PASS_LIMITS_NOTE,
} from "../lib/pricing.ts";

// PRE-NATIVE-REBUILD REGRESSION TESTS, for the rules that live in
// TypeScript rather than in Postgres.
//
// The backend contracts are asserted where they are enforced —
// supabase/tests/native-rebuild-contract.sql, 94 assertions run against
// the live schema. These cover the four things the WEB owns and got
// wrong, plus the product constants a page could quietly drift from.
//
// Run with `npm test`. No test framework is installed and none is
// needed: node:test is built in, and Node strips the TypeScript.

/* ------------------------------------------------------------------ */

describe("guest counts — the partial-edit corruption", () => {
  // The exact scenario from §10 of the directive.
  test("editing only the children keeps the adults", () => {
    const merged = mergeGuestCounts(
      { adults: null, children: 6 },
      { adults: 20, children: 5 }
    );
    assert.deepEqual(merged, {
      adult_count: 20,
      child_count: 6,
      expected_guest_count: 26,
    });
  });

  test("editing only the adults keeps the children", () => {
    const merged = mergeGuestCounts(
      { adults: 22, children: null },
      { adults: 20, children: 5 }
    );
    assert.deepEqual(merged, {
      adult_count: 22,
      child_count: 5,
      expected_guest_count: 27,
    });
  });

  test("the old naive arithmetic would have produced 6, not 26", () => {
    // The bug written out, so a refactor that reintroduces it fails here
    // with a name rather than shipping.
    const submitted: { adults: number | null; children: number | null } = {
      adults: null,
      children: 6,
    };
    const naive = (submitted.adults ?? 0) + (submitted.children ?? 0);
    const correct = mergeGuestCounts(submitted, { adults: 20, children: 5 })
      .expected_guest_count;
    assert.equal(naive, 6);
    assert.equal(correct, 26);
  });

  test("a submitted zero is a real zero, not a missing field", () => {
    const merged = mergeGuestCounts(
      { adults: 0, children: 4 },
      { adults: 20, children: 5 }
    );
    assert.deepEqual(merged, {
      adult_count: 0,
      child_count: 4,
      expected_guest_count: 4,
    });
  });

  test("both fields submitted are both believed", () => {
    const merged = mergeGuestCounts(
      { adults: 8, children: 2 },
      { adults: 20, children: 5 }
    );
    assert.deepEqual(merged, {
      adult_count: 8,
      child_count: 2,
      expected_guest_count: 10,
    });
  });

  test("neither submitted leaves the record exactly as it was", () => {
    const merged = mergeGuestCounts(
      { adults: null, children: null },
      { adults: 20, children: 5 }
    );
    assert.deepEqual(merged, {
      adult_count: 20,
      child_count: 5,
      expected_guest_count: 25,
    });
  });

  test("counts are whole, non-negative people", () => {
    assert.equal(
      mergeGuestCounts({ adults: 3.6, children: null }, { adults: 0, children: 0 })
        .adult_count,
      4
    );
    assert.equal(
      mergeGuestCounts({ adults: -5, children: null }, { adults: 0, children: 0 })
        .adult_count,
      0
    );
    assert.equal(
      mergeGuestCounts(
        { adults: Number.NaN, children: null },
        { adults: 0, children: 0 }
      ).adult_count,
      0
    );
  });
});

/* ------------------------------------------------------------------ */

describe("invitation modes — the value that never existed", () => {
  test("the canonical set is exactly the three the database stores", () => {
    assert.deepEqual(Object.values(INVITATION_MODES).sort(), [
      "details_only",
      "p_and_p",
      "uploaded",
    ]);
  });

  test("own_artwork is not a mode", () => {
    assert.equal(isInvitationMode("own_artwork"), false);
    assert.equal(usesOwnArtwork("own_artwork"), false);
  });

  test("uploaded is what 'my own artwork' actually means", () => {
    assert.equal(usesOwnArtwork(INVITATION_MODES.UPLOADED), true);
    assert.equal(usesOwnArtwork(INVITATION_MODES.PLACE_AND_PLENTY), false);
    assert.equal(usesOwnArtwork(INVITATION_MODES.DETAILS_ONLY), false);
  });

  test("every canonical mode has its own label", () => {
    const labels = Object.values(INVITATION_MODES).map(invitationModeLabel);
    assert.equal(new Set(labels).size, labels.length);
    for (const label of labels) assert.notEqual(label, "Not chosen yet");
  });
});

/* ------------------------------------------------------------------ */

describe("entitlements — the canonical model", () => {
  const base: Entitlement = {
    id: "e1",
    entitlement_type: "gathering_pass",
    canonical_product_id: "gathering_pass",
    scope: "gathering",
    gathering_id: "g1",
    active: true,
    purchased_at: "2026-01-01T00:00:00Z",
    expires_at: null,
    consumed_at: null,
    refunded_at: null,
    revoked_at: null,
    provider: "apple",
    source: null,
  };

  test("a consumed Pass is still live — consumption IS binding", () => {
    assert.equal(isLive({ ...base, consumed_at: "2026-02-01T00:00:00Z" }), true);
  });

  test("refunded, revoked, inactive and expired are all dead", () => {
    assert.equal(isLive({ ...base, refunded_at: "2026-02-01T00:00:00Z" }), false);
    assert.equal(isLive({ ...base, revoked_at: "2026-02-01T00:00:00Z" }), false);
    assert.equal(isLive({ ...base, active: false }), false);
    assert.equal(
      isLive({ ...base, expires_at: "2026-01-02T00:00:00Z" }, new Date("2026-06-01")),
      false
    );
  });

  test("a Gathering Pass never reads as Plus", () => {
    const state = summarise([base]);
    assert.equal(state.tier, "Gathering Pass");
    assert.equal(state.plus, null);
    assert.equal(state.passes.length, 1);
  });

  test("account Plus outranks any number of Passes", () => {
    const plus: Entitlement = {
      ...base,
      id: "e2",
      entitlement_type: "plus",
      canonical_product_id: "plus_annual",
      scope: "account",
      gathering_id: null,
      provider: "web",
    };
    const state = summarise([base, plus]);
    assert.equal(state.tier, "Place & Plenty Plus");
    assert.equal(state.plus?.id, "e2");
  });

  test("no entitlements means Free, never inferred from anything else", () => {
    assert.equal(summarise([]).tier, "Free");
    assert.equal(summarise([{ ...base, active: false }]).tier, "Free");
  });

  test("the same product bought anywhere is the same entitlement", () => {
    const apple = summarise([{ ...base, provider: "apple" }]);
    const web = summarise([{ ...base, provider: "web" }]);
    assert.equal(apple.tier, web.tier);
    assert.deepEqual(
      apple.passes.map((p) => p.canonical_product_id),
      web.passes.map((p) => p.canonical_product_id)
    );
  });

  test("web checkout is not live", () => {
    // §15/§32: nothing on the site may imply a purchase can be made
    // today. Flipping this is a deliberate act, not a side effect.
    assert.equal(WEB_CHECKOUT_LIVE, false);
  });
});

/* ------------------------------------------------------------------ */

describe("pricing — the approved V1 model", () => {
  const byName = (n: string) => PRICING_TIERS.find((t) => t.name === n)!;

  test("three tiers, and no monthly Plus", () => {
    assert.deepEqual(
      PRICING_TIERS.map((t) => t.name),
      ["Free", "Gathering Pass", "Place & Plenty Plus"]
    );
    for (const tier of PRICING_TIERS) {
      assert.equal(/month/i.test(tier.billing + tier.priceLine), false);
    }
  });

  test("the approved amounts, exactly", () => {
    assert.equal(byName("Free").price, "$0");
    assert.equal(byName("Gathering Pass").price, "$9.99");
    assert.equal(byName("Place & Plenty Plus").price, "$59.99");
  });

  test("every paid price line carries the tax qualifier", () => {
    assert.equal(byName("Gathering Pass").priceLine, `$9.99 ${TAX_QUALIFIER}`);
    assert.equal(
      byName("Place & Plenty Plus").priceLine,
      `$59.99/year ${TAX_QUALIFIER}`
    );
    assert.equal(TAX_QUALIFIER, "+ applicable taxes and fees");
  });

  test("Free carries no qualifier, because there is nothing to tax", () => {
    assert.equal(byName("Free").priceLine, "$0");
  });

  test("nothing is ever described as unlimited", () => {
    const everything = JSON.stringify(PRICING_TIERS) + PLUS_LIMITS_NOTE + PASS_LIMITS_NOTE;
    assert.equal(/unlimited/i.test(everything), false);
  });

  test("Plus states both of its bounds", () => {
    assert.match(PLUS_LIMITS_NOTE, /6 active gatherings/);
    assert.match(PLUS_LIMITS_NOTE, /12 locked-in gatherings/);
    assert.match(PLUS_LIMITS_NOTE, /Drafts don't count/);
  });

  test("a Pass is bound to its gathering and is not a subscription", () => {
    assert.match(PASS_LIMITS_NOTE, /bound to it/);
    assert.match(PASS_LIMITS_NOTE, /isn't a subscription/);
  });

  test("Free lists the Hosting Closet; paid tiers list the MATCHING", () => {
    // §1: never describe basic Closet access as paid-only, and be
    // precise about which capability a tier is buying.
    const free = byName("Free").includes.join(" ");
    assert.match(free, /Hosting Closet/);
    assert.match(free, /organise what you already own/);

    for (const name of ["Gathering Pass", "Place & Plenty Plus"]) {
      const includes = byName(name).includes.join(" ");
      assert.match(includes, /Smart Closet matching/);
      // The closet is not what the purchase delivers.
      assert.equal(/^(?!.*Smart).*My Hosting Closet/.test(includes), false);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("creating a gathering — the canonical vocabulary", () => {
  // `gatherings.food_style` is untyped text with no CHECK constraint, so
  // nothing in Postgres will stop a web-only word being written and then
  // recognised by neither the app nor any reader. These are the five the
  // native wizard writes, spelled its way.
  test("the five food styles are the native app's, character for character", () => {
    assert.deepEqual(
      [...FOOD_STYLES],
      ["cooking", "mixed", "catering", "potluck", "notSure"]
    );
  });

  test("notSure is camelCase in the database and is not tidied up here", () => {
    // The app writes the same identifier it uses as a translation key.
    // "Correcting" it to not_sure would write a value the phone cannot
    // read back — the lib/invitations.ts lesson, in a second column.
    assert.equal(FOOD_STYLES.includes("notSure"), true);
    assert.equal(isFoodStyle("not_sure"), false);
    assert.equal(isFoodStyle("Not sure yet"), false);
  });

  test("display wording is web copy; the stored value is the contract", () => {
    assert.equal(FOOD_STYLE_LABELS.potluck, "Potluck");
    // The label is never the value.
    assert.equal(isFoodStyle("Potluck"), false);
    assert.equal(isFoodStyle("potluck"), true);
  });

  test("the gathering types are the public.gathering_type enum", () => {
    assert.deepEqual(
      [...GATHERING_TYPES],
      [
        "birthday",
        "dinner",
        "brunch",
        "holiday",
        "shower",
        "cookout",
        "game_night",
        "family_gathering",
        "repast",
        "open_house",
        "other",
      ]
    );
    // A label, or a prettier spelling, is not an enum member.
    assert.equal(isGatheringType("Game Night"), false);
    assert.equal(isGatheringType("game night"), false);
    assert.equal(isGatheringType("game_night"), true);
  });
});

describe("creating a gathering — when a draft may be written", () => {
  const full = {
    name: "Barbara's 80th",
    gatheringType: "birthday" as const,
    gatheringDate: "2026-11-26",
    arrivalTime: "18:00",
    locationName: "",
    adultCount: 8,
    childCount: 0,
    budgetTarget: null,
    foodStyle: null,
    notes: "",
  };

  test("all five required answers, and only then, make a saveable draft", () => {
    assert.equal(hasEnoughToSaveDraft(full), true);
    assert.deepEqual(validateGatheringInput(full), []);
  });

  test("each missing required answer is named, in the native order", () => {
    const empty = validateGatheringInput({
      ...full,
      name: "   ",
      gatheringType: null,
      gatheringDate: null,
      arrivalTime: null,
      adultCount: 0,
      childCount: 0,
    });
    assert.deepEqual(empty.map((e) => e.code), [
      "name_required",
      "type_required",
      "date_required",
      "arrival_time_required",
      "headcount_required",
    ]);
  });

  test("a gathering with nobody coming is not saveable", () => {
    // Zero may be ENTERED as a starting point. It may not be saved.
    assert.equal(hasEnoughToSaveDraft({ ...full, adultCount: 0, childCount: 0 }), false);
    assert.equal(hasEnoughToSaveDraft({ ...full, adultCount: 0, childCount: 1 }), true);
  });

  test("a skipped budget, place, food style and note never block the draft", () => {
    // Everything the wizard is allowed not to know yet.
    assert.equal(
      hasEnoughToSaveDraft({
        ...full,
        locationName: "",
        budgetTarget: null,
        foodStyle: null,
        notes: "",
      }),
      true
    );
  });

  test("a past arrival is a warning, not a validation error", () => {
    const past = isArrivalInPast("2026-11-26", "18:00", new Date(2026, 10, 26, 19, 0));
    const future = isArrivalInPast("2026-11-26", "18:00", new Date(2026, 10, 26, 17, 0));
    assert.equal(past, true);
    assert.equal(future, false);
    // And it never stops the save.
    assert.equal(hasEnoughToSaveDraft(full), true);
  });

  test("the date is wall-clock, so an evening arrival is not yesterday", () => {
    // Parsing "2026-11-26" with new Date() would make it UTC midnight and
    // shift the day west of Greenwich. Parts, not instants.
    assert.equal(
      isArrivalInPast("2026-11-26", "23:59", new Date(2026, 10, 26, 12, 0)),
      false
    );
  });
});

describe("creating a gathering — the invitation decision", () => {
  test("the three modes are the database's three and nothing else", () => {
    assert.deepEqual(Object.values(INVITATION_MODES).sort(), [
      "details_only",
      "p_and_p",
      "uploaded",
    ]);
  });

  test("the four invitation statuses are the ones the column holds", () => {
    assert.deepEqual(Object.values(INVITATION_STATUSES).sort(), [
      "in_progress",
      "invited_elsewhere",
      "not_started",
      "shared",
    ]);
    assert.equal(isInvitationStatus("invited_elsewhere"), true);
    assert.equal(isInvitationStatus("invited elsewhere"), false);
  });

  test("already invited and later are distinct answers, and later writes nothing", () => {
    // 'already_invited' records invited_elsewhere so P&P never claims to
    // have sent what it did not send. 'later' records NOTHING, leaving
    // invitation_status at its not_started default — the honest record
    // of a host who has not decided. The two must not be collapsed.
    assert.equal(isInvitationDecision("already_invited"), true);
    assert.equal(isInvitationDecision("later"), true);
    assert.equal(isInvitationDecision("not_yet"), true);
    assert.equal(isInvitationDecision("skipped"), false);
    assert.notEqual(
      INVITATION_STATUSES.INVITED_ELSEWHERE,
      INVITATION_STATUSES.NOT_STARTED
    );
  });

  test("the six invitation style ids match the app's and the guest page's", () => {
    // Mirrored by hand across three runtimes; the ids are what
    // select_invitation_style() stores.
    assert.deepEqual(
      INVITATION_STYLES.map((s) => s.id),
      [
        "classic_green",
        "ivory_elegant",
        "gold_accent",
        "botanical_sage",
        "bold_block",
        "minimal_cream",
      ]
    );
    assert.equal(isInvitationStyle("classic_green"), true);
    assert.equal(isInvitationStyle("Classic Green"), false);
  });
});

describe("invitation artwork — one bucket, one path convention", () => {
  const G = "11111111-2222-3333-4444-555555555555";

  test("the first path segment is the gathering id, because storage reads it", () => {
    // The bucket's RLS policy parses the FIRST segment to decide who may
    // write. A key built any other way is refused by Postgres, so this
    // is a correctness rule and not a naming preference.
    const path = artworkObjectPath(G, "invite.png", "abc123");
    assert.equal(path.split("/")[0], G);
    assert.match(path, /^[^/]+\/abc123-invite\.png$/);
  });

  test("a filename cannot climb out of the gathering's folder", () => {
    const path = artworkObjectPath(G, "../../someone-else/evil.png", "abc123");
    assert.equal(path.split("/")[0], G);
    assert.equal(path.split("/").length, 2);
    assert.equal(path.includes(".."), false);
  });

  test("a nameless or unspellable file still gets a usable key", () => {
    assert.match(artworkObjectPath(G, "...", "id"), /\/id-invitation$/);
    assert.match(artworkObjectPath(G, "招待状.png", "id"), /^[^/]+\/id-[\w.-]+$/);
  });

  test("every upload is a new key, because the bucket has no UPDATE policy", () => {
    assert.notEqual(
      artworkObjectPath(G, "invite.png", "first"),
      artworkObjectPath(G, "invite.png", "second")
    );
  });

  test("JPG, PNG and PDF are accepted; a PDF is real artwork", () => {
    assert.deepEqual(
      [...ALLOWED_ARTWORK_MIME_TYPES],
      ["image/jpeg", "image/png", "application/pdf"]
    );
    assert.equal(artworkRejectionReason({ type: "application/pdf", size: 1000 }), null);
    assert.equal(artworkRejectionReason({ type: "image/jpeg", size: 1000 }), null);
    assert.notEqual(artworkRejectionReason({ type: "image/gif", size: 1000 }), null);
    assert.notEqual(artworkRejectionReason({ type: "image/heic", size: 1000 }), null);
  });

  test("the size ceiling is the bucket's own 10MB, checked earlier", () => {
    assert.equal(MAX_ARTWORK_BYTES, 10 * 1024 * 1024);
    assert.equal(
      artworkRejectionReason({ type: "image/png", size: MAX_ARTWORK_BYTES }),
      null
    );
    assert.notEqual(
      artworkRejectionReason({ type: "image/png", size: MAX_ARTWORK_BYTES + 1 }),
      null
    );
    assert.notEqual(artworkRejectionReason({ type: "image/png", size: 0 }), null);
  });

  test("a PDF is never put in an <img>", () => {
    assert.equal(isRenderableArtwork("application/pdf"), false);
    assert.equal(isRenderableArtwork("image/png"), true);
    assert.equal(isRenderableArtwork(null), false);
  });

  test("the bucket is named once, and it is the canonical one", () => {
    assert.equal(INVITATION_ARTWORK_BUCKET, "invitation-artwork");
  });
});

describe("invitation artwork — one rule, told the same way on both surfaces", () => {
  test("the hint under the control is the approved sentence, exactly", () => {
    // Pinned character for character, middle dot and all, because the
    // native app shows the same sentence and a reword on one surface
    // silently stops being the same product. It also has to agree with
    // the two rules below it — see the assertions that follow.
    assert.equal(ARTWORK_LIMITS_HINT, "PDF, JPG or PNG · Max 10 MB");
  });

  test("the hint tells the truth about the types it names", () => {
    // Each format the sentence promises is actually accepted.
    assert.equal(artworkRejectionCode({ type: "application/pdf", size: 1 }), null);
    assert.equal(artworkRejectionCode({ type: "image/jpeg", size: 1 }), null);
    assert.equal(artworkRejectionCode({ type: "image/png", size: 1 }), null);
    // JPG and JPEG are one mime type; there is no second value to allow.
    assert.equal(ALLOWED_ARTWORK_MIME_TYPES.includes("image/jpeg"), true);
  });

  test("the hint tells the truth about the size it names", () => {
    assert.equal(MAX_ARTWORK_BYTES, 10 * 1024 * 1024);
    assert.match(ARTWORK_LIMITS_HINT, /10 MB/);
  });

  test("wrong kind and too big are different answers, not one shrug", () => {
    // A host told only "that didn't work" has to guess which rule they
    // broke, and the two have different fixes.
    const big = { type: "image/png", size: MAX_ARTWORK_BYTES + 1 };
    const wrong = { type: "image/gif", size: 1000 };
    assert.equal(artworkRejectionCode(big), "file_too_large");
    assert.equal(artworkRejectionCode(wrong), "unsupported_file_type");
    assert.notEqual(artworkRejectionReason(big), artworkRejectionReason(wrong));
  });

  test("the rejection codes are the ones the native picker throws", () => {
    // InvitationFilePickerError carries exactly these three strings, so
    // both surfaces can name the same refusal.
    assert.deepEqual(Object.keys(ARTWORK_REJECTION_MESSAGES).sort(), [
      "empty_file",
      "file_too_large",
      "unsupported_file_type",
    ]);
    for (const message of Object.values(ARTWORK_REJECTION_MESSAGES)) {
      assert.equal(message.length > 0, true);
    }
    assert.equal(
      new Set(Object.values(ARTWORK_REJECTION_MESSAGES)).size,
      3,
      "each refusal needs its own sentence"
    );
  });

  test("exactly 10 MB is accepted; one byte more is not", () => {
    // The boundary is the bucket's own file_size_limit, so "at the
    // limit" must pass here or the two disagree about the same file.
    assert.equal(
      artworkRejectionCode({ type: "image/png", size: MAX_ARTWORK_BYTES }),
      null
    );
    assert.equal(
      artworkRejectionCode({ type: "image/png", size: MAX_ARTWORK_BYTES + 1 }),
      "file_too_large"
    );
  });

  test("an empty file is refused before it is uploaded", () => {
    assert.equal(
      artworkRejectionCode({ type: "application/pdf", size: 0 }),
      "empty_file"
    );
  });

  test("type is judged before size, so a huge GIF is still a GIF", () => {
    // Telling a host to shrink a file they cannot use either way would
    // send them off to do the wrong work.
    assert.equal(
      artworkRejectionCode({ type: "image/gif", size: MAX_ARTWORK_BYTES * 3 }),
      "unsupported_file_type"
    );
  });
});
