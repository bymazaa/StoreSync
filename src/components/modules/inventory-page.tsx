"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
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
      clientRequestId = crypto.randomUUID();
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
    <Panel title="Current stock" description={`Values use ${currency} for valuation when shown in reports.`} action={<input aria-label="Search inventory" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} max-w-xs`} placeholder="Search product or SKU" />}>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-3">Product</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">On hand</th><th className="px-3 py-3">Reorder at</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{visible.map((item) => { const low = Number(item.stockOnHand) <= Number(item.lowStockThreshold); return <tr key={item.id}><td className="px-3 py-3 font-medium">{item.name}</td><td className="px-3 py-3 text-muted-foreground">{item.sku}</td><td className="px-3 py-3">{formatNumber(item.stockOnHand, 6)} {item.baseUnit.symbol}</td><td className="px-3 py-3">{formatNumber(item.lowStockThreshold, 6)} {item.baseUnit.symbol}</td><td className="px-3 py-3"><span className={low ? "rounded-full bg-danger/10 px-2 py-1 text-xs text-danger" : "rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"}>{low ? "Low stock" : "In stock"}</span></td></tr>; })}{visible.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No stock records match.</td></tr>}</tbody></table></div>
    </Panel>
    {canAdjust && <Panel title="Adjust stock" description={direction === "OUT" ? "Record missing, damaged or expired stock. Stock is removed from available batches using the shop costing order." : "Record found stock or a verified count correction. Add a clear reason so the change is traceable."}><form onSubmit={adjust} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><select required value={productId} onChange={(e) => setProductId(e.target.value)} className={selectClass}><option value="">Choose product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}){isUnpriced(p) ? " · no selling price" : ""}</option>)}</select><select value={direction} onChange={(e) => setDirection(e.target.value)} className={selectClass}><option value="IN">Stock in</option><option value="OUT">Stock out</option></select><input name="quantity" required type="number" min={wholeQuantity ? "1" : "0.01"} step={wholeQuantity ? "1" : "0.01"} className={inputClass} placeholder={selectedProduct ? `Quantity (${selectedProduct.baseUnit.symbol})` : "Quantity"} /><input name="note" required maxLength={500} className={inputClass} placeholder="Reason" />{direction === "IN" && <input name="batchNumber" required={selectedProduct?.tracksBatch} className={inputClass} placeholder={selectedProduct?.tracksBatch ? "Batch number (required)" : "Batch (optional)"} />}{direction === "IN" && <input name="expiresAt" required={selectedProduct?.tracksExpiry} type="date" className={inputClass} />}<div className="sm:col-span-2 lg:col-span-6"><Button type="submit" disabled={!productId || busy || needsPurchaseFirst}>{busy ? "Saving…" : "Save adjustment"}</Button></div>{needsPurchaseFirst && <p role="alert" className="sm:col-span-2 lg:col-span-6 rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">This product has no selling price yet, so adding stock here would let it be sold for {currency} 0. Receive it first with Purchases → New purchase, where quantity, cost and selling price are recorded together. Stock out stays available for count corrections.</p>}</form></Panel>}
    <Panel title="Movement history" description="Latest stock events with the responsible staff member."><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-3">When</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Movement</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Balance</th><th className="px-3 py-3">By / reason</th></tr></thead><tbody className="divide-y divide-border">{movements.map((m) => <tr key={m.id}><td className="px-3 py-3">{formatDateTime(m.createdAt)}</td><td className="px-3 py-3">{m.product.name}<span className="block text-xs text-muted-foreground">{m.product.sku}</span></td><td className="px-3 py-3">{movementLabels[m.reason] ?? m.reason}</td><td className="px-3 py-3">{m.direction === "IN" ? "+" : "−"}{formatNumber(m.quantity, 6)} {m.product.baseUnit.symbol}</td><td className="px-3 py-3">{formatNumber(m.balanceAfter, 6)}</td><td className="px-3 py-3">{m.actor?.fullName ?? "—"}<span className="block text-xs text-muted-foreground">{m.note ?? "—"}</span></td></tr>)}{movements.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No stock movements yet.</td></tr>}</tbody></table></div></Panel>
  </div>;
}
