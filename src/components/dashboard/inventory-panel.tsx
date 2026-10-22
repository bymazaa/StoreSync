import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Surface } from "@/components/ui/surface";

type LowStockProduct = { id: string; name: string; sku: string; stockOnHand: string; lowStockThreshold: string; unit: string };

export function InventoryPanel({ inventory }: { inventory: LowStockProduct[] }) {
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-foreground">Low stock</p><p className="mt-1 text-sm text-muted-foreground">Products that need a restock</p></div><Link href="/inventory" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft">View inventory <ArrowRight size={14} /></Link></div>
      <div className="mt-5 space-y-4">
        {inventory.length === 0 && <p className="rounded-xl bg-primary-soft px-3.5 py-4 text-sm text-teal-strong">All active products are above their reorder levels.</p>}
        {inventory.map((item) => {
          const stock = Number(item.stockOnHand);
          const threshold = Number(item.lowStockThreshold);
          const level = threshold > 0 ? Math.min(100, Math.max(4, stock / threshold * 100)) : 0;
          return (
          <div key={item.name} className="flex items-center gap-3 rounded-xl px-1 py-1">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-soft text-amber-strong"><AlertTriangle size={17} /></span>
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p><p className="whitespace-nowrap text-xs font-semibold text-foreground">{item.stockOnHand} {item.unit}</p></div><div className="mt-1.5 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">SKU {item.sku} · Reorder at {item.lowStockThreshold} {item.unit}</p><span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-strong" style={{ width: `${level}%` }} /></span></div></div>
          </div>
          );
        })}
      </div>
    </Surface>
  );
}
