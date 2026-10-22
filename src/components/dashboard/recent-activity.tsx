import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";

type RecentSale = { id: string; invoiceNumber: string; total: string; soldAt: string; status: string; customer: { name: string } | null };

export function RecentActivity({ sales }: { sales: RecentSale[] }) {
  const { formatMoney, formatDateTime } = useShopFormat();
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-foreground">Recent sales</p><p className="mt-1 text-sm text-muted-foreground">The latest completed invoices</p></div><Link href="/sales" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft">View all</Link></div>
      <div className="mt-4 divide-y divide-border">
        {sales.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No sales have been recorded yet.</p>}
        {sales.map((sale) => {
          const time = formatDateTime(sale.soldAt);
          return <div key={sale.id} className="flex items-center gap-3 py-3.5 first:pt-1 last:pb-0"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal-strong"><ArrowUpRight size={16} /></span><div className="min-w-0 flex-1"><Link href={`/sales/${sale.id}`} className="truncate text-sm font-semibold text-foreground hover:text-primary">{sale.invoiceNumber}</Link><p className="mt-0.5 truncate text-xs text-muted-foreground">{sale.customer?.name ?? "Walk-in customer"} · {time}</p></div><div className="text-right"><p className="whitespace-nowrap text-sm font-semibold text-foreground">{formatMoney(sale.total)}</p><p className="mt-0.5 text-xs text-muted-foreground">{sale.status.toLowerCase().replaceAll("_", " ")}</p></div></div>;
        })}
      </div>
    </Surface>
  );
}
