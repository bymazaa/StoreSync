"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Barcode, Boxes, LoaderCircle, Pencil, Plus, Printer, Search, X } from "lucide-react";
import { PageHeader, Panel, ErrorMessage, Notice, TableEmpty, inputClass, selectClass } from "@/components/ui/page";
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

function ProductEditor({ product, units, categories, onClose, onSaved }: {
  product: Product | null; units: Unit[]; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [conversions, setConversions] = useState<ConversionDraft[]>(product?.units.map((item) => ({
    unitId: item.unitId, conversionToBase: String(item.conversionToBase),
  })) ?? []);
  const [baseUnitId, setBaseUnitId] = useState(product?.baseUnitId ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeUnits = units.filter((unit) => unit.isActive !== false && unit.id !== baseUnitId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    const baseUnitId = String(values.get("baseUnitId") ?? "");
    // A half-filled conversion row used to be dropped silently, so the product saved with no packages
    // and the counter only ever showed the stock unit.
    const filled = conversions.filter((item) => item.unitId || item.conversionToBase);
    if (filled.some((item) => !item.unitId || !item.conversionToBase)) {
      setBusy(false);
      setError("Every package conversion needs a unit and a base-unit amount. Fill the row or remove it.");
      return;
    }
    // Prices go up only when they actually moved, so the activity log doesn't claim a change on every save.
    const sellingPrice = toAsciiDigits(String(values.get("sellingPrice") ?? ""));
    const costPrice = toAsciiDigits(String(values.get("purchasePrice") ?? ""));
    const body = {
      name: values.get("name"), barcode: values.get("barcode") || null,
      brand: values.get("brand") || null, categoryId: values.get("categoryId") || null, baseUnitId,
      lowStockThreshold: values.get("lowStockThreshold"),
      units: filled,
      ...(product && sellingPrice && sellingPrice !== String(product.sellingPrice) ? { sellingPrice } : {}),
      ...(product && costPrice && costPrice !== String(product.purchasePrice) ? { purchasePrice: costPrice } : {}),
    };
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Product catalog</p><h2 id="product-editor-title" className="mt-1 text-xl font-semibold">{product ? "Edit product" : "Add product"}</h2><p className="mt-1 text-sm text-muted-foreground">Prices are per stock unit, so package prices follow them. Received stock, cost and expiry batches are entered on a purchase.</p></div><button type="button" onClick={onClose} aria-label="Close form" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={17} /></button></div>
        <form key={product?.id ?? "new-product"} onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Product name</span><input name="name" required maxLength={160} defaultValue={product?.name} className={inputClass} placeholder="e.g. Basmati rice" /></label>
            <div className="block"><span className="mb-1.5 block text-xs font-medium">SKU · Auto generated from category</span><p className={`${inputClass} flex items-center bg-muted text-muted-foreground`}>{product?.sku ?? `${skuCategoryPrefix(categories.find((item) => item.id === categoryId)?.name)}-###`}</p></div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Brand <span className="text-muted-foreground">optional</span></span><input name="brand" maxLength={120} defaultValue={product?.brand ?? ""} className={inputClass} placeholder="Brand name" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Barcode size={14} /> Barcode <span className="text-muted-foreground">optional</span></span><input name="barcode" maxLength={120} defaultValue={product?.barcode ?? ""} className={inputClass} placeholder="Scan or type barcode" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Category</span><select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Stock unit</span><select name="baseUnitId" required value={baseUnitId} onChange={(event) => { const next = event.target.value; setBaseUnitId(next); setConversions((rows) => rows.filter((row) => row.unitId !== next)); }} className={selectClass}><option value="" disabled>Select a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Low stock alert</span><input name="lowStockThreshold" type="number" min="0" step="0.000001" defaultValue={product?.lowStockThreshold ?? "0"} className={inputClass} /></label>
          </div>
          {product && <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Selling price per {product.baseUnit.symbol}</span><input name="sellingPrice" required inputMode="decimal" defaultValue={String(product.sellingPrice)} className={inputClass} placeholder="0.00" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">Cost per {product.baseUnit.symbol} <span className="text-muted-foreground">correction only</span></span><input name="purchasePrice" inputMode="decimal" defaultValue={String(product.purchasePrice)} className={inputClass} placeholder="0.00" /></label>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">The new selling price applies to the next sale; printed invoices keep the price they were sold at. Cost is the average of your purchases and the next purchase recalculates it, so change it only when the last purchase was entered wrong. Package prices follow this base price.</p>
          </div>}
          <div className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Package conversions</p><p className="mt-1 text-xs text-muted-foreground">For example, 1 bag = 50 kg. The stock unit is the base unit.</p></div><Button type="button" variant="outline" icon={<Plus size={14} />} onClick={() => setConversions((current) => [...current, { unitId: "", conversionToBase: "1" }])}>Add unit</Button></div>
            {conversions.length > 0 && <div className="mt-4 space-y-3">{conversions.map((conversion, index) => <div key={`${conversion.unitId}-${index}`} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Package unit</span><select value={conversion.unitId} onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitId: event.target.value } : row))} className={selectClass}><option value="">Choose a unit</option>{activeUnits.filter((unit) => !conversions.some((item, itemIndex) => item.unitId === unit.id && itemIndex !== index)).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Equals base units</span><input value={conversion.conversionToBase} type="text" inputMode="decimal" onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, conversionToBase: toAsciiDigits(event.target.value) } : row))} className={inputClass} placeholder="50" /></label><button type="button" aria-label="Remove unit" onClick={() => setConversions((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"><X size={15} /></button></div>)}</div>}
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy} icon={busy ? <LoaderCircle size={15} className="animate-spin" /> : undefined}>{busy ? "Saving..." : product ? "Save changes" : "Create product"}</Button></div>
        </form>
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
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
      setNotice(product.isActive ? "Product archived." : "Product restored.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Product could not be updated."); }
    finally { setBusyId(""); }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const categoryId = editingCategory?.id;
    try {
      await apiRequest(categoryId ? `/api/categories/${categoryId}` : "/api/categories", {
        method: categoryId ? "PATCH" : "POST",
        body: jsonBody({ name: form.get("categoryName"), description: form.get("categoryDescription") || null }),
      });
      if (!categoryId) setCategoryFormVersion((version) => version + 1);
      setEditingCategory(null);
      setNotice(categoryId ? "Category updated." : "Category created.");
      await load();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Category could not be created."); }
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unitId = editingUnit?.id;
    setError("");
    const body = { code: String(form.get("code")).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_"), name: form.get("name"), symbol: form.get("symbol") };
    try {
      await apiRequest(unitId ? `/api/units/${unitId}` : "/api/units", { method: unitId ? "PATCH" : "POST", body: jsonBody(body) });
      if (!unitId) setUnitFormVersion((version) => version + 1);
      setNotice(unitId ? "Unit updated." : "Unit created.");
      setEditingUnit(null);
      await load();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unit could not be saved."); }
  }
  async function toggleUnit(unit: Unit) {
    try { await apiRequest(`/api/units/${unit.id}`, { method: "PATCH", body: jsonBody({ isActive: unit.isActive === false }) }); setNotice(unit.isActive === false ? "Unit restored." : "Unit archived."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unit could not be updated."); }
  }

  async function toggleCategory(category: Category) {
    try { await apiRequest(`/api/categories/${category.id}`, { method: "PATCH", body: jsonBody({ isActive: category.isActive === false }) }); setNotice(category.isActive === false ? "Category restored." : "Category archived."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Category could not be updated."); }
  }

  return <div className={`flex flex-col gap-5 ${labelPrint ? "label-print-mode" : ""}`}>
    <PageHeader eyebrow="Catalog" title="Products" description="Manage products, prices, stock thresholds and package sizes." action={canManageProducts ? <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setEditorOpen(true); }}>Add product</Button> : undefined} />
    {notice && <Notice>{notice}</Notice>}{error && <ErrorMessage>{error}</ErrorMessage>}
    {canManageProducts && <><Panel title="Categories" description="Organize the product catalog. Archived categories remain on past invoices." action={<label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><input type="checkbox" checked={includeArchivedCategories} onChange={(event) => setIncludeArchivedCategories(event.target.checked)} className="accent-primary" /> Include archived</label>}><div className="flex flex-wrap gap-2">{activeCategories.map((category) => <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{category.name}<button type="button" onClick={() => setEditingCategory(category)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleCategory(category)} className="font-semibold text-primary">Archive</button></span>)}</div>{includeArchivedCategories && archivedCategories.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Archived — restore to use again</p><div className="flex flex-wrap gap-2">{archivedCategories.map((category) => <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{category.name}<span className="text-muted-foreground">(archived)</span><button type="button" onClick={() => setEditingCategory(category)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleCategory(category)} className="font-semibold text-primary">Restore</button></span>)}</div></div>}<form key={`${editingCategory?.id ?? "new-category"}-${categoryFormVersion}`} onSubmit={saveCategory} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input name="categoryName" required maxLength={100} defaultValue={editingCategory?.name} className={inputClass} placeholder="Category name"/><input name="categoryDescription" maxLength={500} defaultValue={editingCategory?.description ?? ""} className={inputClass} placeholder="Description (optional)"/><div className="flex gap-2"><Button type="submit">{editingCategory ? "Save" : "Add category"}</Button>{editingCategory && <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>}</div></form></Panel><Panel title="Units" description="Add store-specific units for product package conversions. Archived units remain attached to historical records." action={<label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><input type="checkbox" checked={includeArchivedUnits} onChange={(event) => setIncludeArchivedUnits(event.target.checked)} className="accent-primary" /> Include archived</label>}><div className="flex flex-wrap gap-2">{activeUnits.map((unit) => <span key={unit.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{unit.name} ({unit.symbol})<button type="button" onClick={() => setEditingUnit(unit)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleUnit(unit)} className="font-semibold text-primary">Archive</button></span>)}</div>{includeArchivedUnits && archivedUnits.length > 0 && <div className="mt-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Archived — restore to use again</p><div className="flex flex-wrap gap-2">{archivedUnits.map((unit) => <span key={unit.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{unit.name} ({unit.symbol})<span className="text-muted-foreground">(archived)</span><button type="button" onClick={() => setEditingUnit(unit)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleUnit(unit)} className="font-semibold text-primary">Restore</button></span>)}</div></div>}<form key={`${editingUnit?.id ?? "new-unit"}-${unitFormVersion}`} onSubmit={saveUnit} className="mt-4 grid gap-2 sm:grid-cols-4"><input name="name" required maxLength={80} defaultValue={editingUnit?.name} className={inputClass} placeholder="Unit name"/><input name="symbol" required maxLength={20} defaultValue={editingUnit?.symbol} className={inputClass} placeholder="Symbol"/><input name="code" required maxLength={30} defaultValue={editingUnit?.code} className={inputClass} placeholder="Unique code"/><div className="flex gap-2"><Button type="submit">{editingUnit ? "Save" : "Add unit"}</Button>{editingUnit && <Button type="button" variant="ghost" onClick={() => setEditingUnit(null)}>Cancel</Button>}</div></form></Panel></>}
    <Panel title="Product catalog" description={`${visibleProducts.length.toLocaleString()} products${lowStockCount ? ` · ${lowStockCount} need restocking` : ""}`} action={<div className="product-catalog-action"><label className="relative min-w-0 flex-1 sm:flex-none"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" aria-label="Search products by name, SKU or barcode" value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} w-full pl-9 sm:w-60`} placeholder="Search name, SKU, barcode" /></label>{canManageProducts && <label className="product-archive-toggle"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="accent-primary" /> Include archived</label>}</div>}>
      {loading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : <div className="product-catalog-frame overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="stock-table product-catalog-table w-full min-w-[800px] text-left text-sm"><thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Product</th><th className="px-3 py-2.5 font-semibold">Barcode</th><th className="px-3 py-2.5 text-right font-semibold">Stock</th><th className="px-3 py-2.5 text-right font-semibold">Purchase</th><th className="px-3 py-2.5 text-right font-semibold">Selling</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-border/70">{visibleProducts.map((product) => {
        const low = Number(product.stockOnHand) <= Number(product.lowStockThreshold);
        return <tr key={product.id} className="align-middle transition-colors hover:bg-teal-soft/40"><td className="px-3 py-3"><p className="font-semibold text-foreground">{product.name}</p><p className="mt-1 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-teal-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-[0.08em] text-teal-strong">{product.sku}</span><span className="text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"} · {product.baseUnit.symbol}</span></p>{product.units.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{product.units.map((item) => `1 ${item.unit?.name ?? "package"} = ${item.conversionToBase} ${product.baseUnit.symbol}`).join(" · ")}</p>}</td><td className="px-3 py-3 text-xs">{product.barcode ? <span className="rounded-md border border-border px-1.5 py-0.5 font-mono tabular-nums text-foreground/80">{product.barcode}</span> : <span className="text-muted-foreground">No barcode</span>}</td><td className="px-3 py-3 text-right"><p className={`font-medium tabular-nums ${low ? "text-amber-strong" : "text-foreground"}`}>{product.stockOnHand} {product.baseUnit.symbol}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{low ? "Low · alert at" : "Alert at"} {product.lowStockThreshold}</p></td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(product.purchasePrice)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-teal-strong">{formatMoney(product.sellingPrice)}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{product.isActive ? "Active" : "Archived"}</span></td><td className="px-3 py-3">{canManageProducts && <div className="flex justify-end gap-1"><button type="button" onClick={() => { setEditing(product); setEditorOpen(true); }} aria-label={`Edit ${product.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button type="button" disabled={busyId === product.id} onClick={() => void changeActive(product)} aria-label={product.isActive ? `Archive ${product.name}` : `Restore ${product.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><Archive size={15} /></button></div>}</td></tr>;
      })}</tbody></table></div>{visibleProducts.length === 0 && <TableEmpty><><Boxes className="mx-auto mb-2 text-muted-foreground" size={24} />No products match this search.</></TableEmpty>}</div>}
    </Panel>
    {canManageProducts && <Panel title="Barcode stickers" description="A4 sheet: two columns, six rows — 12 large stickers per page. Each sticker prints the product’s own SKU as a Code 128, so the scanned code and the typed SKU are always the same thing.">
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(240px,1fr)_150px_auto]">
        <label className="text-xs text-muted-foreground">Product<select className={`${selectClass} mt-1`} value={labelProductId} onChange={(event) => setLabelProductId(event.target.value)}><option value="">Choose a product</option>{products.filter((product) => product.isActive).map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Number of stickers<input type="number" min={1} max={120} value={labelCount} onChange={(event) => setLabelCount(Number(event.target.value) || 1)} className={`${inputClass} mt-1`} /></label>
        <Button icon={<Printer size={15} />} onClick={printLabels} disabled={!labelProduct}>Print sheet</Button>
      </div>
      {labelProduct && <p className="mt-3 text-xs text-muted-foreground">{labelTotal} stickers over {Math.ceil(labelTotal / LABELS_PER_PAGE)} page(s) · SKU {labelProduct.sku} as Code 128 · price {formatMoney(labelProduct.sellingPrice)}{Number(labelProduct.sellingPrice) > 0 ? "" : " — set a selling price by completing a purchase"}</p>}
      {labelProduct && <div className="mt-4 overflow-x-auto"><StickerSheet product={labelProduct} count={Math.min(labelTotal, LABELS_PER_PAGE)} priceLabel={formatMoney(labelProduct.sellingPrice)} /></div>}
    </Panel>}
    {labelProduct && <div className="label-sheet"><StickerSheet product={labelProduct} count={labelTotal} priceLabel={formatMoney(labelProduct.sellingPrice)} /></div>}
    {editorOpen && <ProductEditor key={editing?.id ?? "new"} product={editing} units={units} categories={categories} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setNotice(editing ? "Product updated." : "Product created."); void load(); }} />}
  </div>;
}
