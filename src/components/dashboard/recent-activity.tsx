import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { useShopFormat } from "@/components/app/shop-context";

type RecentSale = { id: string; invoiceNumber: string; total: string; paidAmount: string; dueAmount: string; soldAt: string; status: string; customer: { name: string } | null };

const statusStyles: Record<string, string> = {
  COMPLETED: "bg-teal-soft text-teal-strong",
  PARTIALLY_RETURNED: "bg-amber-soft text-amber-strong",
  RETURNED: "bg-violet-soft text-violet-strong",
  CANCELLED: "bg-danger/10 text-danger",
  DRAFT: "bg-muted text-muted-foreground",
};

export function RecentActivity({ sales }: { sales: RecentSale[] }) {
  const { formatMoney, formatDateTime } = useShopFormat();
  const recentTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  return (
    <Surface className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">Recent sales</p>
          <p className="mt-1 text-sm text-muted-foreground">Latest invoices and payment collection</p>
        </div>
        <Link href="/sales" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-primary outline-none transition-[background-color,border-color,box-shadow] hover:border-primary/25 hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-card">View all<ArrowRight size={13} /></Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5">
        <div className="rounded-[14px] border border-border/70 bg-background px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice total <span className="normal-case tracking-normal">({sales.length})</span></p>
          <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatMoney(recentTotal)}</p>
        </div>
      </div>

      {sales.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">No sales have been recorded yet.</p>
      ) : (
        <>
          <div className="mt-4 hidden gap-4 rounded-xl bg-muted/55 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <span>Invoice</span><span>Customer</span><span className="text-right">Total & status</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {sales.map((sale) => {
              const due = Number(sale.dueAmount);
              return (
                <Link key={sale.id} href={`/sales/${sale.id}`} className="grid gap-x-4 gap-y-2 rounded-[14px] border border-transparent px-3 py-3 outline-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-border hover:bg-muted/40 focus-visible:border-border focus-visible:bg-muted/45 focus-visible:ring-2 focus-visible:ring-primary/20 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Receipt size={16} strokeWidth={1.9} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tabular-nums text-foreground">{sale.invoiceNumber}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{formatDateTime(sale.soldAt)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 pl-11 sm:pl-0">
                    <p className="truncate text-sm font-medium text-foreground">{sale.customer?.name ?? "Walk-in customer"}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Paid {formatMoney(sale.paidAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div>
                      <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{formatMoney(sale.total)}</p>
                      <p className={`mt-0.5 text-[11px] font-medium tabular-nums ${due > 0 ? "text-amber-strong" : "text-muted-foreground"}`}>{due > 0 ? `${formatMoney(due)} due` : "Paid in full"}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold capitalize ${statusStyles[sale.status] ?? "bg-muted text-muted-foreground"}`}>
                      {sale.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Surface>
  );
}
