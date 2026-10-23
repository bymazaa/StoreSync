import { SHOP_DEFAULTS } from "@/lib/constants/app";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(SHOP_DEFAULTS.locale, {
    style: "currency",
    currency: SHOP_DEFAULTS.currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * SKU prefixes have to be guessed from a category name and remembered by staff who read them
 * off a sticker, so they stay short and rule-based: one word gives its first letters
 * (Rice -> RIC), several words give their initials (Cooking Oil -> CO). Only A-Z0-9 come out.
 */
export function skuCategoryPrefix(categoryName?: string | null) {
  const words = (categoryName ?? "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (words.length === 0) return "PR";
  if (words.length === 1) return words[0].slice(0, 3);
  return words.slice(0, 3).map((word) => word[0]).join("");
}
