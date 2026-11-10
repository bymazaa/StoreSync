"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { createClientRequestId } from "@/lib/client-request-id";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { useHasPermission, useShopFormat } from "@/components/app/shop-context";
import { usesWholeQuantity } from "@/lib/quantity";

type Product = { id: string; name: string; sku: string; stockOnHand: string; lowStockThreshold: string; sellingPrice: string; tracksBatch: boolean; tracksExpiry: boolean; baseUnit: { name: string; symbol: string } };
type Movement = { id: string; direction: string; reason: string; quantity: string; balanceAfter: string; note: string | null; createdAt: string; product: { name: string; sku: string; baseUnit: { symbol: string } }; actor: { fullName: string } | null };

const movementLabels: Record<string, string> = {
  OPENING: "Opening stock",
  PURCHASE: "Purchase received",
  SALE: "Sale",
  CUSTOMER_RETURN: "Customer return",
  SUPPLIER_RETURN: "Supplier return",
  ADJUSTMENT: "Adjustment",
  VOIDED_SALE: "Sale cancelled",
  VOIDED_PURCHASE: "Purchase cancelled",
};

const movementTones: Record<string, string> = {
  OPENING: "bg-teal-soft text-teal-strong",
  PURCHASE: "bg-teal-soft text-teal-strong",
  SALE: "bg-teal-soft text-teal-strong",
  CUSTOMER_RETURN: "bg-amber-soft text-amber-strong",
  SUPPLIER_RETURN: "bg-amber-soft text-amber-strong",
  ADJUSTMENT: "bg-amber-soft text-amber-strong",
  VOIDED_SALE: "bg-danger/10 text-danger",
  VOIDED_PURCHASE: "bg-danger/10 text-danger",
};

export function InventoryPage() {
  const { currency, formatNumber, formatDateTime } = useShopFormat();
  const canAdjust = useHasPermission("ADJUST_STOCK");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState("IN");
  const [notice, setNotice] = useState("");
  const pendingAdjustmentRequests = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    try {
      const [stock, history] = await Promise.all([
        apiRequest<{ products: Product[] }>("/api/products"),
        apiRequest<{ movements: Movement[] }>("/api/stock-movements"),
      ]);
      setProducts(stock.products); setMovements(history.movements); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Inventory could not be loaded."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const visible = products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(filter.toLowerCase()));
  const selectedProduct = products.find((product) => product.id === productId);
  const wholeQuantity = usesWholeQuantity(selectedProduct?.baseUnit.name ?? "", selectedProduct?.baseUnit.symbol ?? "");
  const isUnpriced = (product: Product) => !(Number(product.sellingPrice) > 0);
  const needsPurchaseFirst = direction === "IN" && Boolean(selectedProduct) && isUnpriced(selectedProduct!);
  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = { productId, direction, quantity: data.get("quantity"), note: data.get("note"), batchNumber: data.get("batchNumber") || null, expiresAt: data.get("expiresAt") ? new Date(`${data.get("expiresAt")}T00:00:00Z`).toISOString() : null };
    const fingerprint = JSON.stringify(payload);
    let clientRequestId = pendingAdjustmentRequests.current.get(fingerprint);
    if (!clientRequestId) {
      clientRequestId = createClientRequestId();
      pendingAdjustmentRequests.current.set(fingerprint, clientRequestId);
    }
    try {
      await apiRequest("/api/inventory/adjustments", { method: "POST", body: jsonBody({ ...payload, clientRequestId }) });
      pendingAdjustmentRequests.current.delete(fingerprint);
      formElement.reset(); setNotice("Stock adjustment saved."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Stock adjustment failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageHeader eyebrow="Stock control" title="Inventory" description="Current quantities, reorder levels and a traceable movement history." />
    {error && <ErrorMessage>{error}</ErrorMessage>}{notice && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
    <Panel title="Current stock" description={`${visible.length.toLocaleString()} products · values use ${currency} for valuation when shown in reports.`} action={<div className="relative w-full sm:w-64"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search inventory" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search product or SKU" /></div>}>
      {visible.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">No stock records match.</div>
      ) : (
        <>
          <div className="space-y-2 lg:hidden">
            {visible.map((item) => {
              const low = Number(item.stockOnHand) <= Number(item.lowStockThreshold);
              return (
                <article key={item.id} className="rounded-[16px] border border-border/70 bg-background p-4 transition-colors hover:border-primary/20 hover:bg-primary-soft/10">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{item.baseUnit.name} · <span className="font-mono text-[11px] font-semibold tracking-wide text-teal-strong">{item.sku}</span></p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${low ? "bg-amber-soft text-amber-strong" : "bg-success/10 text-success"}`}><span className="size-1.5 rounded-full bg-current" />{low ? "Low stock" : "In stock"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
                    <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">On hand</p><p className={`mt-1 break-words text-sm font-semibold tabular-nums [overflow-wrap:anywhere] ${low ? "text-amber-strong" : "text-foreground"}`}>{formatNumber(item.stockOnHand, 6)} {item.baseUnit.symbol}</p></div>
                    <div className="min-w-0 text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Reorder at</p><p className="mt-1 break-words text-sm font-medium tabular-nums text-foreground [overflow-wrap:anywhere]">{formatNumber(item.lowStockThreshold, 6)} {item.baseUnit.symbol}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-hidden rounded-[16px] border border-border/70 lg:block">
            <div className="overflow-x-auto">
              <table className="stock-table w-full min-w-[720px] text-left text-sm">
                <thead className="bg-muted/45 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">SKU</th><th className="px-4 py-3 text-right font-semibold">On hand</th><th className="px-4 py-3 text-right font-semibold">Reorder at</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead>
                <tbody className="divide-y divide-border/70">{visible.map((item) => { const low = Number(item.stockOnHand) <= Number(item.lowStockThreshold); return <tr key={item.id} className="align-middle transition-colors hover:bg-primary-soft/20"><td className="px-4 py-3.5 font-semibold text-foreground">{item.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.baseUnit.name}</span></td><td className="px-4 py-3.5"><span className="rounded-lg bg-teal-soft px-2 py-1 text-[11px] font-semibold tabular-nums tracking-[0.06em] text-teal-strong">{item.sku}</span></td><td className="px-4 py-3.5 text-right"><p className={`break-words font-semibold tabular-nums [overflow-wrap:anywhere] ${low ? "text-amber-strong" : "text-foreground"}`}>{formatNumber(item.stockOnHand, 6)} {item.baseUnit.symbol}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{low ? "Below reorder level" : "Alert at"} {formatNumber(item.lowStockThreshold, 6)}</p></td><td className="px-4 py-3.5 text-right font-medium tabular-nums text-muted-foreground">{formatNumber(item.lowStockThreshold, 6)} {item.baseUnit.symbol}</td><td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${low ? "bg-amber-soft text-amber-strong" : "bg-success/10 text-success"}`}><span className="size-1.5 rounded-full bg-current" />{low ? "Low stock" : "In stock"}</span></td></tr>; })}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Panel>
    {canAdjust && <Panel title="Adjust stock" description={direction === "OUT" ? "Record missing, damaged or expired stock. Stock is removed from available batches using the shop costing order." : "Record found stock or a verified count correction. Add a clear reason so the change is traceable."}><form onSubmit={adjust} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><select required value={productId} onChange={(e) => setProductId(e.target.value)} className={selectClass}><option value="">Choose product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}){isUnpriced(p) ? " · no selling price" : ""}</option>)}</select><select value={direction} onChange={(e) => setDirection(e.target.value)} className={selectClass}><option value="IN">Stock in</option><option value="OUT">Stock out</option></select><input name="quantity" required type="number" min={wholeQuantity ? "1" : "0.01"} step={wholeQuantity ? "1" : "0.01"} className={inputClass} placeholder={selectedProduct ? `Quantity (${selectedProduct.baseUnit.symbol})` : "Quantity"} /><input name="note" required maxLength={500} className={inputClass} placeholder="Reason" />{direction === "IN" && <input name="batchNumber" required={selectedProduct?.tracksBatch} className={inputClass} placeholder={selectedProduct?.tracksBatch ? "Batch number (required)" : "Batch (optional)"} />}{direction === "IN" && <DateField name="expiresAt" required={selectedProduct?.tracksExpiry} placeholder={selectedProduct?.tracksExpiry ? "Expiry date (required)" : "Expiry date (optional)"} />}<div className="sm:col-span-2 xl:col-span-6"><Button type="submit" disabled={!productId || busy || needsPurchaseFirst}>{busy ? "Saving…" : "Save adjustment"}</Button></div>{needsPurchaseFirst && <p role="alert" className="sm:col-span-2 xl:col-span-6 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">This product has no selling price yet, so adding stock here would let it be sold for {currency} 0. Receive it first with Purchases → New purchase, where quantity, cost and selling price are recorded together. Stock out stays available for count corrections.</p>}</form></Panel>}
    <Panel title="Movement history" description={`Latest ${movements.length.toLocaleString()} stock events with the responsible staff member.`}>{movements.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border bg-background px-4 py-12 text-center text-sm text-muted-foreground">No stock movements yet.</div>
      ) : (
        <>
          <div className="space-y-2 lg:hidden">
            {movements.map((m) => (
              <article key={m.id} className="rounded-[16px] border border-border/70 bg-background p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-[11px] font-mono font-semibold tracking-wide text-teal-strong">{m.product.sku}</p><p className="mt-1 truncate text-sm font-semibold text-foreground">{m.product.name}</p></div>
                  <span className={`inline-flex max-w-[54%] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${movementTones[m.reason] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{movementLabels[m.reason] ?? m.reason}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Quantity</p><p className={`mt-1 break-words text-sm font-semibold tabular-nums [overflow-wrap:anywhere] ${m.direction === "IN" ? "text-success" : "text-danger"}`}>{m.direction === "IN" ? "+" : "−"}{formatNumber(m.quantity, 6)} {m.product.baseUnit.symbol}</p></div>
                  <div className="min-w-0 text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Balance after</p><p className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatNumber(m.balanceAfter, 6)} {m.product.baseUnit.symbol}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 pt-3 text-xs">
                  <span className="font-medium text-foreground">{m.actor?.fullName ?? "—"}</span>
                  <span className="text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  {m.note && <p className="w-full break-words text-muted-foreground [overflow-wrap:anywhere]">{m.note}</p>}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-[16px] border border-border/70 lg:block">
            <div className="overflow-x-auto">
              <table className="stock-table w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/45 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">SKU</th><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">Movement</th><th className="px-4 py-3 text-right font-semibold">Qty</th><th className="px-4 py-3 text-right font-semibold">Balance</th><th className="px-4 py-3 font-semibold">By / reason</th></tr></thead>
                <tbody className="divide-y divide-border/70">{movements.map((m) => <tr key={m.id} className="align-middle transition-colors hover:bg-primary-soft/20"><td className="whitespace-nowrap px-4 py-3.5"><span className="inline-block rounded-lg bg-teal-soft px-2 py-1 text-[10px] font-semibold tabular-nums tracking-wide text-teal-strong">{m.product.sku}</span></td><td className="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-muted-foreground">{formatDateTime(m.createdAt)}</td><td className="px-4 py-3.5"><p className="truncate font-semibold text-foreground">{m.product.name}</p></td><td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${movementTones[m.reason] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{movementLabels[m.reason] ?? m.reason}</span></td><td className="px-4 py-3.5 text-right"><p className={`break-words font-semibold tabular-nums [overflow-wrap:anywhere] ${m.direction === "IN" ? "text-success" : "text-danger"}`}>{m.direction === "IN" ? "+" : "−"}{formatNumber(m.quantity, 6)} {m.product.baseUnit.symbol}</p></td><td className="px-4 py-3.5 text-right font-medium tabular-nums text-foreground">{formatNumber(m.balanceAfter, 6)} {m.product.baseUnit.symbol}</td><td className="px-4 py-3.5"><p className="truncate font-medium text-foreground">{m.actor?.fullName ?? "—"}</p><p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground" title={m.note ?? undefined}>{m.note ?? "—"}</p></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </>
      )}</Panel>
  </div>;
}
