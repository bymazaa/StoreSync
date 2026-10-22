"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Barcode, Boxes, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react";
import { PageHeader, Panel, ErrorMessage, Notice, TableEmpty, inputClass, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { apiRequest, jsonBody } from "@/lib/client-api";
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

function skuPrefix(categoryName?: string) {
  const words = categoryName?.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  return words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 2) || "PR" : words[0]?.slice(0, 2) || "PR";
}

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
    const body = {
      name: values.get("name"), barcode: values.get("barcode") || null,
      brand: values.get("brand") || null, categoryId: values.get("categoryId") || null, baseUnitId,
      lowStockThreshold: values.get("lowStockThreshold"),
      units: conversions.filter((item) => item.unitId && item.conversionToBase),
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
        <div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Product catalog</p><h2 id="product-editor-title" className="mt-1 text-xl font-semibold">{product ? "Edit product" : "Add product"}</h2><p className="mt-1 text-sm text-muted-foreground">Add product details. Set purchase and selling prices, stock, and tracking when receiving a purchase.</p></div><button type="button" onClick={onClose} aria-label="Close form" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={17} /></button></div>
        <form key={product?.id ?? "new-product"} onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Product name</span><input name="name" required maxLength={160} defaultValue={product?.name} className={inputClass} placeholder="e.g. Basmati rice" /></label>
            <div className="block"><span className="mb-1.5 block text-xs font-medium">SKU · Auto generated</span><p className={`${inputClass} flex items-center bg-muted text-muted-foreground`}>{product?.sku ?? `${skuPrefix(categories.find((item) => item.id === categoryId)?.name)}-XXXXXX`}</p></div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Brand <span className="text-muted-foreground">optional</span></span><input name="brand" maxLength={120} defaultValue={product?.brand ?? ""} className={inputClass} placeholder="Brand name" /></label>
            <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><Barcode size={14} /> Barcode <span className="text-muted-foreground">optional</span></span><input name="barcode" maxLength={120} defaultValue={product?.barcode ?? ""} className={inputClass} placeholder="Scan or type barcode" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Category</span><select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={selectClass}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Stock unit</span><select name="baseUnitId" required value={baseUnitId} onChange={(event) => { const next = event.target.value; setBaseUnitId(next); setConversions((rows) => rows.filter((row) => row.unitId !== next)); }} className={selectClass}><option value="" disabled>Select a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Low stock alert</span><input name="lowStockThreshold" type="number" min="0" step="0.000001" defaultValue={product?.lowStockThreshold ?? "0"} className={inputClass} /></label>
          </div>
          <div className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Package conversions</p><p className="mt-1 text-xs text-muted-foreground">For example, 1 bag = 50 kg. The stock unit is the base unit.</p></div><Button type="button" variant="outline" icon={<Plus size={14} />} onClick={() => setConversions((current) => [...current, { unitId: "", conversionToBase: "1" }])}>Add unit</Button></div>
            {conversions.length > 0 && <div className="mt-4 space-y-3">{conversions.map((conversion, index) => <div key={`${conversion.unitId}-${index}`} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Package unit</span><select value={conversion.unitId} onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, unitId: event.target.value } : row))} className={selectClass}><option value="">Choose a unit</option>{activeUnits.filter((unit) => !conversions.some((item, itemIndex) => item.unitId === unit.id && itemIndex !== index)).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label><label className="block"><span className="mb-1 block text-[11px] text-muted-foreground">Equals base units</span><input value={conversion.conversionToBase} type="number" min="0.00000001" step="0.00000001" onChange={(event) => setConversions((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, conversionToBase: event.target.value } : row))} className={inputClass} /></label><button type="button" aria-label="Remove unit" onClick={() => setConversions((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger"><X size={15} /></button></div>)}</div>}
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy} icon={busy ? <LoaderCircle size={15} className="animate-spin" /> : undefined}>{busy ? "Saving..." : product ? "Save changes" : "Create product"}</Button></div>
        </form>
      </section>
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

  const load = useCallback(async () => {
    try {
      const [productData, unitData, categoryData] = await Promise.all([
        apiRequest<{ products: Product[] }>(`/api/products?includeInactive=${includeInactive}`),
        apiRequest<{ units: Unit[] }>(`/api/units${canManageProducts ? "?includeInactive=true" : ""}`),
        apiRequest<{ categories: Category[] }>(`/api/categories${includeInactive ? "?includeInactive=true" : ""}`),
      ]);
      setError(""); setProducts(productData.products); setUnits(unitData.units); setCategories(categoryData.categories);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load products."); }
    finally { setLoading(false); }
  }, [includeInactive, canManageProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

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

  return <>
    <PageHeader eyebrow="Catalog" title="Products" description="Manage products, prices, stock thresholds and package sizes." action={canManageProducts ? <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setEditorOpen(true); }}>Add product</Button> : undefined} />
    {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}{error && <div className="mb-4"><ErrorMessage>{error}</ErrorMessage></div>}
    {canManageProducts && <><Panel title="Categories" description="Organize the product catalog. Archived categories remain on past invoices."><div className="flex flex-wrap gap-2">{categories.map((category) => <span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{category.name}{category.isActive === false && <span className="text-muted-foreground">(archived)</span>}<button type="button" onClick={() => setEditingCategory(category)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleCategory(category)} className="font-semibold text-primary">{category.isActive === false ? "Restore" : "Archive"}</button></span>)}</div><form key={`${editingCategory?.id ?? "new-category"}-${categoryFormVersion}`} onSubmit={saveCategory} className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input name="categoryName" required maxLength={100} defaultValue={editingCategory?.name} className={inputClass} placeholder="Category name"/><input name="categoryDescription" maxLength={500} defaultValue={editingCategory?.description ?? ""} className={inputClass} placeholder="Description (optional)"/><div className="flex gap-2"><Button type="submit">{editingCategory ? "Save" : "Add category"}</Button>{editingCategory && <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>}</div></form></Panel><Panel title="Units" description="Add store-specific units for product package conversions. Archived units remain attached to historical records."><div className="mb-4 flex flex-wrap gap-2">{units.map((unit) => <span key={unit.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">{unit.name} ({unit.symbol}){unit.isActive === false && <span className="text-muted-foreground">(archived)</span>}<button type="button" onClick={() => setEditingUnit(unit)} className="font-semibold text-primary">Edit</button><button type="button" onClick={() => void toggleUnit(unit)} className="font-semibold text-primary">{unit.isActive === false ? "Restore" : "Archive"}</button></span>)}</div><form key={`${editingUnit?.id ?? "new-unit"}-${unitFormVersion}`} onSubmit={saveUnit} className="grid gap-2 sm:grid-cols-4"><input name="name" required maxLength={80} defaultValue={editingUnit?.name} className={inputClass} placeholder="Unit name"/><input name="symbol" required maxLength={20} defaultValue={editingUnit?.symbol} className={inputClass} placeholder="Symbol"/><input name="code" required maxLength={30} defaultValue={editingUnit?.code} className={inputClass} placeholder="Unique code"/><div className="flex gap-2"><Button type="submit">{editingUnit ? "Save" : "Add unit"}</Button>{editingUnit && <Button type="button" variant="ghost" onClick={() => setEditingUnit(null)}>Cancel</Button>}</div></form></Panel></>}
    <Panel title="Product catalog" description={`${visibleProducts.length.toLocaleString()} products`} action={<div className="flex flex-wrap items-center gap-2"><label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} w-56 pl-9`} placeholder="Search name, SKU, barcode" /></label>{canManageProducts && <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="accent-primary" /> Include archived</label>}</div>}>
      {loading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Product</th><th className="pb-3 font-medium">SKU / Barcode</th><th className="pb-3 font-medium">Stock</th><th className="pb-3 font-medium">Purchase</th><th className="pb-3 font-medium">Selling</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">{visibleProducts.map((product) => <tr key={product.id} className="align-middle"><td className="py-3.5"><p className="font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"} · {product.baseUnit.symbol}</p></td><td className="py-3.5 text-xs"><p>{product.sku}</p><p className="mt-0.5 text-muted-foreground">{product.barcode || "No barcode"}</p></td><td className="py-3.5"><p className="font-medium">{product.stockOnHand} {product.baseUnit.symbol}</p><p className="mt-0.5 text-xs text-muted-foreground">Alert at {product.lowStockThreshold}</p></td><td className="py-3.5 tabular-nums">{formatMoney(product.purchasePrice)}</td><td className="py-3.5 tabular-nums">{formatMoney(product.sellingPrice)}</td><td className="py-3.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{product.isActive ? "Active" : "Archived"}</span></td><td className="py-3.5">{canManageProducts && <div className="flex justify-end gap-1"><button type="button" onClick={() => { setEditing(product); setEditorOpen(true); }} aria-label={`Edit ${product.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button type="button" disabled={busyId === product.id} onClick={() => void changeActive(product)} aria-label={product.isActive ? `Archive ${product.name}` : `Restore ${product.name}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><Archive size={15} /></button></div>}</td></tr>)}</tbody></table>{visibleProducts.length === 0 && <TableEmpty><><Boxes className="mx-auto mb-2 text-muted-foreground" size={24} />No products match this search.</></TableEmpty>}</div>}
    </Panel>
    {editorOpen && <ProductEditor key={editing?.id ?? "new"} product={editing} units={units} categories={categories} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setNotice(editing ? "Product updated." : "Product created."); void load(); }} />}
  </>;
}
