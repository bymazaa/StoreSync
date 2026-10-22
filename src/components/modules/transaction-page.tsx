"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useHasPermission, useShopCountryCode, useShopFormat } from "@/components/app/shop-context";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { centsToMoney, convertUnitDecimal, decimalCents, moneyProductCents, percentOfCents } from "@/lib/money";
import { usesWholeQuantity } from "@/lib/quantity";

type Unit = { id: string; name: string; symbol: string };
type Product = { id: string; name: string; sku: string; barcode: string | null; sellingPrice: string; purchasePrice: string; stockOnHand: string; tracksBatch: boolean; tracksExpiry: boolean; baseUnitId: string; baseUnit: Unit; units: { unitId: string; conversionToBase: string; unit: Unit }[] };
type Contact = { id: string; name: string; phoneE164: string | null; email: string | null; address: string | null };
type Method = { id: string; name: string };
type RecentInvoice = { id: string; invoiceNumber: string; total: string; dueAmount: string; status: string; soldAt?: string; purchasedAt?: string; customer?: { name: string } | null; supplier?: { name: string } | null };
type Line = { productId: string; unitId: string; quantity: string; price: string; sellingPrice: string; batchNumber: string; expiresAt: string; trackBatch: boolean; trackExpiry: boolean };

function trimDecimalZeros(value: string | number) {
  const str = String(value);
  return str.includes(".") ? str.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") : str;
}

export function TransactionPage({ mode }: { mode: "sale" | "purchase" }) {
  const isSale = mode === "sale";
  const { formatMoney, formatDateTime } = useShopFormat();
  const countryCode = useShopCountryCode();
  const canDiscount = useHasPermission("APPLY_DISCOUNTS");
  const canPurchase = useHasPermission("CREATE_PURCHASES");
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [recent, setRecent] = useState<RecentInvoice[]>([]);
  const [contactId, setContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState("");
  const [discountValue, setDiscountValue] = useState("0");
  const [additionalCost, setAdditionalCost] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [allowDue, setAllowDue] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [query, setQuery] = useState("");
  const [outOfStock, setOutOfStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{ id: string; invoiceNumber: string; total: string; dueAmount: string } | null>(null);
  const pendingTransactionRequests = useRef(new Map<string, string>());
  const title = isSale ? "New sale" : "New purchase";
  const load = useCallback(async () => {
    try {
      const [p, c, invoices] = await Promise.all([
        apiRequest<{ products: Product[] }>("/api/products"),
        apiRequest<{ customers: Contact[] }>(isSale ? "/api/customers" : "/api/suppliers"),
        apiRequest<{ sales?: RecentInvoice[]; purchases?: RecentInvoice[] }>(isSale ? "/api/sales" : "/api/purchases"),
      ]);
      const loadedContacts = isSale ? c.customers : (c as unknown as { suppliers: Contact[] }).suppliers;
      setProducts(p.products); setContacts(loadedContacts); setContactResults(loadedContacts);
      setRecent(invoices.sales ?? invoices.purchases ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Checkout data could not be loaded."); }
  }, [isSale]);
  useEffect(() => {
    let active = true;
    const loadMethods = () => { void apiRequest<{ paymentMethods: Method[] }>("/api/payment-methods").then((result) => { if (active) setMethods(result.paymentMethods); }).catch(() => { if (active) { setMethods([]); setError("Payment methods could not be loaded. Refresh the page and try again."); } }); };
    const timer = window.setTimeout(loadMethods, 0);
    window.addEventListener("focus", loadMethods);
    window.addEventListener("stockpilot:payment-methods-changed", loadMethods);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("focus", loadMethods); window.removeEventListener("stockpilot:payment-methods-changed", loadMethods); };
  }, []);
  useEffect(() => {
    const queryText = contactSearch.trim();
    if (!queryText) { setContactResults(contacts); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      const endpoint = isSale ? "customers" : "suppliers";
      void apiRequest<{ customers?: Contact[]; suppliers?: Contact[] }>(`/api/${endpoint}?q=${encodeURIComponent(queryText)}`)
        .then((result) => { if (active) setContactResults(isSale ? result.customers ?? [] : result.suppliers ?? []); })
        .catch(() => { if (active) setContactResults([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [contactSearch, contacts, isSale]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void apiRequest<{ products: Product[] }>(`/api/products?q=${encodeURIComponent(query.trim())}`).then((result) => { if (active) setSearchResults(result.products); }).catch(() => { if (active) setSearchResults([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  useEffect(() => {
    if (!isSale) return;
    const digits = contactPhone.replace(/\D/g, "");
    if (digits.length < 7) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void apiRequest<{ customers: Contact[] }>(`/api/customers?q=${encodeURIComponent(digits)}`).then((result) => {
        if (!active) return;
        const match = result.customers.find((contact) => contact.phoneE164?.replace(/\D/g, "").endsWith(digits.slice(-10)));
        if (match) { setContactId(match.id); setSelectedContact(match); setContactName(match.name); setContactEmail(match.email ?? ""); setContactAddress(match.address ?? ""); }
      }).catch(() => {});
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [contactPhone, isSale]);
  // Mirror server-side per-line cent rounding for a stable preview; the API recalculates every total.
  const subtotalCents = lines.reduce((sum, line) => sum + moneyProductCents(line.price || "0", line.quantity || "0"), BigInt(0));
  const discountCents = discountType === "PERCENTAGE" ? percentOfCents(subtotalCents, discountValue || "0") : discountType === "FIXED_AMOUNT" ? decimalCents(discountValue || "0") : BigInt(0);
  const additionalCents = isSale ? BigInt(0) : decimalCents(additionalCost || "0");
  const totalCents = (subtotalCents > discountCents ? subtotalCents - discountCents : BigInt(0)) + additionalCents;
  const subtotal = centsToMoney(subtotalCents);
  const total = centsToMoney(totalCents);
  const amountPaid = !allowDue ? total : paidAmount;
  const enteredPaidCents = decimalCents(amountPaid || "0");
  const duePreview = centsToMoney(totalCents > enteredPaidCents ? totalCents - enteredPaidCents : BigInt(0));
  useEffect(() => {
    if (allowDue && decimalCents(paidAmount || "0") > totalCents) setPaidAmount(total);
  }, [allowDue, paidAmount, total, totalCents]);
  const results = searchResults.slice(0, 8);
  function addProduct(product: Product) {
    if (isSale && Number(product.stockOnHand) <= 0) {
      setOutOfStock(product.name); setQuery(""); setSearchResults([]);
      return;
    }
    setOutOfStock("");
    setLines((existing) => {
      const index = existing.findIndex((line) => line.productId === product.id && line.unitId === product.baseUnitId);
      if (index >= 0) return existing.map((line, i) => i === index ? { ...line, quantity: String(Number(line.quantity) + 1) } : line);
      return [...existing, { productId: product.id, unitId: product.baseUnitId, quantity: "1", price: trimDecimalZeros(isSale ? product.sellingPrice : product.purchasePrice), sellingPrice: trimDecimalZeros(product.sellingPrice), batchNumber: "", expiresAt: "", trackBatch: product.tracksBatch, trackExpiry: product.tracksExpiry }];
    }); setQuery("");
  }
  function updateLine(index: number, patch: Partial<Line>) { setLines((old) => old.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function updateContactPhone(value: string) {
    setContactPhone(value);
    if (!isSale) return;
    // Stored phone numbers are E.164; compare national digits for a tolerant customer lookup.
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) return;
    const match = contacts.find((contact) => contact.phoneE164?.replace(/\D/g, "").endsWith(digits.slice(-10)));
    if (match) { setContactId(match.id); setSelectedContact(match); setContactName(match.name); setContactEmail(match.email ?? ""); setContactAddress(match.address ?? ""); }
    else if (contactId) { setContactId(""); setSelectedContact(null); setContactName(""); setContactEmail(""); setContactAddress(""); }
  }
  function chooseContact(contact: Contact) {
    setContactId(contact.id); setSelectedContact(contact); setContactSearch(""); setContactSearchOpen(false);
    setContactName(contact.name); setContactPhone(contact.phoneE164 ?? ""); setContactEmail(contact.email ?? ""); setContactAddress(contact.address ?? "");
  }
  function clearContact() {
    setContactId(""); setSelectedContact(null); setContactSearch(""); setContactName(""); setContactPhone(""); setContactEmail(""); setContactAddress("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      let chosenContact = contactId;
      const name = contactName.trim();
      const phone = contactPhone.trim();
      const address = contactAddress.trim();
      if (!isSale && !chosenContact && !name) throw new Error("Choose a supplier or enter a supplier name.");
      if (!chosenContact && name) {
        try {
          const created = await apiRequest<{ customer?: Contact; supplier?: Contact }>(isSale ? "/api/customers" : "/api/suppliers", { method: "POST", body: jsonBody({ name, phone: phone || null, email: contactEmail || null, address: address || null }) });
          chosenContact = (created.customer ?? created.supplier)!.id;
          setContactId(chosenContact);
        } catch (caught) {
          // A phone conflict returns the existing contact — reuse it instead of failing the invoice.
          const payload = (caught as { payload?: { customer?: Contact; supplier?: Contact } }).payload;
          const existing = payload?.customer ?? payload?.supplier;
          if (!existing) throw caught;
          chosenContact = existing.id;
          setContactId(chosenContact);
          setSelectedContact(existing);
          setContactName(existing.name);
          setContactPhone(existing.phoneE164 ?? "");
          setContactEmail(existing.email ?? "");
          setContactAddress(existing.address ?? "");
        }
      }
      const common = {
        discountType: discountType || null, discountValue: discountType ? discountValue : undefined, paidAmount: amountPaid,
        paymentMethodId: Number(amountPaid) > 0 ? paymentMethodId || null : null,
        paymentReference: form.get("paymentReference") || null, notes: form.get("notes") || null,
        items: lines.filter((line) => line.productId).map((line) => ({ productId: line.productId, unitId: line.unitId, quantity: line.quantity,
          ...(isSale ? { unitPrice: line.price } : { unitCost: line.price, sellingPrice: line.sellingPrice, trackBatch: line.trackBatch, trackExpiry: line.trackExpiry, batchNumber: line.batchNumber || null, expiresAt: line.expiresAt ? new Date(`${line.expiresAt}T00:00:00Z`).toISOString() : null }) })),
      };
      const salePayload = { ...common, customerId: chosenContact || null };
      const purchasePayload = { ...common, supplierId: chosenContact, supplierInvoiceNumber: form.get("supplierInvoiceNumber") || null, additionalCost: additionalCost || "0" };
      const payload = isSale ? salePayload : purchasePayload;
      const fingerprint = JSON.stringify(payload);
      // A retry of the same online checkout reuses its key, preventing duplicate stock and invoices.
      let requestId = pendingTransactionRequests.current.get(fingerprint);
      if (!requestId) {
        requestId = crypto.randomUUID();
        pendingTransactionRequests.current.set(fingerprint, requestId);
      }
      const body = isSale
        ? { ...salePayload, clientRequestId: requestId }
        : { ...purchasePayload, clientRequestId: requestId };
      const response = await apiRequest<{ sale?: { id: string; invoiceNumber: string; total: string; dueAmount: string }; purchase?: { id: string; invoiceNumber: string; total: string; dueAmount: string } }>(isSale ? "/api/sales" : "/api/purchases", { method: "POST", body: jsonBody(body) });
      const completedInvoice = response.sale ?? response.purchase;
      if (!completedInvoice) throw new Error("The server did not return the completed invoice. Retry safely or refresh the invoice list.");
      await load();
      setInvoice(completedInvoice);
      pendingTransactionRequests.current.delete(fingerprint);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice could not be completed.");
    }
    finally { setBusy(false); }
  }
  if (invoice) return <div className="space-y-5"><PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title="Invoice completed" description="The transaction and stock update were saved together."/><Panel title={invoice.invoiceNumber} description={`Total ${formatMoney(invoice.total)} · Due ${formatMoney(invoice.dueAmount)}`}><div className="flex flex-wrap gap-3"><Link className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={`/${isSale ? "sales" : "purchases"}/${invoice.id}`}>Open printable invoice</Link><Button variant="outline" onClick={() => { setInvoice(null); setLines([]); setPaidAmount("0"); setAdditionalCost("0"); setAllowDue(false); setContactId(""); setContactPhone(""); setContactName(""); setContactAddress(""); }}>Create another</Button></div></Panel></div>;
  return <div className="space-y-6"><PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title={title} description={isSale ? "Search or scan a product, add items and complete the sale." : "Choose a supplier, record received stock and payment."}/>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <Panel title="Add products" description="Search by name, SKU or barcode; package units convert into base stock units."><div className="relative"><input autoComplete="off" value={query} onChange={(e) => { setQuery(e.target.value); setSearchResults([]); setOutOfStock(""); }} className={inputClass} placeholder="Search or scan barcode"/>{query && <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{results.map((p) => { const stock = Number(p.stockOnHand); return <button type="button" key={p.id} onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-muted"><span className="min-w-0"><span className="block truncate font-medium">{p.name}<span className="ml-2 text-xs text-muted-foreground">{p.sku}</span></span><span className={`mt-0.5 block text-xs ${stock <= 0 ? "font-semibold text-danger" : "text-muted-foreground"}`}>{trimDecimalZeros(p.stockOnHand)} {p.baseUnit.symbol} in stock{stock <= 0 ? " · out of stock" : ""}</span></span><span className="shrink-0">{formatMoney(isSale ? p.sellingPrice : p.purchasePrice)} / {p.baseUnit.symbol}</span></button>; })}{results.length === 0 && <p className="p-4 text-sm text-muted-foreground">No products found.</p>}</div>}</div>
      {outOfStock && <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"><span><strong>{outOfStock}</strong> is out of stock. Receive a purchase before selling it.</span>{canPurchase && <Link href="/purchases" className="font-semibold underline">Create a purchase</Link>}<button type="button" onClick={() => setOutOfStock("")} className="ml-auto rounded-md p-1 hover:bg-danger/10" aria-label="Dismiss stock warning"><X size={14} /></button></div>}
    </Panel>
    <form onSubmit={submit} className="space-y-5">
      <Panel title="Invoice items" description={isSale ? "Adjust quantity, package and transaction price per line." : "Enter the supplier cost and customer selling price per stock unit."}><div className="space-y-3">{lines.map((line, index) => { const p = products.find((item) => item.id === line.productId); const units = p ? [{ id: p.baseUnitId, name: p.baseUnit.name, symbol: p.baseUnit.symbol, conversion: "1" }, ...p.units.map((u) => ({ ...u.unit, conversion: u.conversionToBase }))] : []; const selectedUnit = units.find((unit) => unit.id === line.unitId); const wholeQuantity = usesWholeQuantity(selectedUnit?.name ?? "", selectedUnit?.symbol ?? ""); const lineTotal = centsToMoney(moneyProductCents(line.price || "0", line.quantity || "0")); return <div key={`${line.productId}-${index}`} className="grid items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(100px,.7fr)_100px_140px_140px_110px_auto]">{p ? <div className="pb-2 text-sm font-medium">{p.name}<span className="block text-xs text-muted-foreground">{p.sku} · {formatMoney(lineTotal)}</span></div> : <select required value={line.productId} onChange={(e) => { const item = products.find((x) => x.id === e.target.value); if (item) addProduct(item); }} className={selectClass}><option value="">Choose product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}{p && <select value={line.unitId} onChange={(e) => { const nextUnit = units.find((unit) => unit.id === e.target.value); const oldUnit = units.find((unit) => unit.id === line.unitId); const convertedPrice = nextUnit && oldUnit ? convertUnitDecimal(line.price, oldUnit.conversion, nextUnit.conversion) : line.price; updateLine(index, { unitId: e.target.value, price: trimDecimalZeros(convertedPrice) }); }} className={selectClass}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}<input aria-label="Quantity" required type="number" min={wholeQuantity ? "1" : "0.01"} step={wholeQuantity ? "1" : "0.01"} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className={inputClass} placeholder="Qty"/><input aria-label={isSale ? "Configured unit price" : "Unit cost"} required readOnly={isSale} type="number" min="0" step="0.01" value={line.price} onChange={(e) => updateLine(index, { price: e.target.value })} className={inputClass} placeholder={isSale ? "Price" : "Cost"}/>{!isSale && <input aria-label="Selling price per stock unit" required type="number" min="0.01" step="0.01" value={line.sellingPrice} onChange={(e) => updateLine(index, { sellingPrice: e.target.value })} className={inputClass} placeholder="Selling price / stock unit"/>}{!isSale && <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-2 text-xs sm:col-span-2 lg:col-span-3"><label className="flex items-center gap-2"><input type="checkbox" checked={line.trackBatch} disabled={Boolean(p?.tracksBatch)} onChange={(e) => updateLine(index, { trackBatch: e.target.checked, batchNumber: e.target.checked ? line.batchNumber : "" })} className="accent-primary"/>Track batches for this product</label><label className="flex items-center gap-2"><input type="checkbox" checked={line.trackExpiry} disabled={Boolean(p?.tracksExpiry)} onChange={(e) => updateLine(index, { trackExpiry: e.target.checked, expiresAt: e.target.checked ? line.expiresAt : "" })} className="accent-primary"/>Track expiry for this product</label><span className="text-muted-foreground">Once enabled, tracking stays on for this product.</span></div>}{!isSale && line.trackBatch && <input required value={line.batchNumber} onChange={(e) => updateLine(index, { batchNumber: e.target.value })} className={inputClass} placeholder="Batch number"/>}{!isSale && line.trackExpiry && <input required type="date" value={line.expiresAt} onChange={(e) => updateLine(index, { expiresAt: e.target.value })} className={inputClass}/>}<Button type="button" variant="ghost" onClick={() => setLines((old) => old.filter((_, i) => i !== index))}>Remove</Button></div>; })}{lines.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Search for a product above to add your first item.</p>}</div></Panel>
      <Panel title={isSale ? "Customer" : "Supplier"} description={isSale ? "Search an existing customer by name, phone or email, or enter details below." : "Search an existing supplier by name, phone or email, or enter details below."}><div className="grid gap-3 sm:grid-cols-2"><div className="relative sm:col-span-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input aria-label={`Search existing ${isSale ? "customers" : "suppliers"}`} autoComplete="off" value={contactSearch} onFocus={() => setContactSearchOpen(true)} onBlur={() => window.setTimeout(() => setContactSearchOpen(false), 120)} onChange={(event) => { const value = event.target.value; if (contactId) clearContact(); setContactSearch(value); setContactSearchOpen(true); }} className={`${inputClass} pl-9`} placeholder={`Search ${isSale ? "customer" : "supplier"} by name, phone or email`}/>{contactSearchOpen && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{contactResults.map((contact) => <button type="button" key={contact.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseContact(contact)} className="block w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted"><span className="block text-sm font-medium">{contact.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{[contact.phoneE164, contact.email].filter(Boolean).join(" · ") || "No phone or email"}</span></button>)}{contactResults.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching {isSale ? "customers" : "suppliers"} found.</p>}</div>}</div>{selectedContact && <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm sm:col-span-2"><span>Selected {isSale ? "customer" : "supplier"}: <strong>{selectedContact.name}</strong></span><button type="button" onClick={clearContact} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear selected contact"><X size={15}/></button></div>}<input name="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} placeholder={`${isSale ? "Customer" : "Supplier"} name`}/><PhoneInput name="contactPhone" countryCode={countryCode} value={contactPhone} onChange={updateContactPhone} placeholder="Phone (optional)"/><input name="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" className={inputClass} placeholder="Email (optional)"/><AddressInput name="contactAddress" value={contactAddress} onChange={setContactAddress} countryCode={countryCode} placeholder="Search address or type manually"/>{!isSale && <label className="block"><span className="mb-1.5 block text-xs font-medium">Supplier invoice number (optional)</span><input name="supplierInvoiceNumber" maxLength={100} className={inputClass} placeholder="Number printed on supplier bill" /></label>}{!isSale && <input name="additionalCost" type="number" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} className={inputClass} placeholder="Additional landed cost"/>}</div></Panel>
      <Panel title="Discount and payment" description={`Subtotal ${formatMoney(subtotal)}${!isSale && additionalCents > BigInt(0) ? ` · Landed ${formatMoney(centsToMoney(additionalCents))}` : ""} · Total ${formatMoney(total)}`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{canDiscount && <><select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className={selectClass}><option value="">No discount</option><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select><input aria-label="Discount value" disabled={!discountType} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" min="0" step="0.01" max={discountType === "PERCENTAGE" ? 100 : undefined} className={inputClass} placeholder="Discount"/></>}<div className="space-y-1.5 sm:col-span-2 lg:col-span-2"><div className="flex items-center gap-2"><input aria-label="Amount paid" value={amountPaid} onChange={(e) => setPaidAmount(e.target.value)} readOnly={!allowDue} type="number" min="0" max={total} step="0.01" className={`${inputClass} min-w-0 flex-1`} placeholder="Paid amount"/><label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={allowDue} onChange={(e) => { const enabled = e.target.checked; setAllowDue(enabled); if (enabled) setPaidAmount(total); }} className="accent-primary"/>Allow due</label></div>{allowDue && <p aria-live="polite" className="text-xs text-muted-foreground">Due: {formatMoney(duePreview)} · Enter 0 to leave the full amount due.</p>}</div><select required={Number(amountPaid) > 0} disabled={Number(amountPaid) <= 0} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={selectClass}><option value="">Payment method</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><input name="paymentReference" className={inputClass} placeholder="Payment reference (optional)"/><textarea name="notes" className={`${inputClass} min-h-10 sm:col-span-2`} placeholder="Invoice note (optional)"/></div><div className="mt-4 flex justify-end"><Button type="submit" disabled={busy || lines.length === 0}>{busy ? "Saving invoice…" : `Complete ${isSale ? "sale" : "purchase"}`}</Button></div></Panel>
    </form>
    <Panel title={`Recent ${isSale ? "sales" : "purchases"}`} description="Open an invoice for reprinting or a closer review."><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">{isSale ? "Customer" : "Supplier"}</th><th className="px-3 py-3">Total</th><th className="px-3 py-3">Due</th><th className="px-3 py-3">Status</th><th/></tr></thead><tbody className="divide-y divide-border">{recent.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium">{item.invoiceNumber}</td><td className="px-3 py-3">{formatDateTime(item.soldAt ?? item.purchasedAt ?? "")}</td><td className="px-3 py-3">{item.customer?.name ?? item.supplier?.name ?? "Walk-in"}</td><td className="px-3 py-3">{formatMoney(item.total)}</td><td className="px-3 py-3">{formatMoney(item.dueAmount)}</td><td className="px-3 py-3">{item.status.replaceAll("_", " ")}</td><td className="px-3 py-3"><Link className="text-primary underline" href={`/${isSale ? "sales" : "purchases"}/${item.id}`}>Invoice</Link></td></tr>)}{recent.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No invoices have been recorded yet.</td></tr>}</tbody></table></div></Panel>
  </div>;
}
