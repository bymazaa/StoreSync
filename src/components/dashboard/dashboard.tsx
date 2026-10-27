"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, Boxes, CircleAlert, PackagePlus, Receipt, RefreshCw, ShoppingBag, Wallet } from "lucide-react";
import { InventoryPanel } from "@/components/dashboard/inventory-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Surface } from "@/components/ui/surface";
import { useShopFormat, useShopPermissions } from "@/components/app/shop-context";
import { apiRequest } from "@/lib/client-api";

type DashboardPayload = {
  currencyCode: string;
  today: { sales: string; purchases: string; profitEstimate: string; activeProducts: number; lowStockCount: number };
  salesChart: { date: string; total: string }[];
  lowStock: { id: string; name: string; sku: string; stockOnHand: string; lowStockThreshold: string; unit: string }[];
  recentSales: { id: string; invoiceNumber: string; total: string; soldAt: string; status: string; customer: { name: string } | null }[];
};

// Same permission rules as the sidebar, so "Jump to" never offers a page the staff member cannot open.
const quickLinks = [
  { href: "/sales", label: "Sales", icon: Receipt, requires: ["CREATE_SALES"] },
  { href: "/purchases", label: "Purchases", icon: ShoppingBag, requires: ["CREATE_PURCHASES"] },
  { href: "/products", label: "Products", icon: Boxes, requires: ["MANAGE_PRODUCTS", "CREATE_SALES", "CREATE_PURCHASES"] },
  { href: "/reports", label: "Reports", icon: BarChart3, requires: ["VIEW_REPORTS"] },
];

export function Dashboard() {
  const { locale, formatMoney, formatNumber, formatDate } = useShopFormat();
  const permissions = useShopPermissions();
  const links = quickLinks.filter((link) => link.requires.some((permission) => permissions.includes(permission)));
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiRequest<DashboardPayload>("/api/dashboard");
      setData(payload);
      setUpdatedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Only sales has day-to-day history in the payload, so the other cards keep a plain context line.
  const yesterday = Number(data?.salesChart.at(-2)?.total ?? 0);
  const todaySales = Number(data?.salesChart.at(-1)?.total ?? 0);
  const salesTrend = data && yesterday > 0
    ? {
        label: `${formatNumber(Math.abs(((todaySales - yesterday) / yesterday) * 100), 0)}% vs yesterday`,
        direction: (todaySales - yesterday) / yesterday > 0.005 ? "up" as const : (todaySales - yesterday) / yesterday < -0.005 ? "down" as const : "flat" as const,
      }
    : undefined;

  const netSales = Number(data?.today.sales ?? 0);
  const profit = Number(data?.today.profitEstimate ?? 0);
  const margin = netSales > 0 ? (profit / netSales) * 100 : null;

  return (
    <>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Overview</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[0.03em] text-foreground sm:text-[30px]">Today at your shop</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{data ? formatDate(new Date()) : "A live view of sales, stock and shop activity."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updatedAt ? <span className="text-xs text-muted-foreground tabular-nums">Updated {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(updatedAt)}</span> : null}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link href="/sales" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"><PackagePlus size={16} /> New sale</Link>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span className="flex items-center gap-2"><CircleAlert size={16} className="shrink-0" />{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">Try again</button>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="mt-7 grid gap-5 xl:grid-cols-3" aria-label="Loading dashboard" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
          <div className="h-[340px] animate-pulse rounded-2xl border border-border bg-card xl:col-span-2" />
          <div className="h-[340px] animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Today's key figures" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Today's net sales" value={formatMoney(data.today.sales)} description="After recorded customer returns" icon={Wallet} tone="teal" trend={salesTrend} />
            <StatCard title="Today's net purchases" value={formatMoney(data.today.purchases)} description="After recorded supplier returns" icon={ShoppingBag} tone="blue" />
            <StatCard title="Active products" value={formatNumber(data.today.activeProducts, 0)} description={`${formatNumber(data.today.lowStockCount, 0)} at or below reorder level`} icon={Boxes} tone="amber" />
            <StatCard title="Estimated profit" value={formatMoney(data.today.profitEstimate)} description="Net sales − cost of goods − expenses" icon={Activity} tone="violet" />
          </section>

          <section className="mt-5 grid items-stretch gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2"><SalesChart data={data.salesChart} /></div>
            <div className="min-w-0"><InventoryPanel inventory={data.lowStock} /></div>
          </section>

          <section className="mt-5 grid items-stretch gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2"><RecentActivity sales={data.recentSales} /></div>
            <div className="flex min-w-0 flex-col gap-5">
              <Surface className="flex h-full flex-col p-5 sm:p-6">
                <p className="text-base font-semibold text-foreground">Profit snapshot</p>
                <p className="mt-1 text-sm text-muted-foreground">How today’s sales converted</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-[clamp(1.375rem,2.4vw,1.75rem)] font-semibold leading-none tracking-tight tabular-nums text-foreground">{formatMoney(data.today.profitEstimate)}</p>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums ${margin !== null && margin >= 0 ? "bg-violet-soft text-violet-strong" : "bg-danger/10 text-danger"}`}>{margin === null ? "No sales yet" : `${formatNumber(margin, 1)}% margin`}</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-violet-strong" style={{ width: `${margin === null ? 0 : Math.min(100, Math.max(0, margin))}%` }} /></div>
                <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Net sales</dt><dd className="font-semibold tabular-nums text-foreground">{formatMoney(data.today.sales)}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Cost of goods + expenses</dt><dd className="font-semibold tabular-nums text-foreground">{formatMoney(netSales - profit)}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Net purchases</dt><dd className="font-semibold tabular-nums text-foreground">{formatMoney(data.today.purchases)}</dd></div>
                </dl>
              </Surface>

              <Surface className="p-5 sm:p-6">
                <p className="text-base font-semibold text-foreground">Jump to</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  {links.map((link) => (
                    <Link key={link.href} href={link.href} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-muted">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-teal-strong"><link.icon size={15} /></span>
                      <span className="flex-1 truncate">{link.label}</span>
                      <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </Surface>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
