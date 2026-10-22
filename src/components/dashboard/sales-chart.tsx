"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";

type ChartPoint = { date: string; total: string };

export function SalesChart({ data }: { data: ChartPoint[] }) {
  const { locale, currency } = useShopFormat();
  const chartData = data.map((point) => ({
    day: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${point.date}T12:00:00Z`)),
    sales: Number(point.total),
  }));
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-base font-semibold text-foreground">Sales overview</p><p className="mt-1 text-sm text-muted-foreground">Your shop activity this week</p></div>
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><i className="size-2 rounded-full bg-primary" /> Net sales</span>
      </div>
      <div className="mt-6 h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} tickFormatter={(value: number) => Math.abs(value) >= 1000 ? `${money.format(value / 1000)}k` : money.format(value)} />
            <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 12 }} formatter={(value) => [money.format(Number(value ?? 0))]} labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }} />
            <Area type="monotone" dataKey="sales" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#salesFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Surface>
  );
}
