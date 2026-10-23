import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";

type RecentSale = { id: string; invoiceNumber: string; total: string; soldAt: string; status: string; customer: { name: string } | null };

const statusStyles: Record<string, string> = {
  COMPLETED: "bg-teal-soft text-teal-strong",
  PARTIALLY_RETURNED: "bg-amber-soft text-amber-strong",
  RETURNED: "bg-violet-soft text-violet-strong",
  CANCELLED: "bg-danger/10 text-danger",
  DRAFT: "bg-muted text-muted-foreground",
};

export function RecentActivity({ sales }: { sales: RecentSale[] }) {
  const { formatMoney, formatDateTime } = useShopFormat();
  return (
    <Surface className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-base font-semibold text-foreground">Recent sales</p><p className="mt-1 text-sm text-muted-foreground">The latest completed invoices</p></div>
        <Link href="/sales" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft">View all</Link>
      </div>

      {sales.length === 0 ? (
        <p className="mt-4 py-10 text-center text-sm text-muted-foreground">No sales have been recorded yet.</p>
      ) : (
        <>
          <div className="mt-4 hidden gap-4 border-b border-border px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <span>Invoice</span><span>Customer</span><span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-border">
            {sales.map((sale) => (
              <Link key={sale.id} href={`/sales/${sale.id}`} className="grid gap-x-4 gap-y-1 px-2 py-3 transition-colors hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tabular-nums text-foreground">{sale.invoiceNumber}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{formatDateTime(sale.soldAt)}</p>
                </div>
                <p className="truncate text-sm text-muted-foreground">{sale.customer?.name ?? "Walk-in customer"}</p>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(sale.total)}</p>
                  <span className={`mt-1 inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${statusStyles[sale.status] ?? "bg-muted text-muted-foreground"}`}>
                    {sale.status.toLowerCase().replaceAll("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Surface>
  );
}
