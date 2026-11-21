"use client";
import { notifySuccessToast } from "@/lib/client-notifications";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, ArchiveX, Barcode, Boxes, LoaderCircle, Plus, Printer, Search, SquarePen, X } from "lucide-react";
import { PageHeader, Panel, ErrorMessage, Notice, TableEmpty, inputClass, selectClass, textareaClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { BarcodeSvg } from "@/components/ui/barcode";
import { isCode128Encodable } from "@/lib/barcode";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { skuCategoryPrefix } from "@/lib/utils";
import { useHasPermission, useShopFormat } from "@/components/app/shop-context";

type Unit = { id: string; code: string; name: string; symbol: string; isActive?: boolean };
type Category = { id: string; name: string; description?: string | null; parentId?: string | null; isActive?: boolean; _count?: { products: number } };
type ProductUnit = { unitId: string; conversionToBase: string; unit?: Unit };
type Product = {
  id: string; name: string; sku: string; barcode: string | null; brand: string | null; categoryId: string | null;
  baseUnitId: string; baseUnit: Unit; purchasePrice: string; sellingPrice: string; stockOnHand: string;
  lowStockThreshold: string; tracksExpiry: boolean; tracksBatch: boolean; isActive: boolean; category: Category | null; units: ProductUnit[];
};

type ConversionDraft = { unitId: string; conversionToBase: string };

// Counter PCs run a Bengali keyboard layout, so a conversion typed as ৫০ must still save as 50.
const toAsciiDigits = (value: string) => value.replace(/[\u09e6-\u09ef]/g, (char) => String(char.charCodeAt(0) - 0x9e6)).replace(/[^\d.]/g, "");

function ProductEditor({ product, units, categories, onClose, onSaved, onCategoryCreated, onUnitCreated }: {
  product: Product | null; units: Unit[]; categories: Category[]; onClose: () => void; onSaved: () => void; onCategoryCreated: (category: Category) => void; onUnitCreated: (unit: Unit) => void;
}) {
  const [conversions, setConversions] = useState<ConversionDraft[]>(product?.units.map((item) => ({
    unitId: item.unitId, conversionToBase: String(item.conversionToBase),
  })) ?? []);
  const [baseUnitId, setBaseUnitId] = useState(product?.baseUnitId ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversionNotice, setConversionNotice] = useState("");
  const [createdUnits, setCreatedUnits] = useState<Unit[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitTarget, setUnitTarget] = useState<"base" | "conversion">("base");
  const [unitBusy, setUnitBusy] = useState(false);
  const [unitError, setUnitError] = useState("");
  const availableUnits = useMemo(() => {
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    for (const unit of createdUnits) byId.set(unit.id, unit);
    return [...byId.values()];
  }, [units, createdUnits]);
  const activeUnits = availableUnits.filter((unit) => unit.isActive !== false && unit.id !== baseUnitId);

  function changeBaseUnit(nextBaseUnitId: string) {
    if (nextBaseUnitId === baseUnitId) return;
    const factor = Number(conversions.find((item) => item.unitId === nextBaseUnitId)?.conversionToBase ?? 0);
    const oldBaseUnitId = baseUnitId;
    if (factor > 0) {
      const rebased = conversions
        .filter((item) => item.unitId !== nextBaseUnitId)
        .map((item) => ({ ...item, conversionToBase: String(Number((Number(item.conversionToBase) / factor).toFixed(6))) }));
      if (oldBaseUnitId && !rebased.some((item) => item.unitId === oldBaseUnitId)) {
        rebased.push({ unitId: oldBaseUnitId, conversionToBase: String(Number((1 / factor).toFixed(6))) });
      }
      setConversions(rebased);
      setConversionNotice("Package conversions were recalculated for the new stock unit.");
    } else if (oldBaseUnitId) {
      const reset = conversions.filter((item) => item.unitId !== nextBaseUnitId).map((item) => ({ ...item, conversionToBase: "" }));
      if (!reset.some((item) => item.unitId === oldBaseUnitId)) reset.push({ unitId: oldBaseUnitId, conversionToBase: "" });
      setConversions(reset);
      setConversionNotice("Set each package conversion again because the new stock unit has no existing conversion.");
    }
    setBaseUnitId(nextBaseUnitId);
  }
  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCategoryBusy(true); setCategoryError("");
    try {
      const result = await apiRequest<{ category: Category & { _id?: string } }>("/api/categories", { method: "POST", body: jsonBody({ name: form.get("name"), description: form.get("description") || null }) });
      const id = result.category.id || result.category._id;
      if (!id) throw new Error("Category was created, but its ID was missing. Reopen the product form and try again.");
      const category = { ...result.category, id };
      onCategoryCreated(category);
      setCategoryId(id);
      setCategoryOpen(false);
    } catch (caught) { setCategoryError(caught instanceof Error ? caught.message : "Category could not be created."); }
    finally { setCategoryBusy(false); }
  }
  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const code = String(form.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
    setUnitBusy(true); setUnitError("");
    try {
      const result = await apiRequest<{ unit: Unit & { _id?: string } }>("/api/units", { method: "POST", body: jsonBody({ code, name, symbol: form.get("symbol") }) });
      const unit = { ...result.unit, id: result.unit.id || result.unit._id || "" };
      if (!unit.id) throw new Error("The unit was created, but its identifier was missing. Reopen the product form to refresh units.");
      setCreatedUnits((current) => [...current.filter((item) => item.id !== unit.id), unit]);
      onUnitCreated(unit);
      if (unitTarget === "base") {
        // Keep the current base unit when one is already selected so this new
        // unit is immediately available as a package conversion as well.
        if (!baseUnitId) setBaseUnitId(unit.id);
      } else {
        setConversions((current) => [...current, { unitId: unit.id, conversionToBase: "1" }]);
      }
      setUnitOpen(false);
    } catch (caught) { setUnitError(caught instanceof Error ? caught.message : "Unit could not be created."); }
    finally { setUnitBusy(false); }
  }  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    const baseUnitId = String(values.get("baseUnitId") ?? "");
    // A half-filled conversion row used to be dropped silently, so the product saved with no packages
    // and the counter only ever showed the stock unit.
    const filled = conversions.filter((item) => item.unitId || item.conversionToBase);
    if (conversions.some((item) => item.unitId && !item.conversionToBase) || filled.some((item) => !item.unitId || !item.conversionToBase)) {
      setBusy(false);
      setError("Every package conversion needs a unit and a base-unit amount. Fill the row or remove it.");
      return;
    }
    // Compare against existing product so only genuinely modified fields are transmitted
    const sellingPrice = toAsciiDigits(String(values.get("sellingPrice") ?? ""));
    const costPrice = toAsciiDigits(String(values.get("purchasePrice") ?? ""));
    const name = String(values.get("name") ?? "").trim();
    const barcode = values.get("barcode") ? String(values.get("barcode")).trim() : null;
    const brand = values.get("brand") ? String(values.get("brand")).trim() : null;
    const categoryIdVal = values.get("categoryId") ? String(values.get("categoryId")) : null;
    const lowStockThresholdVal = values.get("lowStockThreshold") ? String(values.get("lowStockThreshold")) : "0";

    const body: Record<string, unknown> = {};

    if (product) {
      if (name !== product.name) body.name = name;
      if (barcode !== (product.barcode || null)) body.barcode = barcode;
      if (brand !== (product.brand || null)) body.brand = brand;
      if (categoryIdVal !== (product.categoryId || null)) body.categoryId = categoryIdVal;
      if (baseUnitId !== product.baseUnitId) body.baseUnitId = baseUnitId;
      if (Number(lowStockThresholdVal) !== Number(product.lowStockThreshold)) body.lowStockThreshold = lowStockThresholdVal;
      if (sellingPrice && Number(sellingPrice) !== Number(product.sellingPrice)) body.sellingPrice = sellingPrice;
      if (costPrice && Number(costPrice) !== Number(product.purchasePrice)) body.purchasePrice = costPrice;

      const existingUnits = product.units || [];
      const unitsChanged =
        filled.length !== existingUnits.length ||
        filled.some((f) => {
          const match = existingUnits.find((u) => u.unitId === f.unitId);
          return !match || String(match.conversionToBase) !== String(f.conversionToBase);
        });
      if (unitsChanged) body.units = filled;

      if (Object.keys(body).length === 0) {
        setBusy(false);
        onClose();
        return;
      }
    } else {
      body.name = name;
      body.barcode = barcode;
      body.brand = brand;
      body.categoryId = categoryIdVal;
      body.baseUnitId = baseUnitId;
      body.lowStockThreshold = lowStockThresholdVal;
      body.units = filled;
    }
    try {
      await apiRequest(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST", body: jsonBody(body),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product could not be saved.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="flex max-h-[84dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[24px] border border-border bg-card shadow-[0_28px_90px_-30px_rgba(15,23,42,0.5)] sm:max-h-[min(88vh,700px)] sm:rounded-[24px]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card px-4 py-4 sm:px-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-primary text-primary-foreground"><Boxes size={18}/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Product catalog</p><h2 id="product-editor-title" className="mt-1 text-lg font-semibold tracking-tight">{product ? "Edit product" : "Add product"}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">Set up the product identity, stock unit and package conversions.</p></div></div><button type="button" onClick={onClose} aria-label="Close form" className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X size={16} /></button></div>
        <form key={product?.id ?? "new-product"} onSubmit={submit} className="product-modal-scrollbar min-h-0 space-y-3.5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          <section className="rounded-[20px] border border-border/70 bg-background/60 p-4 sm:p-5"><div className="mb-4"><p className="text-sm font-semibold">Product information</p><p className="mt-1 text-xs text-muted-foreground">Name, category and stock tracking details.</p></div><div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Product name</span><input name="name" required maxLength={160} defaultValue={product?.name} className={inputClass} placeholder="e.g. Basmati rice" /></label>
            <div className="block"><span className="mb-1.5 block text-xs font-medium">SKU · Auto generated from category</span><p className={`${inputClass} flex items-center bg-muted text-muted-foreground`}>{product?.sku ?? `${skuCategoryPrefix(categories.find((item) => item.id === categoryId)?.name)}-###`}</p></div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Brand <span className="text-muted-foreground">optional</span></span><input name="brand" maxLength={120} defaultValue={product?.brand ?? ""} className={inputClass} placeholder="Brand name" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Barcode size={14} /> Barcode <span className="text-muted-foreground">optional</span></span><input name="barcode" maxLength={120} defaultValue={product?.barcode ?? ""} className={inputClass} placeholder="Scan or type barcode" /></label>
            <div className="block"><div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-medium">Category</span><button type="button" onClick={() => { setCategoryError(""); setCategoryOpen(true); }} className="text-[11px] font-semibold text-primary hover:underline">+ Add category</button></div><select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="block"><div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-medium">Stock unit</span><button type="button" onClick={() => { setUnitError(""); setUnitTarget("base"); setUnitOpen(true); }} className="text-[11px] font-semibold text-primary hover:underline">+ Add unit</button></div><select name="baseUnitId" required value={baseUnitId} onChange={(event) => changeBaseUnit(event.target.value)} className={selectClass}><option value="" disabled>Select a unit</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Low stock alert</span><input name="lowStockThreshold" type="number" min="0" step="0.000001" defaultValue={product?.lowStockThreshold ?? "0"} className={inputClass} /></label>
          </div></section>
          {conversionNotice && <p className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3.5 py-3 text-xs leading-5 text-muted-foreground">{conversionNotice}</p>}
          {product && <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Selling price per {product.baseUnit.symbol}</span><input name="sellingPrice" required inputMode="decimal" defaultValue={String(product.sellingPrice)} className={inputClass} placeholder="0.00" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">Cost per {product.baseUnit.symbol} <span className="text-muted-foreground">correction only</span></span><input name="purchasePrice" inputMode="decimal" defaultValue={String(product.purchasePrice)} className={inputClass} placeholder="0.00" /></label>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">The new selling price applies to the next sale; printed invoices keep the price they were sold at. Cost is the average of your purchases and the next purchase recalculates it, so change it only when the last purchase was entered wrong. Package prices follow this base price.</p>
          </div>}
          <section className="rounded-[20px] border border-border/70 bg-background/60 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Package conversions</p><p className="mt-1 text-xs text-muted-foreground">Define how each package converts to {availableUnits.find((unit) => unit.id === baseUnitId)?.symbol || "the stock unit"}.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => { setUnitError(""); setUnitTarget("conversion"); setUnitOpen(true); }} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5">+ Create unit</button><Button type="button" variant="outline" icon={<Plus size={14} />} onClick={() => setConversions((current) => [...current, { unitId: "", conversionToBase: "1" }])}>Add conversion</Button></div></div>
            {conversions.length > 0 && <div className="mt-4 space-y-3">{conversions.map((conversion, index) => <div key={`${conversion.unitId}-${index}`} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Package unit</span><select value={conversion.unitId} onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitId: event.target.value } : row))} className={selectClass}><option value="">Choose a unit</option>{activeUnits.filter((unit) => !conversions.some((item, itemIndex) => item.unitId === unit.id && itemIndex !== index)).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Equals base units</span><input value={conversion.conversionToBase} type="text" inputMode="decimal" onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, conversionToBase: toAsciiDigits(event.target.value) } : row))} className={inputClass} placeholder="50" /></label><button type="button" aria-label="Remove unit" onClick={() => setConversions((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"><X size={15} /></button></div>)}</div>}
          </section>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {!product && <p className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3.5 py-3 text-xs leading-5 text-muted-foreground">Product prices are set when you receive stock through a purchase.</p>}
          <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5"><Button type="button" variant="outline" className="h-10 px-3 text-[13px]" onClick={onClose}>Cancel</Button><Button type="submit" className="h-10 px-3 text-[13px]" disabled={busy} icon={busy ? <LoaderCircle size={15} className="animate-spin" /> : undefined}>{busy ? "Saving..." : product ? "Save changes" : "Create product"}</Button></div>
        </form>
        {unitOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !unitBusy) setUnitOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="new-unit-title" className="w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Product catalog</p><h3 id="new-unit-title" className="mt-1 text-lg font-semibold">Add unit</h3></div><button type="button" disabled={unitBusy} onClick={() => setUnitOpen(false)} aria-label="Close add unit" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={16}/></button></div><form onSubmit={(event) => void createUnit(event)} className="space-y-3"><label className="block text-xs font-medium">Unit name<input autoFocus required maxLength={80} name="name" className={`${inputClass} mt-1.5`} placeholder="e.g. Kilogram"/></label><label className="block text-xs font-medium">Symbol<input required maxLength={20} name="symbol" className={`${inputClass} mt-1.5`} placeholder="e.g. kg"/></label><label className="block text-xs font-medium">Code<input required maxLength={30} pattern="[A-Za-z0-9_-]+" name="code" className={`${inputClass} mt-1.5 uppercase`} placeholder="e.g. KG"/></label>{unitError && <ErrorMessage>{unitError}</ErrorMessage>}<div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={unitBusy} onClick={() => setUnitOpen(false)}>Cancel</Button><Button type="submit" disabled={unitBusy}>{unitBusy ? "Saving…" : "Save unit"}</Button></div></form></section></div>}        {categoryOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !categoryBusy) setCategoryOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="new-category-title" className="w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Product catalog</p><h3 id="new-category-title" className="mt-1 text-lg font-semibold">Add category</h3></div><button type="button" disabled={categoryBusy} onClick={() => setCategoryOpen(false)} aria-label="Close add category" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={16}/></button></div><form onSubmit={(event) => void createCategory(event)} className="space-y-3"><label className="block text-xs font-medium">Category name<input autoFocus required maxLength={100} name="name" className={`${inputClass} mt-1.5`} placeholder="e.g. Grocery"/></label><label className="block text-xs font-medium">Description <span className="font-normal text-muted-foreground">optional</span><textarea maxLength={500} name="description" className={`${inputClass} mt-1.5 min-h-20 py-2`} placeholder="Short description"/></label>{categoryError && <ErrorMessage>{categoryError}</ErrorMessage>}<div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={categoryBusy} onClick={() => setCategoryOpen(false)}>Cancel</Button><Button type="submit" disabled={categoryBusy}>{categoryBusy ? "Saving…" : "Save category"}</Button></div></form></section></div>}
      </section>
    </div>
  );
}

const LABELS_PER_PAGE = 12;

/** A big figure like ৳১,২৫,০০০.০০ must still fit inside the sticker, so long amounts step the price font down. */
const priceSizeClass = (priceLabel: string) => (priceLabel.length > 13 ? "label-price-xs" : priceLabel.length > 10 ? "label-price-sm" : "");

/** The sticker carries the product's own SKU — the same code the counter search accepts, so print and scan never diverge. */
function StickerSheet({ product, count, priceLabel }: { product: Product; count: number; priceLabel: string }) {
  return (
    <div className="label-grid">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="label-item">
          <p className="label-name">{product.name}</p>
          <div className="label-code">{isCode128Encodable(product.sku) ? <BarcodeSvg value={product.sku} /> : <p className="label-code-text">{product.sku}</p>}</div>
          <div className="label-foot"><span className="label-sku">{product.sku}</span><span className={`label-price ${priceSizeClass(priceLabel)}`}>{priceLabel}</span></div>
        </div>
      ))}
    </div>
  );
}

function ProductDetailsModal({ product, formatMoney, onClose }: { product: Product; formatMoney: (value: string | number) => string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const detail = (label: string, value: React.ReactNode) => <div className="rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><div className="mt-1.5 break-words text-sm font-medium text-foreground">{value}</div></div>;

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="product-details-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-border bg-card shadow-[0_28px_80px_-28px_rgba(15,23,42,0.5)] sm:rounded-[28px]"><div className="product-modal-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"><div className="-mx-5 -mt-5 mb-5 flex items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card px-5 py-4 sm:-mx-7 sm:-mt-6 sm:px-7 sm:py-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Boxes size={18}/></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Product catalog</p><h2 id="product-details-title" className="mt-1 break-words text-xl font-semibold tracking-tight">{product.name}</h2><p className="mt-1 text-xs text-muted-foreground">Product information · Read only</p></div></div><button type="button" onClick={onClose} aria-label="Close product details" className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X size={17}/></button></div><div className="grid gap-3 sm:grid-cols-2">{detail("SKU", product.sku)}{detail("Barcode", product.barcode || "—")}{detail("Brand", product.brand || "—")}{detail("Category", product.category?.name ?? "Uncategorized")}{detail("Base unit", `${product.baseUnit.name} (${product.baseUnit.symbol})`)}{detail("Stock on hand", `${product.stockOnHand} ${product.baseUnit.symbol}`)}{detail("Low stock alert", `${product.lowStockThreshold} ${product.baseUnit.symbol}`)}{detail("Purchase price", formatMoney(product.purchasePrice))}{detail("Selling price", formatMoney(product.sellingPrice))}{detail("Status", product.isActive ? "Active" : "Archived")}{detail("Batch tracking", product.tracksBatch ? "Enabled" : "Disabled")}{detail("Expiry tracking", product.tracksExpiry ? "Enabled" : "Disabled")}</div>{product.units.length > 0 && <div className="mt-4 rounded-xl border border-border/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Package conversions</p><ul className="mt-2 space-y-1.5 text-sm">{product.units.map((item) => <li key={item.unitId}>1 {item.unit?.name ?? "package"} = {item.conversionToBase} {product.baseUnit.symbol}</li>)}</ul></div>}<div className="mt-5 flex justify-end border-t border-border pt-4"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div></div></section></div>;
}
export function ProductsPage({ initialSearch = "" }: { initialSearch?: string }) {
  const { formatMoney } = useShopFormat();
  const canManageProducts = useHasPermission("MANAGE_PRODUCTS");
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeArchivedCategories, setIncludeArchivedCategories] = useState(false);
  const [includeArchivedUnits, setIncludeArchivedUnits] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [categoryModalError, setCategoryModalError] = useState("");
  const [unitModalError, setUnitModalError] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
  const [categoryFormVersion, setCategoryFormVersion] = useState(0);
  const [unitFormVersion, setUnitFormVersion] = useState(0);
  const [labelProductId, setLabelProductId] = useState("");
  const [labelCount, setLabelCount] = useState(10);
  const [labelPrint, setLabelPrint] = useState(false);
  const printedTitle = useRef("");

  useEffect(() => {
    const reset = () => {
      setLabelPrint(false);
      if (printedTitle.current) { document.title = printedTitle.current; printedTitle.current = ""; }
    };
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const load = useCallback(async () => {
    try {
      const [productData, unitData, categoryData] = await Promise.all([
        apiRequest<{ products: Product[] }>(`/api/products?includeInactive=${includeInactive}`),
        apiRequest<{ units: Unit[] }>(`/api/units${includeArchivedUnits ? "?includeInactive=true" : ""}`),
        apiRequest<{ categories: Category[] }>(`/api/categories${includeArchivedCategories ? "?includeInactive=true" : ""}`),
      ]);
      setError(""); setProducts(productData.products); setUnits(unitData.units); setCategories(categoryData.categories);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load products."); }
    finally { setLoading(false); }
  }, [includeInactive, canManageProducts, includeArchivedCategories, includeArchivedUnits]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const activeCategories = categories.filter((category) => category.isActive !== false);
  const archivedCategories = categories.filter((category) => category.isActive === false);
  const activeUnits = units.filter((unit) => unit.isActive !== false);
  const archivedUnits = units.filter((unit) => unit.isActive === false);
  const lowStockCount = visibleProducts.filter((product) => Number(product.stockOnHand) <= Number(product.lowStockThreshold)).length;
  const labelProduct = products.find((product) => product.id === labelProductId) ?? null;
  const labelTotal = Math.min(120, Math.max(1, Math.round(Number(labelCount) || 1)));

  function showSuccess(message: string) {
    setNotice(message);
    notifySuccessToast(message);
  }

  function printLabels() {
    if (!labelProduct) return;
    printedTitle.current = document.title;
    document.title = `stockpilot-labels-${labelProduct.sku}`;
    setLabelPrint(true);
    // The printable sheet is mounted by the state change above, so print one tick later.
    window.setTimeout(() => window.print(), 120);
  }

  async function changeActive(product: Product) {
    setBusyId(product.id); setError(""); setNotice("");
    try {
      await apiRequest(`/api/products/${product.id}`, { method: "PATCH", body: jsonBody({ isActive: !product.isActive }) });
      showSuccess(product.isActive ? "Product archived." : "Product restored.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Product could not be updated."); }
    finally { setBusyId(""); }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCategoryModalError(""); setCategorySaving(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const categoryId = editingCategory?.id;
    try {
      await apiRequest(categoryId ? `/api/categories/${categoryId}` : "/api/categories", {
        method: categoryId ? "PATCH" : "POST",
        body: jsonBody({ name: form.get("categoryName"), description: form.get("categoryDescription") || null }),
      });
      if (!categoryId) setCategoryFormVersion((version) => version + 1);
      setEditingCategory(null);
      setCategoryModalOpen(false);
      showSuccess(categoryId ? "Category updated." : "Category created.");
      await load();
    }
    catch (caught) { setCategoryModalError(caught instanceof Error ? caught.message : "Category could not be saved."); }
    finally { setCategorySaving(false); }
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unitId = editingUnit?.id;
    setUnitModalError(""); setUnitSaving(true); setNotice("");
    const body = { code: String(form.get("code")).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_"), name: form.get("name"), symbol: form.get("symbol") };
    try {
      await apiRequest(unitId ? `/api/units/${unitId}` : "/api/units", { method: unitId ? "PATCH" : "POST", body: jsonBody(body) });
      if (!unitId) setUnitFormVersion((version) => version + 1);
      showSuccess(unitId ? "Unit updated." : "Unit created.");
      setEditingUnit(null);
      setUnitModalOpen(false);
      await load();
    }
    catch (caught) { setUnitModalError(caught instanceof Error ? caught.message : "Unit could not be saved."); }
    finally { setUnitSaving(false); }
  }
  async function toggleUnit(unit: Unit) {
    setBusyUnitId(unit.id);
    try { await apiRequest(`/api/units/${unit.id}`, { method: "PATCH", body: jsonBody({ isActive: unit.isActive === false }) }); showSuccess(unit.isActive === false ? "Unit restored." : "Unit archived."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unit could not be updated."); }
    finally { setBusyUnitId(null); }
  }

  async function toggleCategory(category: Category) {
    setBusyCategoryId(category.id);
    try { await apiRequest(`/api/categories/${category.id}`, { method: "PATCH", body: jsonBody({ isActive: category.isActive === false }) }); showSuccess(category.isActive === false ? "Category restored." : "Category archived."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Category could not be updated."); }
    finally { setBusyCategoryId(null); }
  }

  return <div className={`flex flex-col gap-5 ${labelPrint ? "label-print-mode" : ""}`}>
    <PageHeader eyebrow="Catalog" title="Products" description="Manage products, prices, stock thresholds and package sizes." action={canManageProducts ? <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setEditorOpen(true); }}>Add product</Button> : undefined} />
    <section aria-label="Product overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-2xl shadow-gray-100 dark:shadow-none"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes size={18}/></span><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">Total products</p><p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{products.length.toLocaleString()}</p></div></div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-2xl shadow-gray-100 dark:shadow-none"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><span className="size-2 rounded-full bg-current"/></span><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">Active products</p><p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{products.filter((product) => product.isActive).length.toLocaleString()}</p></div></div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-2xl shadow-gray-100 dark:shadow-none"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-soft text-amber-strong"><span className="text-sm font-bold">!</span></span><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">Need restocking</p><p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{products.filter((product) => product.isActive && Number(product.stockOnHand) <= Number(product.lowStockThreshold)).length.toLocaleString()}</p></div></div>
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-2xl shadow-gray-100 dark:shadow-none"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal-strong"><Barcode size={18}/></span><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">Categories · units</p><p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{activeCategories.length.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">· {activeUnits.length.toLocaleString()}</span></p></div></div>
    </section>
    <div className="min-h-12" aria-live="polite">{error ? <ErrorMessage>{error}</ErrorMessage> : notice ? <Notice>{notice}</Notice> : null}</div>
    <Panel title="Product catalog" description={`${visibleProducts.length.toLocaleString()} products${lowStockCount ? ` · ${lowStockCount} need restocking` : ""}`} action={<div className="product-catalog-action"><label className="relative min-w-0 flex-1 sm:flex-none"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" aria-label="Search products by name, SKU or barcode" value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} w-full pl-9 sm:w-60`} placeholder="Search name, SKU, barcode" /></label>{canManageProducts && <label className="product-archive-toggle"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="accent-primary" /> Include archived</label>}</div>}>
      {loading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : <div className="product-catalog-frame overflow-hidden rounded-2xl border border-border/70"><div className="overflow-x-auto"><table className="stock-table product-catalog-table w-full min-w-[800px] text-left text-[13px]"><thead className="bg-primary/[0.06] text-[10px] uppercase tracking-[0.1em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Product</th><th className="px-3 py-2.5 font-semibold">Barcode</th><th className="px-3 py-2.5 text-right font-semibold">Stock</th><th className="px-3 py-2.5 text-right font-semibold">Purchase</th><th className="px-3 py-2.5 text-right font-semibold">Selling</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-border/70">{visibleProducts.map((product) => {
        const low = Number(product.stockOnHand) <= Number(product.lowStockThreshold);
        return <tr key={product.id} tabIndex={0} aria-label={`View details for ${product.name}`} onClick={() => setSelectedProduct(product)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedProduct(product); } }} className="cursor-pointer align-middle transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"><td className="px-3 py-3"><p className="font-semibold text-foreground">{product.name}</p><p className="mt-1 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-teal-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-[0.08em] text-teal-strong">{product.sku}</span><span className="text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"} · {product.baseUnit.symbol}</span></p>{product.units.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{product.units.map((item) => `1 ${item.unit?.name ?? "package"} = ${item.conversionToBase} ${product.baseUnit.symbol}`).join(" · ")}</p>}</td><td className="px-3 py-3 text-xs">{product.barcode ? <span className="rounded-md border border-border px-1.5 py-0.5 font-mono tabular-nums text-foreground/80">{product.barcode}</span> : <span className="text-muted-foreground">No barcode</span>}</td><td className="px-3 py-3 text-right"><p className={`font-medium tabular-nums ${low ? "text-amber-strong" : "text-foreground"}`}>{product.stockOnHand} {product.baseUnit.symbol}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{low ? "Low · alert at" : "Alert at"} {product.lowStockThreshold}</p></td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(product.purchasePrice)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-teal-strong">{formatMoney(product.sellingPrice)}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{product.isActive ? "Active" : "Archived"}</span></td><td className="px-3 py-3">{canManageProducts && <div className="flex justify-end gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); setEditing(product); setEditorOpen(true); }} aria-label={`Edit ${product.name}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 text-[11px] font-semibold text-blue-strong transition-colors hover:bg-muted"><SquarePen size={14}/><span>Edit</span></button><button type="button" disabled={busyId === product.id} onClick={(event) => { event.stopPropagation(); void changeActive(product); }} aria-label={busyId === product.id ? "Updating product status" : product.isActive ? `Deactivate ${product.name}` : `Restore ${product.name}`} className={`inline-flex h-8 min-w-[100px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-50 ${product.isActive ? "bg-danger/5 text-danger transition-colors hover:bg-danger/10" : "bg-success text-white shadow-sm transition-[filter] hover:brightness-95"}`} style={product.isActive ? undefined : { backgroundColor: "var(--success)" }}><span aria-hidden="true">{busyId === product.id ? <LoaderCircle size={14} className="animate-spin"/> : product.isActive ? <ArchiveX size={14}/> : <ArchiveRestore size={14}/>}</span><span>{product.isActive ? "Deactivate" : "Restore"}</span></button></div>}</td></tr>;
      })}</tbody></table></div>{visibleProducts.length === 0 && <TableEmpty><><Boxes className="mx-auto mb-2 text-muted-foreground" size={24} />No products match this search.</></TableEmpty>}</div>}
    </Panel>
    {canManageProducts && <>
      <Panel title="Categories" description="Organize the product catalog. Archived categories remain on past invoices." action={<div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className="h-9 px-3 text-xs" icon={<Plus size={14}/>} onClick={() => { setEditingCategory(null); setCategoryModalError(""); setCategoryModalOpen(true); }}>Add category</Button><label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><input type="checkbox" checked={includeArchivedCategories} onChange={(event) => setIncludeArchivedCategories(event.target.checked)} className="accent-primary" /> Include archived</label></div>}>
        <div className="flex flex-wrap gap-2">{activeCategories.map((category) => <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{category.name}<button type="button" onClick={() => { setEditingCategory(category); setCategoryModalError(""); setCategoryModalOpen(true); }} className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-semibold text-primary transition-colors hover:underline"><SquarePen size={12}/>Edit</button><button type="button" disabled={busyCategoryId === category.id} onClick={() => void toggleCategory(category)} className="inline-flex min-w-[64px] items-center justify-center gap-1 px-1 py-1 text-[10px] font-semibold text-danger transition-colors hover:underline disabled:opacity-60">{busyCategoryId === category.id ? <LoaderCircle size={12} className="animate-spin"/> : <ArchiveX size={12}/>}<span>Archive</span></button></span>)}</div>
        {includeArchivedCategories && archivedCategories.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Archived — restore to use again</p><div className="flex flex-wrap gap-2">{archivedCategories.map((category) => <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{category.name}<span className="text-muted-foreground">(archived)</span><button type="button" onClick={() => { setEditingCategory(category); setCategoryModalError(""); setCategoryModalOpen(true); }} className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-semibold text-primary transition-colors hover:underline"><SquarePen size={12}/>Edit</button><button type="button" disabled={busyCategoryId === category.id} onClick={() => void toggleCategory(category)} className="inline-flex min-w-[64px] items-center justify-center gap-1 px-1 py-1 text-[10px] font-semibold text-success transition-colors hover:underline disabled:opacity-60">{busyCategoryId === category.id ? <LoaderCircle size={12} className="animate-spin"/> : <ArchiveRestore size={12}/>}<span>Restore</span></button></span>)}</div></div>}
      </Panel>
      <Panel title="Units" description="Add store-specific units for product package conversions. Archived units remain attached to historical records." action={<div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className="h-9 px-3 text-xs" icon={<Plus size={14}/>} onClick={() => { setEditingUnit(null); setUnitModalError(""); setUnitModalOpen(true); }}>Add unit</Button><label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><input type="checkbox" checked={includeArchivedUnits} onChange={(event) => setIncludeArchivedUnits(event.target.checked)} className="accent-primary" /> Include archived</label></div>}>
        <div className="flex flex-wrap gap-2">{activeUnits.map((unit) => <span key={unit.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{unit.name} ({unit.symbol})<button type="button" onClick={() => { setEditingUnit(unit); setUnitModalError(""); setUnitModalOpen(true); }} className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-semibold text-primary transition-colors hover:underline"><SquarePen size={12}/>Edit</button><button type="button" disabled={busyUnitId === unit.id} onClick={() => void toggleUnit(unit)} className="inline-flex min-w-[64px] items-center justify-center gap-1 px-1 py-1 text-[10px] font-semibold text-danger transition-colors hover:underline disabled:opacity-60">{busyUnitId === unit.id ? <LoaderCircle size={12} className="animate-spin"/> : <ArchiveX size={12}/>}<span>Archive</span></button></span>)}</div>
        {includeArchivedUnits && archivedUnits.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Archived — restore to use again</p><div className="flex flex-wrap gap-2">{archivedUnits.map((unit) => <span key={unit.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{unit.name} ({unit.symbol})<span className="text-muted-foreground">(archived)</span><button type="button" onClick={() => { setEditingUnit(unit); setUnitModalError(""); setUnitModalOpen(true); }} className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-semibold text-primary transition-colors hover:underline"><SquarePen size={12}/>Edit</button><button type="button" disabled={busyUnitId === unit.id} onClick={() => void toggleUnit(unit)} className="inline-flex min-w-[64px] items-center justify-center gap-1 px-1 py-1 text-[10px] font-semibold text-success transition-colors hover:underline disabled:opacity-60">{busyUnitId === unit.id ? <LoaderCircle size={12} className="animate-spin"/> : <ArchiveRestore size={12}/>}<span>Restore</span></button></span>)}</div></div>}
      </Panel>
      {categoryModalOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !categorySaving) { setCategoryModalOpen(false); setEditingCategory(null); } }}><section role="dialog" aria-modal="true" aria-labelledby="category-modal-title" className="w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Product catalog</p><h3 id="category-modal-title" className="mt-1 text-lg font-semibold">{editingCategory ? "Edit category" : "Create category"}</h3></div><button type="button" disabled={categorySaving} onClick={() => { setCategoryModalOpen(false); setEditingCategory(null); }} aria-label="Close category dialog" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={16}/></button></div><form key={`${editingCategory?.id ?? "new-category"}-${categoryFormVersion}`} onSubmit={(event) => void saveCategory(event)} className="space-y-3"><label className="block text-xs font-medium">Category name<input autoFocus required maxLength={100} name="categoryName" defaultValue={editingCategory?.name ?? ""} className={`${inputClass} mt-1.5`} placeholder="e.g. Grocery"/></label><label className="block text-xs font-medium">Description <span className="font-normal text-muted-foreground">optional</span><textarea name="categoryDescription" maxLength={500} defaultValue={editingCategory?.description ?? ""} className={`${textareaClass} mt-1.5`} placeholder="Short description"/></label>{categoryModalError && <ErrorMessage>{categoryModalError}</ErrorMessage>}<div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={categorySaving} onClick={() => { setCategoryModalOpen(false); setEditingCategory(null); }}>Cancel</Button><Button type="submit" disabled={categorySaving} icon={categorySaving ? <LoaderCircle size={14} className="animate-spin"/> : undefined}>{categorySaving ? "Saving…" : editingCategory ? "Save category" : "Create category"}</Button></div></form></section></div>}
      {unitModalOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !unitSaving) { setUnitModalOpen(false); setEditingUnit(null); } }}><section role="dialog" aria-modal="true" aria-labelledby="unit-modal-title" className="w-full max-w-md rounded-[24px] border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Product catalog</p><h3 id="unit-modal-title" className="mt-1 text-lg font-semibold">{editingUnit ? "Edit unit" : "Create unit"}</h3></div><button type="button" disabled={unitSaving} onClick={() => { setUnitModalOpen(false); setEditingUnit(null); }} aria-label="Close unit dialog" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={16}/></button></div><form key={`${editingUnit?.id ?? "new-unit"}-${unitFormVersion}`} onSubmit={(event) => void saveUnit(event)} className="space-y-3"><label className="block text-xs font-medium">Unit name<input autoFocus required maxLength={80} name="name" defaultValue={editingUnit?.name ?? ""} className={`${inputClass} mt-1.5`} placeholder="e.g. Kilogram"/></label><label className="block text-xs font-medium">Symbol<input required maxLength={20} name="symbol" defaultValue={editingUnit?.symbol ?? ""} className={`${inputClass} mt-1.5`} placeholder="e.g. kg"/></label><label className="block text-xs font-medium">Code<input required maxLength={30} pattern="[A-Za-z0-9_-]+" name="code" defaultValue={editingUnit?.code ?? ""} className={`${inputClass} mt-1.5 uppercase`} placeholder="e.g. KG"/></label>{unitModalError && <ErrorMessage>{unitModalError}</ErrorMessage>}<div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={unitSaving} onClick={() => { setUnitModalOpen(false); setEditingUnit(null); }}>Cancel</Button><Button type="submit" disabled={unitSaving} icon={unitSaving ? <LoaderCircle size={14} className="animate-spin"/> : undefined}>{unitSaving ? "Saving…" : editingUnit ? "Save unit" : "Create unit"}</Button></div></form></section></div>}
    </>}
    {canManageProducts && <Panel title="Barcode stickers" description="Prepare product labels for an A4 sheet. Each sticker includes the product name, scannable SKU and selling price.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-[18px] border border-border/70 bg-background/60 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
            <label className="block text-xs font-semibold text-foreground">Product to label<select className={`${selectClass} mt-1.5`} value={labelProductId} onChange={(event) => setLabelProductId(event.target.value)}><option value="">Choose a product</option>{products.filter((product) => product.isActive).map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label>
            <div className="block text-xs font-semibold text-foreground">Number of copies<div className="mt-1.5 flex h-10 items-center overflow-hidden rounded-xl border border-border bg-input"><button type="button" aria-label="Remove one sticker" onClick={() => setLabelCount((count) => Math.max(1, count - 1))} className="grid h-full w-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">−</button><input type="number" min={1} max={120} value={labelCount} onChange={(event) => setLabelCount(Math.min(120, Math.max(1, Number(event.target.value) || 1)))} className="h-full min-w-0 flex-1 border-x border-border bg-transparent text-center text-sm font-semibold tabular-nums outline-none"/><button type="button" aria-label="Add one sticker" onClick={() => setLabelCount((count) => Math.min(120, count + 1))} className="grid h-full w-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">+</button></div></div>
          </div>
          {labelProduct ? <div className="mt-4 grid gap-2 rounded-xl bg-muted/35 p-3 sm:grid-cols-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">SKU · Barcode</p><p className="mt-1 truncate font-mono text-sm font-semibold">{labelProduct.sku}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Selling price</p><p className="mt-1 text-sm font-semibold tabular-nums text-teal-strong">{formatMoney(labelProduct.sellingPrice)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Paper estimate</p><p className="mt-1 text-sm font-semibold">{Math.ceil(labelTotal / LABELS_PER_PAGE)} A4 {Math.ceil(labelTotal / LABELS_PER_PAGE) === 1 ? "page" : "pages"}</p></div></div> : <div className="mt-4 flex min-h-[76px] items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Barcode size={18}/></span><p className="text-xs leading-5 text-muted-foreground">Choose a product to preview its barcode sticker and print details.</p></div>}
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-[18px] border border-primary/15 bg-primary/[0.045] p-4 sm:p-5"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary"><Printer size={12}/> A4 sticker sheet</span><p className="mt-3 text-sm font-semibold">12 labels per page</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Two columns by six rows. Labels include the SKU as a Code 128 barcode.</p></div><Button className="w-full" icon={<Printer size={15}/>} onClick={printLabels} disabled={!labelProduct}>Print {labelProduct ? `${labelTotal} stickers` : "stickers"}</Button></div>
      </div>
      {labelProduct && <div className="mt-5 overflow-hidden rounded-[18px] border border-border/70"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-4 py-3"><div><p className="text-sm font-semibold">Sticker preview</p><p className="mt-0.5 text-[11px] text-muted-foreground">Showing up to 12 labels from the A4 sheet</p></div><span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">{labelTotal} total</span></div><div className="max-h-[420px] overflow-auto bg-muted/15 p-3 sm:p-4"><StickerSheet product={labelProduct} count={Math.min(labelTotal, LABELS_PER_PAGE)} priceLabel={formatMoney(labelProduct.sellingPrice)} /></div></div>}
    </Panel>}    {labelProduct && <div className="label-sheet"><StickerSheet product={labelProduct} count={labelTotal} priceLabel={formatMoney(labelProduct.sellingPrice)} /></div>}
    {selectedProduct && <ProductDetailsModal product={selectedProduct} formatMoney={formatMoney} onClose={() => setSelectedProduct(null)} />}
    {editorOpen && <ProductEditor key={editing?.id ?? "new"} product={editing} units={units} categories={categories} onClose={() => setEditorOpen(false)} onCategoryCreated={(category) => setCategories((current) => [...current.filter((item) => item.id !== category.id), category])} onUnitCreated={(unit) => setUnits((current) => [...current.filter((item) => item.id !== unit.id), unit])} onSaved={() => { setEditorOpen(false); showSuccess(editing ? "Product updated." : "Product created."); void load(); }} />}
  </div>;
}
