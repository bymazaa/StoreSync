"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createStatementFormat } from "@/lib/reports/format";

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
  // The same formatter builds the screen figures and the server-rendered statement PDF.
  const statement = createStatementFormat({ locale, timezone, currencyCode: currency });
  return {
    locale,
    timezone,
    currency,
    statement,
    formatMoney: statement.money,
    formatAmount: statement.amount,
    formatNumber: statement.number,
    formatDate: statement.date,
    formatDateTime: statement.dateTime,
  };
}
