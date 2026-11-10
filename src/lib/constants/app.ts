export const APP_META = {
  name: "StockPilot",
  description: "A clear view of your shop, every day.",
} as const;

export const SHOP_DEFAULTS = {
  country: "US",
  currency: "USD",
  locale: "en-US",
  timezone: "America/New_York",
} as const;

export const INVENTORY_UNITS = ["kg", "g", "liter", "piece", "bag", "packet"] as const;
export const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "Mobile payment"] as const;
export const STOCK_ALERT = { lowStockFactor: 1, expiryWarningDays: 30 } as const;
export const THEME_OPTIONS = ["light", "dark", "system"] as const;



