"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createStatementFormat } from "@/lib/reports/format";

const CurrencyContext = createContext("USD");
const CountryContext = createContext("US");
const PermissionContext = createContext<string[]>([]);
const UserIdContext = createContext("");
const RoleContext = createContext("");
const FormattingContext = createContext({ locale: "en-US", timezone: "America/New_York" });

export function ShopProvider({
  userId,
  role = "",
  countryCode,
  currencyCode,
  locale,
  timezone,
  permissions,
  children,
}: {
  userId: string;
  role?: string;
  countryCode: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  permissions: string[];
  children: ReactNode;
}) {
  return (
    <UserIdContext.Provider value={userId}>
      <RoleContext.Provider value={role}>
        <CountryContext.Provider value={countryCode}>
          <CurrencyContext.Provider value={currencyCode}>
            <FormattingContext.Provider value={{ locale, timezone }}>
              <PermissionContext.Provider value={permissions}>
                {children}
              </PermissionContext.Provider>
            </FormattingContext.Provider>
          </CurrencyContext.Provider>
        </CountryContext.Provider>
      </RoleContext.Provider>
    </UserIdContext.Provider>
  );
}

export function useShopUserId() {
  return useContext(UserIdContext);
}

export function useShopRole() {
  return useContext(RoleContext);
}

export function useCanViewProfit() {
  const role = useShopRole();
  return role === "OWNER" || role === "MANAGER";
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
  // The same formatter builds the screen figures and the printed statement.
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
