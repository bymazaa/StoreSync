"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Bell, Boxes, ChevronDown, CircleHelp, FileChartColumnIncreasing,
  LayoutDashboard, LogOut, Menu, Settings2, ShoppingBag,
  ShoppingCart, Truck, UsersRound, Wallet, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShopProvider } from "@/components/app/shop-context";
import { HeaderSearch } from "@/components/app/header-search";
import { APP_META } from "@/lib/constants/app";
import { refreshAuthSession } from "@/lib/client-api";

const navigation = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, requires: ["VIEW_REPORTS"] },
  { label: "Sales & POS", href: "/sales", icon: ShoppingCart, requires: ["CREATE_SALES"] },
  { label: "Purchases", href: "/purchases", icon: ShoppingBag, requires: ["CREATE_PURCHASES"] },
  { label: "Products", href: "/products", icon: Boxes, requires: ["MANAGE_PRODUCTS", "CREATE_SALES", "CREATE_PURCHASES"] },
  { label: "Inventory", href: "/inventory", icon: Activity, requires: ["ADJUST_STOCK", "VIEW_REPORTS", "MANAGE_PRODUCTS"] },
  { label: "Customers", href: "/customers", icon: UsersRound, requires: ["CREATE_SALES"] },
  { label: "Suppliers", href: "/suppliers", icon: Truck, requires: ["CREATE_PURCHASES"] },
  { label: "Reports", href: "/reports", icon: FileChartColumnIncreasing, requires: ["VIEW_REPORTS"] },
  { label: "Expenses", href: "/expenses", icon: Wallet, requires: ["MANAGE_EXPENSES", "VIEW_REPORTS"] },
  { label: "Settings", href: "/settings", icon: Settings2, requires: ["MANAGE_SETTINGS", "MANAGE_USERS"] },
  { label: "Guide & setup", href: "/guide", icon: CircleHelp, requires: ["VIEW_REPORTS", "MANAGE_PRODUCTS", "ADJUST_STOCK", "CREATE_SALES", "CREATE_PURCHASES", "MANAGE_SETTINGS", "MANAGE_USERS"] },
];

type AppShellProps = {
  user: { id: string; fullName: string; email: string; role: string };
  shopName: string;
  countryCode: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  permissions: string[];
  children: ReactNode;
};

const roleLabels: Record<string, string> = {
  OWNER: "Shop owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  STOCK_CLERK: "Stock clerk",
};

export function AppShell({ user, shopName, countryCode, currencyCode, locale, timezone, permissions, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const visibleNavigation = navigation.filter((item) => item.requires.some((permission) => permissions.includes(permission)));

  useEffect(() => {
    const handleUnauthorized = () => { router.replace("/login"); router.refresh(); };
    window.addEventListener("stockpilot:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("stockpilot:unauthorized", handleUnauthorized);
  }, [router]);

  useEffect(() => {
    let lastRefreshAttempt = 0;
    const refreshWhileActive = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshAttempt < 60_000) return;
      lastRefreshAttempt = Date.now();
      void refreshAuthSession();
    };

    // Rebase the access-token lifetime on mount, then refresh before its 15-minute expiry.
    refreshWhileActive();
    const interval = window.setInterval(refreshWhileActive, 10 * 60 * 1000);
    window.addEventListener("focus", refreshWhileActive);
    document.addEventListener("visibilitychange", refreshWhileActive);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhileActive);
      document.removeEventListener("visibilitychange", refreshWhileActive);
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-border bg-sidebar px-4 pb-5 pt-6 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <Link className="flex min-w-0 items-center gap-3" href="/" aria-label={`${APP_META.name} home`} onClick={() => setMenuOpen(false)}>
            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-sm"><ShoppingBag size={20} strokeWidth={2.2} /></span>
            <span className="min-w-0"><span className="block text-[17px] font-bold tracking-tight text-white">{APP_META.name}</span><span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">Shop management</span></span>
          </Link>
          <button type="button" aria-label="Close navigation" className="grid size-8 place-items-center rounded-lg text-sidebar-foreground hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(false)}><X size={17} /></button>
        </div>
        <div className="mt-9 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Workspace</div>
        <nav aria-label="Main navigation" className="mt-3 space-y-1">
          {visibleNavigation.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors ${active ? "bg-white text-[#0d897a] shadow-sm dark:bg-primary dark:text-primary-foreground dark:shadow-[0_0_0_1px_rgb(84_197_177_/_0.3)]" : "text-sidebar-foreground hover:bg-white/10 hover:text-white"}`}><Icon size={17} strokeWidth={1.8} /> {label}</Link>;
          })}
        </nav>
        <div className="mt-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5"><div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">{shopName.trim().charAt(0).toUpperCase() || "S"}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{shopName}</p><p className="mt-0.5 text-[10px] text-white/55">Self-hosted workspace</p></div></div></div>
          <p className="mt-4 px-2 text-[10px] text-white/40">Your shop data stays on this server</p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[252px]">
        <header className="app-shell-header sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" type="button" onClick={() => setMenuOpen(true)} className="grid size-9 place-items-center rounded-xl border border-border bg-card text-foreground lg:hidden"><Menu size={18} /></button>
            <HeaderSearch currencyCode={currencyCode} locale={locale} />
            <p className="text-sm font-semibold text-foreground sm:hidden">{navigation.find((item) => item.href === pathname)?.label ?? "StockPilot"}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"><Bell size={17} /></button>
            <span className="hidden h-8 w-px bg-border sm:block" />
            <div className="relative">
              <button onClick={() => setProfileOpen((open) => !open)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 text-left hover:bg-muted" aria-expanded={profileOpen} aria-label="Open profile menu" type="button">
                <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{initials}</span>
                <span className="hidden max-w-36 sm:block"><span className="block truncate text-xs font-semibold leading-4 text-foreground">{user.fullName}</span><span className="block text-[10px] text-muted-foreground">{roleLabels[user.role] ?? user.role}</span></span>
                <ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
              </button>
              {profileOpen && <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-border bg-card p-2 shadow-lg"><p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p><Link href="/settings?tab=team" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"><Settings2 size={15} /> Account settings</Link><button onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60" type="button"><LogOut size={15} /> {loggingOut ? "Signing out..." : "Sign out"}</button></div>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-8 xl:px-10"><ShopProvider countryCode={countryCode} currencyCode={currencyCode} locale={locale} timezone={timezone} permissions={permissions}>{children}</ShopProvider></main>
      </div>
    </div>
  );
}
