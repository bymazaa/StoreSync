"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { Minus, Plus, Search, X } from "lucide-react";
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

const invoiceStatusTones: Record<string, string> = {
  COMPLETED: "bg-teal-soft text-teal-strong",
  PARTIALLY_RETURNED: "bg-amber-soft text-amber-strong",
  RETURNED: "bg-violet-soft text-violet-strong",
  CANCELLED: "bg-danger/10 text-danger",
  DRAFT: "bg-muted text-muted-foreground",
};

function trimDecimalZeros(value: string | number) {
  const str = String(value);
  return str.includes(".") ? str.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "") : str;
}

// The counter is operated with one hand on the scanner, so every shortcut the cashier needs is shown
// rather than documented elsewhere.
function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">{children}</kbd>;
}

// A radio chip: the shared `name` keeps the group native, so the arrow keys move the selection.
function Chip({ group, label, checked, disabled, onPick }: { group: string; label: string; checked: boolean; disabled?: boolean; onPick: () => void }) {
  return <label className={`flex-1 whitespace-nowrap rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-colors ${checked ? "border-primary/40 bg-teal-soft text-teal-strong" : "border-border bg-background text-muted-foreground hover:bg-muted"} ${disabled ? "pointer-events-none opacity-50" : "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25"}`}><input type="radio" name={group} checked={checked} disabled={disabled} onChange={onPick} className="sr-only"/>{label}</label>;
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
  const [cursor, setCursor] = useState(0);
  const [outOfStock, setOutOfStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<{ id: string; invoiceNumber: string; total: string; dueAmount: string } | null>(null);
  const pendingTransactionRequests = useRef(new Map<string, string>());
  const searchRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
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
  // Cash is how this counter is run, so it is preselected; a hand-picked method is never overwritten.
  useEffect(() => {
    if (paymentMethodId || !methods.length) return;
    const timer = window.setTimeout(() => {
      const cash = methods.find((method) => method.name.trim().toLowerCase() === "cash");
      setPaymentMethodId((cash ?? methods[0]).id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [methods, paymentMethodId]);
  useEffect(() => {
    const queryText = contactSearch.trim();
    if (!queryText) {
      const timer = window.setTimeout(() => setContactResults(contacts), 0);
      return () => window.clearTimeout(timer);
    }
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
      void apiRequest<{ products: Product[] }>(`/api/products?q=${encodeURIComponent(query.trim())}`).then((result) => { if (active) { setSearchResults(result.products); setCursor(0); } }).catch(() => { if (active) setSearchResults([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  // The counter is a scan-and-type screen, so the product search takes focus when the page opens
  // and again once an invoice is finished — no click needed for the next customer.
  useEffect(() => {
    if (invoice) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [invoice]);
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
    if (!(allowDue && decimalCents(paidAmount || "0") > totalCents)) return;
    const timer = window.setTimeout(() => setPaidAmount(total), 0);
    return () => window.clearTimeout(timer);
  }, [allowDue, paidAmount, total, totalCents]);
  const results = searchResults.slice(0, 8);
  // Keep the caret in the search box so a scanner can feed the next item immediately.
  function keepSearchFocused() { window.setTimeout(() => searchRef.current?.focus(), 0); }
  function addProduct(product: Product) {
    if (isSale && Number(product.stockOnHand) <= 0) {
      setOutOfStock(product.name); setQuery(""); setSearchResults([]); keepSearchFocused();
      return;
    }
    setOutOfStock("");
    setLines((existing) => {
      const index = existing.findIndex((line) => line.productId === product.id && line.unitId === product.baseUnitId);
      if (index >= 0) return existing.map((line, i) => i === index ? { ...line, quantity: String(Number(line.quantity) + 1) } : line);
      return [...existing, { productId: product.id, unitId: product.baseUnitId, quantity: "1", price: trimDecimalZeros(isSale ? product.sellingPrice : product.purchasePrice), sellingPrice: trimDecimalZeros(product.sellingPrice), batchNumber: "", expiresAt: "", trackBatch: product.tracksBatch, trackExpiry: product.tracksExpiry }];
    }); setQuery("");
    keepSearchFocused();
  }
  function updateLine(index: number, patch: Partial<Line>) { setLines((old) => old.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function stepQuantity(index: number, delta: number) {
    const line = lines[index];
    if (!line) return;
    const next = Math.max(0.01, Number(line.quantity || "0") + delta);
    updateLine(index, { quantity: trimDecimalZeros(String(Number(next.toFixed(3)))) });
  }
  function removeLine(index: number) {
    setLines((old) => old.filter((_, i) => i !== index));
    keepSearchFocused();
  }
  // A scanner sends Enter right after the last digit, before the debounced lookup has fired,
  // so the term is resolved on demand: one match goes straight into the invoice.
  async function commitSearch() {
    const term = query.trim();
    if (!term) return;
    try {
      const found = await apiRequest<{ products: Product[] }>(`/api/products?q=${encodeURIComponent(term)}`);
      if (found.products.length === 1) addProduct(found.products[0]);
      else setSearchResults(found.products);
    } catch { setSearchResults([]); }
  }
  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); setQuery(""); setSearchResults([]); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      setCursor((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (results.length) addProduct(results[Math.min(cursor, results.length - 1)]);
    else void commitSearch();
  }
  // Enter inside a quantity leaves the scanner's rhythm intact: next line, or back to the search box.
  function quantityKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = qtyRefs.current[index + 1];
    if (next) { next.focus(); next.select(); }
    else keepSearchFocused();
  }
  function toggleAllowDue(enabled: boolean) {
    setAllowDue(enabled);
    if (enabled) setPaidAmount(total);
  }
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (invoice || event.repeat) return;
      if (event.key === "F2") { event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      else if (event.key === "F4") { event.preventDefault(); contactRef.current?.focus(); }
      else if (event.key === "F8") { event.preventDefault(); toggleAllowDue(!allowDue); }
      else if (event.key === "F9" || (event.ctrlKey && event.key === "Enter")) {
        if (!lines.length || busy) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
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
      if (Number(amountPaid) > 0 && !paymentMethodId) throw new Error("Choose a payment method for the amount received.");
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
  if (invoice) return <div className="space-y-5"><PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title="Invoice completed" description="The transaction and stock update were saved together."/><Panel title={invoice.invoiceNumber} description={`Total ${formatMoney(invoice.total)} · Due ${formatMoney(invoice.dueAmount)}`}><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground" href={`/${isSale ? "sales" : "purchases"}/${invoice.id}`}>Open printable invoice</Link><Button variant="outline" icon={<Plus size={15}/>} className="sm:w-auto" onClick={() => { setInvoice(null); setLines([]); setPaidAmount("0"); setAdditionalCost("0"); setAllowDue(false); setContactId(""); setContactPhone(""); setContactName(""); setContactAddress(""); setDiscountType(""); setDiscountValue("0"); setPaymentMethodId(""); }}>Create another</Button><p className="flex items-center gap-1.5 self-center text-xs text-muted-foreground"><Key>F2</Key> then start scanning the next customer</p></div></Panel></div>;
  const unitOptions = (line: Line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return [];
    return [{ id: product.baseUnitId, name: product.baseUnit.name, symbol: product.baseUnit.symbol, conversion: "1" }, ...product.units.flatMap((u) => u.unit ? [{ ...u.unit, conversion: u.conversionToBase }] : [])];
  };
  return <div className="space-y-6"><PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title={title} description={isSale ? "Search or scan a product, add items and complete the sale." : "Choose a supplier, record received stock and payment."} action={<div className="hidden flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs text-muted-foreground lg:flex"><span className="flex items-center gap-1.5"><Key>F2</Key>search</span><span className="flex items-center gap-1.5"><Key>F4</Key>customer</span><span className="flex items-center gap-1.5"><Key>F8</Key>allow due</span><span className="flex items-center gap-1.5"><Key>F9</Key>complete</span></div>}/>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <Panel title="Items" description="Scan a barcode or type a name — the arrow keys browse the matches." action={<span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{lines.length} {lines.length === 1 ? "line" : "lines"} · {formatMoney(subtotal)}</span>}>
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"/><input ref={searchRef} aria-label="Search or scan a product" autoComplete="off" role="combobox" aria-expanded={Boolean(query.trim())} aria-controls="product-matches" value={query} onChange={(e) => { setQuery(e.target.value); setSearchResults([]); setOutOfStock(""); }} onKeyDown={searchKeyDown} className={`${inputClass} h-12 pl-10 pr-10 text-[15px]`} placeholder="Scan barcode or search product (F2)"/>{query && <button type="button" onClick={() => { setQuery(""); setSearchResults([]); keepSearchFocused(); }} aria-label="Clear product search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={15}/></button>}
          {query.trim() && <div id="product-matches" role="listbox" className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{results.map((product, index) => { const stock = Number(product.stockOnHand); return <button type="button" role="option" aria-selected={index === cursor} key={product.id} onMouseEnter={() => setCursor(index)} onClick={() => addProduct(product)} className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-0 ${index === cursor ? "bg-teal-soft" : "hover:bg-muted"}`}><span className="min-w-0"><span className="block truncate font-medium">{product.name}<span className="ml-2 text-xs text-muted-foreground">{product.sku}</span></span><span className={`mt-0.5 block text-xs ${stock <= 0 ? "font-semibold text-danger" : "text-muted-foreground"}`}>{trimDecimalZeros(product.stockOnHand)} {product.baseUnit.symbol} in stock{stock <= 0 ? " · out of stock" : ""}</span></span><span className="shrink-0 font-semibold tabular-nums">{formatMoney(isSale ? product.sellingPrice : product.purchasePrice)} <span className="text-xs font-normal text-muted-foreground">/ {product.baseUnit.symbol}</span></span></button>; })}{results.length === 0 && <p className="p-4 text-sm text-muted-foreground">No products found — press Enter to search the full catalogue again.</p>}{results.length > 1 && <p className="sticky bottom-0 flex items-center gap-1.5 bg-card px-4 py-2 text-[11px] text-muted-foreground"><Key>↑</Key><Key>↓</Key> browse · <Key>Enter</Key> add · <Key>Esc</Key> clear</p>}</div>}
        </div>
        {outOfStock && <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"><span><strong>{outOfStock}</strong> is out of stock. Receive a purchase before selling it.</span>{canPurchase && <Link href="/purchases" className="font-semibold underline">Create a purchase</Link>}<button type="button" onClick={() => setOutOfStock("")} className="ml-auto rounded-md p-1 hover:bg-danger/10" aria-label="Dismiss stock warning"><X size={14} /></button></div>}
        <div className="mt-4">{lines.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nothing added yet. Scan a barcode, or press <Key>F2</Key> and start typing.</div> : <div className="overflow-hidden rounded-xl border border-border/70">
          <div className="hidden bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_96px_160px_128px_30px] sm:gap-3"><span>Product</span><span>Unit</span><span>Quantity</span><span className="text-right">Price</span><span className="sr-only">Remove</span></div>
          <div className="divide-y divide-border/70">{lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); const units = unitOptions(line); const selectedUnit = units.find((unit) => unit.id === line.unitId); const wholeQuantity = usesWholeQuantity(selectedUnit?.name ?? "", selectedUnit?.symbol ?? ""); const lineTotal = centsToMoney(moneyProductCents(line.price || "0", line.quantity || "0")); return <div key={`${line.productId}-${index}`} className="p-3">
            <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_96px_160px_128px_30px] sm:gap-3">
              <div className="col-span-2 min-w-0 sm:col-span-1">{product ? <p className="truncate text-sm font-semibold">{product.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{product.sku}</span></p> : <select required aria-label="Product" value={line.productId} onChange={(e) => { const item = products.find((x) => x.id === e.target.value); if (item) addProduct(item); }} className={selectClass}><option value="">Choose product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}{product && <p className="text-xs tabular-nums text-muted-foreground">Line total {formatMoney(lineTotal)}<span className="sm:hidden"> · {trimDecimalZeros(product.stockOnHand)} in stock</span></p>}</div>
              {product && <select aria-label="Unit" value={line.unitId} onChange={(e) => { const nextUnit = units.find((unit) => unit.id === e.target.value); const oldUnit = units.find((unit) => unit.id === line.unitId); const convertedPrice = nextUnit && oldUnit ? convertUnitDecimal(line.price, oldUnit.conversion, nextUnit.conversion) : line.price; updateLine(index, { unitId: e.target.value, price: trimDecimalZeros(convertedPrice) }); }} className={selectClass}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => stepQuantity(index, -1)} aria-label={`Reduce ${line.productId} quantity`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"><Minus size={13}/></button>
                <input ref={(node) => { qtyRefs.current[index] = node; }} aria-label="Quantity" required type="number" inputMode={wholeQuantity ? "numeric" : "decimal"} min={wholeQuantity ? "1" : "0.01"} step={wholeQuantity ? "1" : "0.01"} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} onKeyDown={(e) => quantityKeyDown(e, index)} className={`${inputClass} min-w-0 flex-1 px-1 text-center`}/><span className="w-9 shrink-0 text-xs text-muted-foreground sm:hidden">{selectedUnit?.symbol}</span>
                <button type="button" onClick={() => stepQuantity(index, 1)} aria-label={`Increase ${line.productId} quantity`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"><Plus size={13}/></button>
              </div>
              <input aria-label={isSale ? "Configured unit price" : "Unit cost"} required readOnly={isSale} type="number" inputMode="decimal" min="0" step="0.01" value={line.price} onChange={(e) => updateLine(index, { price: e.target.value })} className={`${inputClass} text-right`} placeholder={isSale ? "Price" : "Cost"}/>
              <button type="button" onClick={() => removeLine(index)} aria-label="Remove line" className="justify-self-end rounded-lg bg-danger/10 p-2 text-danger transition-colors hover:bg-danger/20"><X size={15}/></button>
            </div>
            {!isSale && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <input aria-label="Selling price per stock unit" required type="number" inputMode="decimal" min="0.01" step="0.01" value={line.sellingPrice} onChange={(e) => updateLine(index, { sellingPrice: e.target.value })} className={inputClass} placeholder="Selling price / stock unit"/>
              {line.trackBatch && <input required aria-label="Batch number" value={line.batchNumber} onChange={(e) => updateLine(index, { batchNumber: e.target.value })} className={inputClass} placeholder="Batch number"/>}
              {line.trackExpiry && <input required type="date" aria-label="Expiry date" value={line.expiresAt} onChange={(e) => updateLine(index, { expiresAt: e.target.value })} className={inputClass}/>}
              <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/60 px-3 py-2 text-xs lg:col-span-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={line.trackBatch} disabled={Boolean(product?.tracksBatch)} onChange={(e) => updateLine(index, { trackBatch: e.target.checked, batchNumber: e.target.checked ? line.batchNumber : "" })} className="accent-primary"/>Track batches</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={line.trackExpiry} disabled={Boolean(product?.tracksExpiry)} onChange={(e) => updateLine(index, { trackExpiry: e.target.checked, expiresAt: e.target.checked ? line.expiresAt : "" })} className="accent-primary"/>Track expiry</label>
                <span className="text-muted-foreground">Once enabled, tracking stays on for this product.</span>
              </div>
            </div>}
          </div>; })}</div>
        </div>}</div>
      </Panel>

      <Panel title={isSale ? "Customer" : "Supplier"} description={isSale ? "A phone number that matches an existing customer selects them." : "Search an existing supplier, or enter details below."}>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input ref={contactRef} aria-label={`Search existing ${isSale ? "customers" : "suppliers"}`} autoComplete="off" value={contactSearch} onFocus={() => setContactSearchOpen(true)} onBlur={() => window.setTimeout(() => setContactSearchOpen(false), 120)} onChange={(event) => { const value = event.target.value; if (contactId) clearContact(); setContactSearch(value); setContactSearchOpen(true); }} className={`${inputClass} pl-9`} placeholder={`Search ${isSale ? "customer" : "supplier"} (F4)`}/>{contactSearchOpen && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{contactResults.map((contact) => <button type="button" key={contact.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseContact(contact)} className="block w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted"><span className="block text-sm font-medium">{contact.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{[contact.phoneE164, contact.email].filter(Boolean).join(" · ") || "No phone or email"}</span></button>)}{contactResults.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching {isSale ? "customers" : "suppliers"} found.</p>}</div>}</div>
          <input name="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} placeholder={`${isSale ? "Customer" : "Supplier"} name — blank is a walk-in sale`}/>
        </div>
        {selectedContact && <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm"><span>Selected: <strong>{selectedContact.name}</strong> — details below are theirs, edit only for this invoice.</span><button type="button" onClick={clearContact} className="ml-3 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear selected contact"><X size={15}/></button></div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><PhoneInput name="contactPhone" countryCode={countryCode} value={contactPhone} onChange={updateContactPhone} placeholder="Phone (optional)"/><input name="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" inputMode="email" className={inputClass} placeholder="Email (optional)"/><AddressInput name="contactAddress" value={contactAddress} onChange={setContactAddress} countryCode={countryCode} placeholder="Search address or type manually" className="sm:col-span-2"/></div>
        {!isSale && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Supplier invoice number (optional)</span><input name="supplierInvoiceNumber" maxLength={100} className={inputClass} placeholder="Number printed on supplier bill"/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Additional landed cost</span><input name="additionalCost" type="number" inputMode="decimal" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} className={inputClass} placeholder="0"/></label>
        </div>}
      </Panel>

      <Panel title="Charge" description={`Subtotal ${formatMoney(subtotal)}${!isSale && additionalCents > BigInt(0) ? ` · Landed ${formatMoney(centsToMoney(additionalCents))}` : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-teal-soft/60 px-4 py-3"><span className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-strong">Total to collect</span><span className="text-[28px] leading-none font-semibold tabular-nums text-teal-strong">{formatMoney(total)}</span></div>
          {discountCents > BigInt(0) && <p className="mt-1.5 text-right text-xs font-semibold tabular-nums text-amber-strong">− {formatMoney(centsToMoney(discountCents))} discount already counted</p>}
          <div className={`mt-3 grid gap-3 ${canDiscount ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {canDiscount && <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Discount</p><div role="radiogroup" aria-label="Discount type" className="flex gap-1.5"><Chip group="discountPick" label="None" checked={discountType === ""} onPick={() => setDiscountType("")}/><Chip group="discountPick" label="%" checked={discountType === "PERCENTAGE"} onPick={() => setDiscountType("PERCENTAGE")}/><Chip group="discountPick" label="Amount" checked={discountType === "FIXED_AMOUNT"} onPick={() => setDiscountType("FIXED_AMOUNT")}/></div><div className="relative mt-2"><input aria-label="Discount value" disabled={!discountType} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" max={discountType === "PERCENTAGE" ? 100 : undefined} className={`${inputClass} ${discountType === "PERCENTAGE" ? "pr-7" : ""}`} placeholder="0"/>{discountType === "PERCENTAGE" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}</div></div>}
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Paid</p><div className="flex items-center gap-2"><input aria-label="Amount paid" value={amountPaid} onChange={(e) => setPaidAmount(e.target.value)} readOnly={!allowDue} type="number" inputMode="decimal" min="0" max={total} step="0.01" className={`${inputClass} min-w-0 flex-1 text-right text-base font-semibold tabular-nums`}/><label className="flex shrink-0 items-center gap-2 text-xs"><input type="checkbox" checked={allowDue} onChange={(e) => toggleAllowDue(e.target.checked)} className="accent-primary"/>Allow due <Key>F8</Key></label></div><p aria-live="polite" className="mt-1.5 text-xs text-muted-foreground">{allowDue ? <>Due: <strong className="tabular-nums text-amber-strong">{formatMoney(duePreview)}</strong> · Enter 0 to leave the full amount due.</> : <>Paid in full — tick <strong>Allow due</strong> to take a part payment.</>}</p></div>
            <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Payment method</p><div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-1.5">{methods.map((method) => <Chip key={method.id} group="methodPick" label={method.name} checked={paymentMethodId === method.id} disabled={Number(amountPaid) <= 0} onPick={() => setPaymentMethodId(method.id)}/>)}</div>{Number(amountPaid) <= 0 && <p className="mt-1.5 text-xs text-muted-foreground">A method is chosen once the invoice has a value.</p>}</div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><input name="paymentReference" className={inputClass} placeholder="Reference (optional)"/><textarea name="notes" className={`${inputClass} min-h-16 py-2`} placeholder="Invoice note (optional)"/></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><Key>F9</Key> or <Key>Ctrl</Key>+<Key>Enter</Key> completes the invoice · <Key>Tab</Key> moves through the form</p>
            <Button type="submit" className="w-full sm:w-auto sm:min-w-52" disabled={busy || !lines.length}>{busy ? "Saving invoice…" : `Complete ${isSale ? "sale" : "purchase"}`}</Button>
          </div>
        </Panel>

      <Panel title={`Recent ${isSale ? "sales" : "purchases"}`} description={`Latest ${recent.length.toLocaleString()} invoices — open one for reprinting or a closer review.`}>
        <div className="overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm sm:min-w-[900px]"><thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Invoice</th><th className="px-3 py-2.5 font-semibold">Date</th><th className="hidden px-3 py-2.5 font-semibold sm:table-cell">{isSale ? "Customer" : "Supplier"}</th><th className="px-3 py-2.5 text-right font-semibold">Total</th><th className="px-3 py-2.5 text-right font-semibold">Due</th><th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Status</th><th className="px-3 py-2.5"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-border/70">{recent.map((item) => { const due = Number(item.dueAmount); return <tr key={item.id} className="align-middle transition-colors hover:bg-teal-soft/40"><td className="px-3 py-3 font-semibold tabular-nums text-foreground">{item.invoiceNumber}{item.status !== "COMPLETED" && <span className={`mt-1 flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:hidden ${invoiceStatusTones[item.status] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{item.status.replaceAll("_", " ")}</span>}</td><td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">{formatDateTime(item.soldAt ?? item.purchasedAt ?? "")}</td><td className="hidden px-3 py-3 sm:table-cell">{item.customer?.name ?? item.supplier?.name ?? "Walk-in"}</td><td className="px-3 py-3 text-right font-medium tabular-nums text-foreground">{formatMoney(item.total)}</td><td className={`px-3 py-3 text-right font-semibold tabular-nums ${due > 0 ? "text-amber-strong" : "text-muted-foreground"}`}>{formatMoney(item.dueAmount)}</td><td className="hidden px-3 py-3 sm:table-cell"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusTones[item.status] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{item.status.replaceAll("_", " ")}</span></td><td className="px-3 py-3"><div className="flex justify-end"><Link className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted" href={`/${isSale ? "sales" : "purchases"}/${item.id}`}>Invoice</Link></div></td></tr>; })}{recent.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">No invoices have been recorded yet.</td></tr>}</tbody></table></div></div>
      </Panel>
    </form>
  </div>;
}
