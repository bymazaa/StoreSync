"use client";

import { createContext, useContext, type ReactNode } from "react";

const CurrencyContext = createContext("USD");
const CountryContext = createContext("US");
const PermissionContext = createContext<string[]>([]);
const FormattingContext = createContext({ locale: "en-US", timezone: "America/New_York" });

export function ShopProvider({ countryCode, currencyCode, locale, timezone, permissions, children }: { countryCode: string; currencyCode: string; locale: string; timezone: string; permissions: string[]; children: ReactNode }) {
  return <CountryContext.Provider value={countryCode}><CurrencyContext.Provider value={currencyCode}><FormattingContext.Provider value={{ locale, timezone }}><PermissionContext.Provider value={permissions}>{children}</PermissionContext.Provider></FormattingContext.Provider></CurrencyContext.Provider></CountryContext.Provider>;
}

export function useCurrencyCode() {
  return useContext(CurrencyContext);
}

export function useShopCountryCode() {
  return useContext(CountryContext);
}

export function useHasPermission(permission: string) {
  return useContext(PermissionContext).includes(permission);
}

export function useShopPermissions() {
  return useContext(PermissionContext);
}

export function useShopFormat() {
  const currency = useCurrencyCode();
  const { locale, timezone } = useContext(FormattingContext);
  return {
    locale,
    timezone,
    currency,
    formatMoney(value: string | number) {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
    },
    formatNumber(value: string | number, maximumFractionDigits = 2) {
      return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(Number(value));
    },
    formatDate(value: string | Date) {
      return new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: "medium" }).format(new Date(value));
    },
    formatDateTime(value: string | Date) {
      return new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    },
  };
}
