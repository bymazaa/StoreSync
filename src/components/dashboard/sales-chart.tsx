"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";

type ChartPoint = { date: string; total: string };

function HeaderStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-[72px]">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SalesChart({ data }: { data: ChartPoint[] }) {
  const { locale, currency } = useShopFormat();
  const dayLabels = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const compact = new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });

  const chartData = data.map((point, index) => ({
    // The API always sends the trailing 7 days, so the final bucket is today.
    day: index === data.length - 1 ? "Today" : dayLabels.format(new Date(`${point.date}T12:00:00Z`)),
    sales: Number(point.total),
  }));
  const weekTotal = chartData.reduce((sum, point) => sum + point.sales, 0);
  const average = chartData.length > 0 ? weekTotal / chartData.length : 0;
  const best = chartData.reduce((top, point) => (point.sales > top.sales ? point : top), chartData[0] ?? { day: "—", sales: 0 });

  return (
    <Surface className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div><p className="text-base font-semibold text-foreground">Sales overview</p><p className="mt-1 text-sm text-muted-foreground">Net sales for the last 7 days</p></div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <HeaderStat label="Week total" value={compact.format(weekTotal)} />
          <HeaderStat label="Daily avg" value={compact.format(average)} />
          <HeaderStat label="Best day" value={compact.format(best.sales)} hint={best.day} />
        </div>
      </div>
      <div className="mt-6 h-[250px] min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.24} /><stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} tickFormatter={(value: number) => Math.abs(value) >= 1000 ? `${money.format(value / 1000)}k` : money.format(value)} />
            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 12 }} formatter={(value) => [money.format(Number(value ?? 0))]} labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }} />
            <Area type="monotone" dataKey="sales" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#salesFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}
