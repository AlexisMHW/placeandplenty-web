"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PAPER_PIECES,
  PAPER_SIZES,
  paperPiece,
  type PaperPieceKind,
  type PaperSizeId,
} from "@/lib/paper-suite-catalog";

type ProductCandidate = {
  productUid: string;
  attributes: Record<string, string | number>;
  title?: string;
};

type TemplateId =
  | "classic-editorial"
  | "soft-botanical"
  | "modern-clean"
  | "warm-celebration";

type Recipient = {
  country: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  state: string;
  email: string;
  phone: string;
};

type QuoteSummary = {
  gelatoCostCents: number;
  productCostCents: number;
  shippingCostCents: number;
  shipmentMethodName: string | null;
  deliveryLabel: string | null;
  currency: string;
};

type PricingSummary = {
  retailSubtotalCents: number;
  gelatoCostCents: number;
  marginCents: number;
  testModeAtCost: boolean;
};

type MatchedPalette = {
  background: string;
  text: string;
  accent: string;
  rule: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function relativeLuminance(r: number, g: number, b: number) {
  const convert = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
}

async function extractInvitationPalette(url: string): Promise<MatchedPalette> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("invitation_image_load_failed"));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 72;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas_unavailable");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 180) continue;
    const r = Math.min(255, Math.round(pixels[index] / 32) * 32);
    const g = Math.min(255, Math.round(pixels[index + 1] / 32) * 32);
    const b = Math.min(255, Math.round(pixels[index + 2] / 32) * 32);
    const key = r + "," + g + "," + b;
    const current = buckets.get(key);
    if (current) current.count += 1;
    else buckets.set(key, { count: 1, r, g, b });
  }

  const colors = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 16);
  if (colors.length === 0) throw new Error("no_palette");

  const background = colors[0];
  const distance = (a: typeof background, b: typeof background) =>
    Math.sqrt(
      Math.pow(a.r - b.r, 2) +
        Math.pow(a.g - b.g, 2) +
        Math.pow(a.b - b.b, 2)
    );

  const accent =
    colors.find((color) => distance(background, color) > 105) ||
    colors.find((color) => distance(background, color) > 65) ||
    { r: 201, g: 162, b: 39, count: 0 };

  const luminance = relativeLuminance(background.r, background.g, background.b);
  const text = luminance > 0.46 ? "#142720" : "#F7F4EC";

  return {
    background: rgbToHex(background.r, background.g, background.b),
    text,
    accent: rgbToHex(accent.r, accent.g, accent.b),
    rule: rgbToHex(accent.r, accent.g, accent.b),
  };
}

function productLabel(product: ProductCandidate) {
  if (product.title) return product.title;
  const attrs = product.attributes || {};
  const format = String(attrs.PaperFormat || attrs.Format || attrs.Size || "").trim();
  const stock = String(attrs.PaperType || attrs.Media || attrs.Material || "").trim();
  const finish = String(attrs.Finish || attrs.Coating || "").trim();
  const pieces = [format, stock, finish].filter(Boolean);
  return pieces.length ? pieces.join(" · ") : product.productUid;
}

export default function PaperSuiteOrderBuilder({
  gatheringId,
  multiDay,
  invitationUrl,
}: {
  gatheringId: string;
  multiDay: boolean;
  invitationUrl?: string | null;
}) {
  const availablePieces = useMemo(
    () => PAPER_PIECES.filter((piece) => piece.id !== "itinerary" || multiDay),
    [multiDay]
  );

  const initialKind: PaperPieceKind = multiDay ? "itinerary" : "menu";
  const initialPiece = paperPiece(initialKind)!;

  const [kind, setKind] = useState<PaperPieceKind>(initialKind);
  const [size, setSize] = useState<PaperSizeId>(initialPiece.defaultSize);
  const [template, setTemplate] = useState<TemplateId>("classic-editorial");
  const [bodyCopy, setBodyCopy] = useState("");
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCandidate[]>([]);
  const [productUid, setProductUid] = useState("");
  const [quantity, setQuantity] = useState(12);
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [productBusy, setProductBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [quoteSummary, setQuoteSummary] = useState<QuoteSummary | null>(null);
  const [pricing, setPricing] = useState<PricingSummary | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [matchedPalette, setMatchedPalette] = useState<MatchedPalette | null>(null);
  const [matchingBusy, setMatchingBusy] = useState(false);

  const piece = paperPiece(kind)!;
  const sizeConfig = PAPER_SIZES[size];

  useEffect(() => {
    setProductBusy(true);
    setProducts([]);
    setProductUid("");
    setPrintUrl(null);
    setQuote(null);
    setQuoteSummary(null);
    setPricing(null);
    setRecipient(null);

    const catalog = size === "8x10" || size === "a4" ? "posters" : "cards";

    fetch(
      "/api/paper-suite/gelato/products?catalog=" +
        encodeURIComponent(catalog) +
        "&size=" +
        encodeURIComponent(size),
      {
        credentials: "same-origin",
        cache: "no-store",
      }
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "product_discovery_failed");
        return body as { candidates?: ProductCandidate[] };
      })
      .then((body) => {
        const next = body.candidates || [];
        setProducts(next);
        if (next[0]) setProductUid(next[0].productUid);
      })
      .catch(() => {
        setMessage("Gelato products for this size are still being matched. You can generate the preview now.");
      })
      .finally(() => setProductBusy(false));
  }, [size]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.productUid === productUid) || null,
    [products, productUid]
  );

  function resetQuote() {
    setQuote(null);
    setQuoteSummary(null);
    setPricing(null);
    setRecipient(null);
  }

  function changeKind(nextKind: PaperPieceKind) {
    const nextPiece = paperPiece(nextKind);
    if (!nextPiece) return;
    setKind(nextKind);
    setSize(nextPiece.defaultSize);
    setPrintUrl(null);
    resetQuote();
    setMessage("");
    setBodyCopy("");
  }

  async function matchInvitation() {
    if (!invitationUrl) {
      setMessage("Upload a JPG or PNG invitation first, then return here to match the suite.");
      return;
    }

    setMatchingBusy(true);
    setMessage("");
    try {
      const palette = await extractInvitationPalette(invitationUrl);
      setMatchedPalette(palette);
      setPrintUrl(null);
      resetQuote();
      setMessage("Invitation colors matched. Choose any Place & Plenty layout and the suite will use this palette.");
    } catch {
      setMessage("We could not read that invitation image automatically. You can still use one of the four Place & Plenty designs.");
    } finally {
      setMatchingBusy(false);
    }
  }

  async function generatePreview() {
    setBusy(true);
    setMessage("");
    resetQuote();
    try {
      const response = await fetch("/api/paper-suite/print-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          gatheringId,
          kind,
          size,
          template,
          bodyCopy: bodyCopy || undefined,
          palette: matchedPalette || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "print_file_failed");
      setPrintUrl(body.url);
      setMessage(
        piece.label +
          " preview generated at " +
          sizeConfig.label +
          " from the live gathering."
      );
    } catch {
      setMessage("The print preview could not be generated yet.");
    } finally {
      setBusy(false);
    }
  }

  function recipientFrom(form: FormData): Recipient {
    return {
      country: String(form.get("country") || "US"),
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      addressLine1: String(form.get("addressLine1") || ""),
      addressLine2: String(form.get("addressLine2") || ""),
      city: String(form.get("city") || ""),
      postCode: String(form.get("postCode") || ""),
      state: String(form.get("state") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
    };
  }

  async function requestQuote(form: FormData) {
    if (!printUrl || !productUid) {
      setMessage("Generate a print preview and choose a paper product first.");
      return;
    }

    setQuoteBusy(true);
    setMessage("");
    resetQuote();

    const nextRecipient = recipientFrom(form);

    try {
      const response = await fetch("/api/paper-suite/gelato/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          gatheringId,
          productUid,
          quantity,
          fileUrl: printUrl,
          recipient: nextRecipient,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "quote_failed");
      setQuote(body.quote || null);
      setQuoteSummary(body.normalized || null);
      setPricing(body.pricing || null);
      setRecipient(nextRecipient);
      setMessage("Live Gelato quote received. No order has been placed.");
    } catch {
      setMessage("Gelato could not return a quote for that combination yet.");
    } finally {
      setQuoteBusy(false);
    }
  }

  async function startCheckout() {
    if (!printUrl || !productUid || !recipient) {
      setMessage("Get a current shipping quote before continuing to checkout.");
      return;
    }

    setCheckoutBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/paper-suite/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          gatheringId,
          kind,
          size,
          template,
          productUid,
          quantity,
          fileUrl: printUrl,
          recipient,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) {
        if (body.error === "paper_suite_pricing_not_configured") {
          throw new Error("pricing_not_configured");
        }
        throw new Error(body.error || "checkout_failed");
      }

      window.location.assign(body.url);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "pricing_not_configured"
          ? "Paper Suite live retail pricing has not been turned on yet."
          : "Secure checkout could not be started yet."
      );
      setCheckoutBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-gold/30 bg-cream p-5 md:p-7">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">
        Build a printable piece
      </p>
      <h2 className="mt-2 font-display text-2xl text-forest">Choose the piece, size and design</h2>
      <p className="mt-2 max-w-3xl font-body text-sm leading-relaxed text-forest/70">
        Paper Suite adapts the same gathering data to each print format instead of stretching one design across every size.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Piece</span>
          <select
            value={kind}
            onChange={(event) => changeKind(event.target.value as PaperPieceKind)}
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          >
            {availablePieces.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1 font-body text-[0.68rem] text-forest/50">{piece.source}</p>
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Size</span>
          <select
            value={size}
            onChange={(event) => {
              setSize(event.target.value as PaperSizeId);
              setMessage("");
            }}
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          >
            {piece.sizes.map((sizeId) => (
              <option key={sizeId} value={sizeId}>{PAPER_SIZES[sizeId].label}</option>
            ))}
          </select>
          <p className="mt-1 font-body text-[0.68rem] text-forest/50">
            {sizeConfig.family === "tall"
              ? "Tall layout"
              : sizeConfig.family === "square"
                ? "Square layout"
                : sizeConfig.family === "sign"
                  ? "Sign layout"
                  : "Portrait card layout"}
          </p>
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Design</span>
          <select
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value as TemplateId);
              setPrintUrl(null);
              resetQuote();
            }}
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          >
            <option value="classic-editorial">Classic Editorial</option>
            <option value="soft-botanical">Soft Botanical</option>
            <option value="modern-clean">Modern Clean</option>
            <option value="warm-celebration">Warm Celebration</option>
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {invitationUrl && (
              <button
                type="button"
                onClick={matchInvitation}
                disabled={matchingBusy}
                className="rounded-full border border-gold/40 bg-cream px-3 py-1.5 font-body text-[0.68rem] font-semibold text-forest disabled:opacity-60"
              >
                {matchingBusy ? "Matching…" : "Match My Invitation"}
              </button>
            )}
            {matchedPalette && (
              <button
                type="button"
                onClick={() => {
                  setMatchedPalette(null);
                  setPrintUrl(null);
                  resetQuote();
                  setMessage("Place & Plenty house colors restored.");
                }}
                className="font-body text-[0.68rem] font-semibold text-forest/60 underline decoration-gold underline-offset-4"
              >
                Use P&P colors
              </button>
            )}
          </div>
          {matchedPalette && (
            <div className="mt-2 flex items-center gap-1.5" aria-label="Matched invitation palette">
              {[matchedPalette.background, matchedPalette.accent, matchedPalette.text].map((color) => (
                <span
                  key={color}
                  className="h-5 w-5 rounded-full border border-forest/15"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <span className="ml-1 font-body text-[0.66rem] text-forest/50">Invitation palette</span>
            </div>
          )}
        </label>
      </div>

      {(kind === "thank-you" || kind === "details" || kind === "welcome-sign") && (
        <label className="mt-5 block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">
            {kind === "thank-you"
              ? "Thank-you message"
              : kind === "welcome-sign"
                ? "Welcome message"
                : "Details note"}
          </span>
          <textarea
            value={bodyCopy}
            onChange={(event) => {
              setBodyCopy(event.target.value.slice(0, 700));
              setPrintUrl(null);
              resetQuote();
            }}
            rows={4}
            placeholder={
              kind === "thank-you"
                ? "Thank you for gathering with us…"
                : kind === "welcome-sign"
                  ? "Welcome — we’re glad you’re here."
                  : "Parking, attire, arrival notes or anything guests should keep handy."
            }
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          />
          <p className="mt-1 text-right font-body text-[0.68rem] text-forest/45">{bodyCopy.length}/700</p>
        </label>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={generatePreview}
          disabled={busy}
          className="rounded-full bg-forest px-6 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate " + piece.label + " Preview"}
        </button>
      </div>

      {printUrl && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-sage/30 bg-white">
            <img src={printUrl} alt={piece.label + " print preview"} className="h-auto w-full" />
          </div>

          <div>
            <label className="block">
              <span className="mb-1 block font-body text-sm font-semibold text-forest">Gelato paper product</span>
              <select
                value={productUid}
                onChange={(event) => {
                  setProductUid(event.target.value);
                  resetQuote();
                }}
                disabled={productBusy}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest disabled:opacity-60"
              >
                {productBusy && <option value="">Matching {sizeConfig.label} products…</option>}
                {!productBusy && products.length === 0 && <option value="">No mapped product found yet</option>}
                {products.map((product) => (
                  <option key={product.productUid} value={product.productUid}>{productLabel(product)}</option>
                ))}
              </select>
              {selectedProduct && (
                <p className="mt-1 break-all font-body text-[0.68rem] text-forest/45">{selectedProduct.productUid}</p>
              )}
            </label>

            <label className="mt-4 block max-w-xs">
              <span className="mb-1 block font-body text-sm font-semibold text-forest">Quantity</span>
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(event) => {
                  setQuantity(Math.max(1, Number(event.target.value) || 1));
                  resetQuote();
                }}
                className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
              />
            </label>

            <form
              className="mt-5 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await requestQuote(new FormData(event.currentTarget));
              }}
            >
              <input name="firstName" required placeholder="First name" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="lastName" required placeholder="Last name" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="email" type="email" required placeholder="Email" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest sm:col-span-2" />
              <input name="addressLine1" required placeholder="Street address" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest sm:col-span-2" />
              <input name="addressLine2" placeholder="Apt / suite (optional)" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest sm:col-span-2" />
              <input name="city" required placeholder="City" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="state" required placeholder="State" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="postCode" required placeholder="ZIP code" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="country" defaultValue="US" required placeholder="Country code" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
              <input name="phone" placeholder="Phone (optional)" className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest sm:col-span-2" />
              <button
                type="submit"
                disabled={quoteBusy || !productUid}
                className="mt-2 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60 sm:col-span-2"
              >
                {quoteBusy ? "Getting Quote…" : "Get Live Print & Shipping Quote"}
              </button>
            </form>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-5 rounded-lg border border-sage/25 bg-offwhite px-4 py-3 font-body text-sm text-forest/70">{message}</p>
      )}

      {quoteSummary && (
        <section className="mt-5 rounded-xl border border-gold/30 bg-offwhite p-5">
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-goldInk">Quote summary</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/50">Print</dt>
              <dd className="mt-1 font-display text-lg text-forest">{money(quoteSummary.productCostCents)}</dd>
            </div>
            <div>
              <dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/50">Shipping</dt>
              <dd className="mt-1 font-display text-lg text-forest">{money(quoteSummary.shippingCostCents)}</dd>
            </div>
            <div>
              <dt className="font-body text-xs uppercase tracking-[0.12em] text-forest/50">Estimated delivery</dt>
              <dd className="mt-1 font-body text-sm text-forest/75">{quoteSummary.deliveryLabel || "Shown at fulfillment"}</dd>
            </div>
          </dl>

          {pricing && (
            <div className="mt-4 border-t border-sage/20 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-body text-xs uppercase tracking-[0.12em] text-forest/50">
                    {pricing.testModeAtCost ? "Sandbox checkout total before tax" : "Place & Plenty subtotal before tax"}
                  </p>
                  <p className="mt-1 font-display text-2xl text-forest">{money(pricing.retailSubtotalCents)}</p>
                </div>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkoutBusy}
                  className="rounded-full bg-forest px-6 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60"
                >
                  {checkoutBusy ? "Opening Checkout…" : "Continue to Secure Checkout"}
                </button>
              </div>
              {pricing.testModeAtCost && (
                <p className="mt-2 font-body text-xs leading-relaxed text-forest/55">
                  Sandbox mode is testing at fulfillment cost. A production retail margin is not locked yet.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {quote && (
        <details className="mt-4 rounded-lg border border-sage/25 bg-offwhite p-4">
          <summary className="cursor-pointer font-body text-sm font-semibold text-forest">View Gelato quote details</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-forest/70">{JSON.stringify(quote, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
