import { AlertTriangle, ArrowRight, Boxes } from "lucide-react";
import Link from "next/link";
import { Surface } from "@/components/ui/surface";

type LowStockProduct = { id: string; name: string; sku: string; stockOnHand: string; lowStockThreshold: string; unit: string };

export function InventoryPanel({ inventory, activeProducts }: { inventory: LowStockProduct[]; activeProducts: string }) {
  return (
    <Surface className="flex h-full flex-col p-5 sm:p-6">
      <div className="rounded-[18px] border border-primary/15 bg-gradient-to-br from-primary-soft/70 to-card p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-[14px] bg-card text-primary shadow-sm ring-1 ring-primary/10"><Boxes size={19} strokeWidth={2} /></span>
          <Link href="/products" className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-primary/15 bg-card/80 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-card">
            Catalog <ArrowRight size={13} />
          </Link>
        </div>
        <p className="mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">{activeProducts}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Active products</p>
          <p className="text-[11px] text-muted-foreground">Available in your catalog</p>
        </div>
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div><p className="text-base font-semibold text-foreground">Needs restock</p><p className="mt-1 text-sm text-muted-foreground">At or below reorder level</p></div>
        <span className="shrink-0 rounded-lg bg-amber-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-strong">{inventory.length} items</span>
      </div>

      <div className="-mr-1 mt-3 max-h-[205px] flex-1 space-y-1 overflow-y-auto pr-1">
        {inventory.length === 0 ? (
          <p className="rounded-xl bg-teal-soft px-3.5 py-4 text-sm text-teal-strong">All active products are above their reorder levels.</p>
        ) : null}
        {inventory.map((item) => {
          const stock = Number(item.stockOnHand);
          const threshold = Number(item.lowStockThreshold);
          const level = threshold > 0 ? Math.min(100, Math.max(4, (stock / threshold) * 100)) : 0;
          return (
            <div key={item.sku} className="rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-soft text-amber-strong"><AlertTriangle size={15} /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">SKU {item.sku}</p></div>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{item.stockOnHand}<span className="ml-1 text-xs font-medium text-muted-foreground">{item.unit}</span></p>
              </div>
              <div className="mt-2 flex items-center gap-2.5 pl-[42px]">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-strong" style={{ width: `${level}%` }} /></span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">Reorder {item.lowStockThreshold} {item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/inventory" className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-foreground transition-colors hover:bg-muted">Open inventory <ArrowRight size={14} /></Link>
    </Surface>
  );
}
