"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, Boxes, CircleAlert, PackagePlus, ShoppingBag, Wallet } from "lucide-react";
import { InventoryPanel } from "@/components/dashboard/inventory-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { useShopFormat } from "@/components/app/shop-context";
import { apiRequest } from "@/lib/client-api";

type DashboardPayload = {
  currencyCode: string;
  today: { sales: string; purchases: string; profitEstimate: string; activeProducts: number; lowStockCount: number };
  salesChart: { date: string; total: string }[];
  lowStock: { id: string; name: string; sku: string; stockOnHand: string; lowStockThreshold: string; unit: string }[];
  recentSales: { id: string; invoiceNumber: string; total: string; soldAt: string; status: string; customer: { name: string } | null }[];
};

export function Dashboard() {
  const { formatMoney, formatNumber } = useShopFormat();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiRequest<DashboardPayload>("/api/dashboard");
      setData(payload);
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

  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="text-primary">Overview</span><span className="text-border">/</span><span>Dashboard</span></div><h1 className="mt-3 text-[26px] font-semibold tracking-tight text-foreground sm:text-[30px]">Today at your shop</h1><p className="mt-1.5 text-sm text-muted-foreground">A live view of sales, stock and shop activity.</p></div>
        <Link href="/sales" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"><PackagePlus size={16} /> New sale</Link>
      </div>

      {error && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Try again</button></div>}

      {!data && loading ? <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />)}</div> : null}
      {data ? <>
        <section aria-label="Today's key figures" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Today's net sales" value={formatMoney(data.today.sales)} description="After recorded customer returns" icon={Wallet} tone="teal" />
          <StatCard title="Today's net purchases" value={formatMoney(data.today.purchases)} description="After recorded supplier returns" icon={ShoppingBag} tone="blue" />
          <StatCard title="Active products" value={formatNumber(data.today.activeProducts, 0)} description={`${formatNumber(data.today.lowStockCount, 0)} at or below reorder level`} icon={Boxes} tone="amber" />
          <StatCard title="Estimated profit" value={formatMoney(data.today.profitEstimate)} description="Net sales − cost of goods − expenses" icon={Activity} tone="violet" />
        </section>
        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]"><SalesChart data={data.salesChart} /><InventoryPanel inventory={data.lowStock} /></section>
        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
          <RecentActivity sales={data.recentSales} />
          <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-white shadow-card sm:p-6"><div className="absolute -right-10 -top-14 size-44 rounded-full border border-white/10" /><div className="absolute -right-1 -top-6 size-28 rounded-full border border-white/10" /><div className="relative"><p className="flex items-center gap-2 text-sm font-semibold"><CircleAlert size={16} /> StockPilot keeps a clear audit trail.</p><p className="mt-2 max-w-sm text-xs leading-5 text-white/75">Review sales, purchase, stock movement and payment history from the reports workspace.</p><Link href="/reports" className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-primary transition-colors hover:bg-white/90">Explore reports <ArrowRight size={14} /></Link></div></div>
        </section>
      </> : null}
    </>
  );
}
