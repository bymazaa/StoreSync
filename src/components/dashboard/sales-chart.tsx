"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, ChartNoAxesCombined } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";
import { formatCurrencyMoney } from "@/lib/currency";

type ChartPoint = { date: string; total: string };

export function SalesChart({ data }: { data: ChartPoint[] }) {
  const { locale, currency } = useShopFormat();
  const dayLabels = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const compact = (value: number) => formatCurrencyMoney(locale, currency, value, { notation: "compact", maximumFractionDigits: 1 });
  const money = (value: number) => formatCurrencyMoney(locale, currency, value, { maximumFractionDigits: 0 });

  const chartData = data.map((point, index) => ({
    // The API always sends the trailing 7 days, so the final bucket is today.
    day: index === data.length - 1 ? "Today" : dayLabels.format(new Date(`${point.date}T12:00:00Z`)),
    sales: Number(point.total),
  }));
  const weekTotal = chartData.reduce((sum, point) => sum + point.sales, 0);
  const average = chartData.length > 0 ? weekTotal / chartData.length : 0;
  const best = chartData.reduce((top, point) => (point.sales > top.sales ? point : top), chartData[0] ?? { day: "—", sales: 0 });

  return (
    <Surface className="flex h-full flex-col overflow-hidden p-0">
      <div className="border-b border-border/70 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-primary"><ChartNoAxesCombined size={18} /></span>
            <div className="min-w-0"><p className="text-base font-semibold text-foreground">Sales overview</p><p className="mt-0.5 text-xs text-muted-foreground">Track your shop’s daily sales</p></div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"><CalendarDays size={13} /> Last 7 days</span>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Net sales this week</p>
            <p className="mt-1 break-words text-[clamp(1.8rem,3vw,2.35rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums text-foreground [overflow-wrap:anywhere]">{money(weekTotal)}</p>
          </div>
          <div className="flex items-center gap-5 sm:gap-7">
            <div className="border-l border-border pl-4 sm:pl-5"><p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Daily avg</p><p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{compact(average)}</p></div>
            <div className="border-l border-border pl-4 sm:pl-5"><p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Best day</p><p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{compact(best.sales)}</p><p className="text-[10px] text-muted-foreground">{best.day}</p></div>
          </div>
        </div>
      </div>
      <div className="h-[225px] min-w-0 flex-1 px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.24} /><stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} tickFormatter={(value: number) => Math.abs(value) >= 1000 ? `${money(value / 1000)}k` : money(value)} />
            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 12 }} formatter={(value) => [money(Number(value ?? 0))]} labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }} />
            <Area type="monotone" dataKey="sales" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}
