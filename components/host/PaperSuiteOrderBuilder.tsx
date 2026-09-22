"use client";

import { useEffect, useMemo, useState } from "react";

type ProductCandidate = {
  productUid: string;
  attributes: Record<string, string | number>;
};

type TemplateId =
  | "classic-editorial"
  | "soft-botanical"
  | "modern-clean"
  | "warm-celebration";

function productLabel(product: ProductCandidate) {
  const attrs = product.attributes || {};
  const format = String(attrs.PaperFormat || attrs.Format || "").trim();
  const stock = String(attrs.PaperType || attrs.Media || "").trim();
  const finish = String(attrs.Finish || attrs.Coating || "").trim();
  const pieces = [format, stock, finish].filter(Boolean);
  return pieces.length ? pieces.join(" · ") : product.productUid;
}

export default function PaperSuiteOrderBuilder({
  gatheringId,
  multiDay,
}: {
  gatheringId: string;
  multiDay: boolean;
}) {
  const [kind, setKind] = useState<"menu" | "itinerary">(multiDay ? "itinerary" : "menu");
  const [template, setTemplate] = useState<TemplateId>("classic-editorial");
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCandidate[]>([]);
  const [productUid, setProductUid] = useState("");
  const [quantity, setQuantity] = useState(12);
  const [busy, setBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/paper-suite/gelato/products?catalog=cards", {
      credentials: "same-origin",
      cache: "no-store",
    })
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
        setMessage("Gelato paper sizes are still loading. You can generate the print preview now.");
      });
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.productUid === productUid) || null,
    [products, productUid]
  );

  async function generatePreview() {
    setBusy(true);
    setMessage("");
    setQuote(null);
    try {
      const response = await fetch("/api/paper-suite/print-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ gatheringId, kind, template }),
      });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "print_file_failed");
      setPrintUrl(body.url);
      setMessage("Print file generated from the live gathering.");
    } catch {
      setMessage("The print preview could not be generated yet.");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote(form: FormData) {
    if (!printUrl || !productUid) {
      setMessage("Generate a print preview and choose a paper product first.");
      return;
    }

    setQuoteBusy(true);
    setMessage("");
    setQuote(null);

    const recipient = {
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
          recipient,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "quote_failed");
      setQuote(body.quote);
      setMessage("Live Gelato quote received. No order has been placed.");
    } catch {
      setMessage("Gelato could not return a quote for that combination yet.");
    } finally {
      setQuoteBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-gold/30 bg-cream p-5 md:p-7">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">
        Build a printable piece
      </p>
      <h2 className="mt-2 font-display text-2xl text-forest">Preview, size and quote</h2>
      <p className="mt-2 max-w-3xl font-body text-sm leading-relaxed text-forest/70">
        This uses the gathering you already built. Generate the print file first, then choose a Gelato paper product and request a live fulfillment quote.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Piece</span>
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as "menu" | "itinerary");
              setPrintUrl(null);
              setQuote(null);
            }}
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          >
            <option value="menu">Menu card</option>
            {multiDay && <option value="itinerary">Weekend itinerary</option>}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Design</span>
          <select
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value as TemplateId);
              setPrintUrl(null);
              setQuote(null);
            }}
            className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
          >
            <option value="classic-editorial">Classic Editorial</option>
            <option value="soft-botanical">Soft Botanical</option>
            <option value="modern-clean">Modern Clean</option>
            <option value="warm-celebration">Warm Celebration</option>
          </select>
        </label>

        <div>
          <span className="mb-1 block font-body text-sm font-semibold text-forest">Print file</span>
          <button
            type="button"
            onClick={generatePreview}
            disabled={busy}
            className="w-full rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60"
          >
            {busy ? "Generating…" : "Generate Preview"}
          </button>
        </div>
      </div>

      {printUrl && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-sage/30 bg-white">
            <img src={printUrl} alt="Paper Suite print preview" className="h-auto w-full" />
          </div>

          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">Gelato paper product</span>
                <select
                  value={productUid}
                  onChange={(event) => setProductUid(event.target.value)}
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
                >
                  {products.length === 0 && <option value="">Loading available paper…</option>}
                  {products.map((product) => (
                    <option key={product.productUid} value={product.productUid}>
                      {productLabel(product)}
                    </option>
                  ))}
                </select>
                {selectedProduct && (
                  <p className="mt-1 break-all font-body text-[0.68rem] text-forest/45">
                    {selectedProduct.productUid}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
                />
              </label>
            </div>

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
        <p className="mt-5 rounded-lg border border-sage/25 bg-offwhite px-4 py-3 font-body text-sm text-forest/70">
          {message}
        </p>
      )}

      {quote && (
        <details className="mt-4 rounded-lg border border-sage/25 bg-offwhite p-4">
          <summary className="cursor-pointer font-body text-sm font-semibold text-forest">
            View Gelato quote details
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-forest/70">
            {JSON.stringify(quote, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
