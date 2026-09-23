import {
  getGelatoProduct,
  getGelatoProductPrices,
  type GelatoProduct,
} from "@/lib/gelato";
import type { PaperSizeId } from "@/lib/paper-suite-catalog";

export const GELATO_PAPER_FORMAT_BY_SIZE: Record<PaperSizeId, string> = {
  a6: "A6",
  "5x7": "5R",
  "4x9": "4x9-inch",
  "square-525": "SX",
  a5: "A5",
  "8x10": "200x250-mm",
  a4: "A4",
};

export const GELATO_CATALOG_BY_SIZE: Record<PaperSizeId, "cards" | "posters"> = {
  a6: "cards",
  "5x7": "cards",
  "4x9": "posters",
  "square-525": "cards",
  a5: "cards",
  "8x10": "posters",
  a4: "posters",
};

export function gelatoPaperFormat(size: PaperSizeId) {
  return GELATO_PAPER_FORMAT_BY_SIZE[size];
}

export function gelatoCatalog(size: PaperSizeId) {
  return GELATO_CATALOG_BY_SIZE[size];
}

function orientationAllowed(product: GelatoProduct, size: PaperSizeId) {
  const orientation = String(product.attributes?.Orientation || "").toLowerCase();
  if (!orientation) return true;
  if (size === "square-525") return orientation === "hor" || orientation === "ver" || orientation.includes("square");
  return orientation === "ver" || orientation === "portrait";
}

function oneSidedColorAllowed(product: GelatoProduct) {
  const color = String(product.attributes?.ColorType || "").toLowerCase();
  return !color || color.includes("4-0");
}

export function gelatoProductMatchesSize(product: GelatoProduct, size: PaperSizeId) {
  const format = String(product.attributes?.PaperFormat || product.attributes?.Format || "");
  const status = String(product.attributes?.ProductStatus || "").toLowerCase();
  const folding = String(product.attributes?.FoldingType || "none").toLowerCase();
  const spot = String(product.attributes?.SpotFinishingType || "none").toLowerCase();
  const supportsUS = !product.supportedCountries || product.supportedCountries.includes("US");

  return (
    format === gelatoPaperFormat(size) &&
    orientationAllowed(product, size) &&
    oneSidedColorAllowed(product) &&
    (!status || status === "activated") &&
    (folding === "none" || folding === "") &&
    (spot === "none" || spot === "") &&
    supportsUS
  );
}

export async function validateGelatoProductForSize(productUid: string, size: PaperSizeId) {
  const product = await getGelatoProduct(productUid);
  return gelatoProductMatchesSize(product, size);
}

export async function gelatoSupportedQuantities(productUid: string) {
  const prices = await getGelatoProductPrices(productUid, {
    country: "US",
    currency: "USD",
  });

  return [...new Set(
    prices
      .map((entry) => Number(entry.quantity))
      .filter((quantity) => Number.isInteger(quantity) && quantity > 0 && quantity <= 500)
  )].sort((a, b) => a - b);
}

export async function validateGelatoQuantity(productUid: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return false;
  const supported = await gelatoSupportedQuantities(productUid);
  return supported.includes(quantity);
}
