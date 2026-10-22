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
