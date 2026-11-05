"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Minus, Plus, Search, X } from "lucide-react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { useHasPermission, useShopCountryCode, useShopFormat } from "@/components/app/shop-context";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { centsToMoney, convertUnitDecimal, decimalCents, moneyProductCents, percentOfCents } from "@/lib/money";
import { usesWholeQuantity } from "@/lib/quantity";

type Unit = { id: string; name: string; symbol: string };
type Product = { id: string; name: string; sku: string; barcode: string | null; sellingPrice: string; purchasePrice: string; stockOnHand: string; tracksBatch: boolean; tracksExpiry: boolean; baseUnitId: string; baseUnit: Unit; units: { unitId: string; conversionToBase: string; unit: Unit }[] };
type Contact = { id: string; name: string; phoneE164: string | null; email: string | null; address: string | null };
type Method = { id: string; name: string; isEnabled: boolean };
type RecentInvoice = { id: string; invoiceNumber: string; total: string; dueAmount: string; status: string; soldAt?: string; purchasedAt?: string; customer?: { name: string } | null; supplier?: { name: string } | null };
type InvoiceItem = { id: string; productName: string; skuSnapshot: string; quantity: number; unitPrice?: number; unitCost?: number; lineTotal: number; batchNumber?: string | null; unit?: { name: string; symbol: string } | null };
type InvoicePayment = { id: string; amount: number; paidAt: string; reference?: string | null; method?: { name: string } | null; collectedBy?: { fullName: string } | null };
type InvoiceReturn = { id: string; returnNumber: string; total: number };
type InvoiceDetail = { id: string; invoiceNumber: string; status: string; subtotal: number; discountAmount: number; additionalCost?: number; total: number; paidAmount: number; dueAmount: number; notes?: string | null; supplierInvoiceNumber?: string | null; soldAt?: string; purchasedAt?: string; customer?: { name: string; phoneE164?: string | null } | null; supplier?: { name: string } | null; createdBy?: { fullName: string } | null; items: InvoiceItem[]; payments: InvoicePayment[]; returns?: InvoiceReturn[] };
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
  return <label className={`flex-1 whitespace-nowrap rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-colors ${checked ? "border-primary/40 bg-teal-soft text-teal-strong" : "border-border bg-input text-muted-foreground hover:bg-muted"} ${disabled ? "pointer-events-none opacity-50" : "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/25"}`}><input type="radio" name={group} checked={checked} disabled={disabled} onChange={onPick} className="sr-only"/>{label}</label>;
}

// Below the sm breakpoint the party and status columns fold away, so the money cells caption
// themselves instead of leaving the cashier with two unlabeled numbers.
function MobileCaption({ children }: { children: ReactNode }) {
  return <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">{children}</span>;
}

export function TransactionPage({ mode }: { mode: "sale" | "purchase" }) {
  const pathname = usePathname();
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
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    setDetailId(null);
    setDetail(null);
    setDetailError("");
  }, [pathname]);
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
    const loadMethods = () => { void apiRequest<{ paymentMethods: Method[] }>("/api/payment-methods").then((result) => { if (active) setMethods(result.paymentMethods.filter((method) => method.isEnabled)); }).catch(() => { if (active) { setMethods([]); setError("Payment methods could not be loaded. Refresh the page and try again."); } }); };
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
  useEffect(() => { if (pathname !== (isSale ? "/sales" : "/purchases")) return; const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load, pathname, isSale]);
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
        if (match) { setContactId(match.id); setSelectedContact(match); setContactName(match.name); setContactEmail(match.email ?? ""); setContactAddress(match.address ?? ""); setAddressAutoFilled(true); }
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
  const fullyPaid = enteredPaidCents >= totalCents;
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
      if (invoice || detailId || event.repeat) return;
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
  // A recent row opens a preview of that saved invoice, so the counter never loses the basket
  // the cashier is still building underneath.
  useEffect(() => {
    if (!detailId) return;
    let active = true;
    setDetail(null); setDetailError("");
    void apiRequest<{ sale?: InvoiceDetail; purchase?: InvoiceDetail }>(`/api/${isSale ? "sales" : "purchases"}/${detailId}`)
      .then((payload) => { if (!active) return; const record = payload.sale ?? payload.purchase; if (!record) { setDetailError("This invoice could not be loaded."); return; } setDetail(record); })
      .catch((caught) => { if (active) setDetailError(caught instanceof Error ? caught.message : "This invoice could not be loaded."); });
    return () => { active = false; };
  }, [detailId, isSale, detailNonce]);
  useEffect(() => {
    if (!detailId) return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setDetailId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);
  useEffect(() => {
    if (!detailId) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [detailId]);
  function updateContactPhone(value: string) {
    setContactPhone(value);
    if (!isSale) return;
    // Stored phone numbers are E.164; compare national digits for a tolerant customer lookup.
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) return;
    const match = contacts.find((contact) => contact.phoneE164?.replace(/\D/g, "").endsWith(digits.slice(-10)));
    if (match) { setContactId(match.id); setSelectedContact(match); setContactName(match.name); setContactEmail(match.email ?? ""); setContactAddress(match.address ?? ""); setAddressAutoFilled(true); }
    else if (contactId) { setContactId(""); setSelectedContact(null); setContactName(""); setContactEmail(""); setContactAddress(""); setAddressAutoFilled(false); }
  }
  function chooseContact(contact: Contact) {
    setContactId(contact.id); setSelectedContact(contact); setContactSearch(""); setContactSearchOpen(false);
    setContactName(contact.name); setContactPhone(contact.phoneE164 ?? ""); setContactEmail(contact.email ?? ""); setContactAddress(contact.address ?? ""); setAddressAutoFilled(true);
  }
  function clearContact() {
    setContactId(""); setSelectedContact(null); setContactSearch(""); setContactName(""); setContactPhone(""); setContactEmail(""); setContactAddress(""); setAddressAutoFilled(false);
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
      if (Number(amountPaid) > 0 && !paymentMethodId) throw new Error(methods.length ? "Choose a payment method for the amount received." : "Enable a payment method in Settings before recording an amount paid.");
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
          setAddressAutoFilled(true);
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
  if (invoice) return <div className="space-y-5"><PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title="Invoice completed" description="The transaction and stock update were saved together."/><Panel title={invoice.invoiceNumber} description={`Total ${formatMoney(invoice.total)} · Due ${formatMoney(invoice.dueAmount)}`}><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground" href={`/${isSale ? "sales" : "purchases"}/${invoice.id}`}>Open printable invoice</Link><Button variant="outline" icon={<Plus size={15}/>} className="sm:w-auto" onClick={() => { setInvoice(null); setLines([]); setPaidAmount("0"); setAdditionalCost("0"); setAllowDue(false); setContactId(""); setContactPhone(""); setContactName(""); setContactAddress(""); setAddressAutoFilled(false); setDiscountType(""); setDiscountValue("0"); setPaymentMethodId(""); }}>Create another</Button><p className="flex items-center gap-1.5 self-center text-xs text-muted-foreground"><Key>F2</Key> then start scanning the next customer</p></div></Panel></div>;
  const unitOptions = (line: Line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return [];
    return [{ id: product.baseUnitId, name: product.baseUnit.name, symbol: product.baseUnit.symbol, conversion: "1" }, ...product.units.flatMap((u) => u.unit ? [{ ...u.unit, conversion: u.conversionToBase }] : [])];
  };
  return <div className="space-y-6">
    <PageHeader eyebrow={isSale ? "Sales / POS" : "Purchasing"} title={title} description={isSale ? "Search or scan a product, add items and complete the sale." : "Choose a supplier, record received stock and payment."} action={<div className="hidden flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs text-muted-foreground lg:flex"><span className="flex items-center gap-1.5"><Key>F2</Key>search</span><span className="flex items-center gap-1.5"><Key>F4</Key>customer</span><span className="flex items-center gap-1.5"><Key>F8</Key>allow due</span><span className="flex items-center gap-1.5"><Key>F9</Key>complete</span></div>}/>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <Panel title="Items" description="Scan a barcode or type a name — the arrow keys browse the matches." className="min-w-0" action={<span className="inline-flex items-center gap-2 rounded-full bg-primary-soft/70 px-3 py-1.5 text-xs font-semibold text-teal-strong"><span>{lines.length} {lines.length === 1 ? "item" : "items"}</span><span aria-hidden="true" className="size-1 rounded-full bg-current opacity-50" />{formatMoney(subtotal)}</span>}>
        <div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"/><input ref={searchRef} aria-label="Search or scan a product" autoComplete="off" role="combobox" aria-expanded={Boolean(query.trim())} aria-controls="product-matches" value={query} onChange={(e) => { setQuery(e.target.value); setSearchResults([]); setOutOfStock(""); }} onKeyDown={searchKeyDown} className={`${inputClass} h-12 pl-10 pr-10 text-[15px]`} placeholder="Scan barcode or search product (F2)"/>{query && <button type="button" onClick={() => { setQuery(""); setSearchResults([]); keepSearchFocused(); }} aria-label="Clear product search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={15}/></button>}
          {query.trim() && <div id="product-matches" role="listbox" className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{results.map((product, index) => { const stock = Number(product.stockOnHand); return <button type="button" role="option" aria-selected={index === cursor} key={product.id} onMouseEnter={() => setCursor(index)} onClick={() => addProduct(product)} className={`flex w-full min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-0 ${index === cursor ? "bg-teal-soft" : "hover:bg-muted"}`}><span className="min-w-0"><span className="block truncate font-medium">{product.name}<span className="ml-2 text-xs text-muted-foreground">{product.sku}</span></span><span className={`mt-0.5 block text-xs ${stock <= 0 ? "font-semibold text-danger" : "text-muted-foreground"}`}>{trimDecimalZeros(product.stockOnHand)} {product.baseUnit.symbol} in stock{stock <= 0 ? " · out of stock" : ""}</span></span><span className="flex max-w-[46%] shrink-0 flex-col items-end text-right"><span className="max-w-full break-words font-semibold tabular-nums [overflow-wrap:anywhere]">{formatMoney(isSale ? product.sellingPrice : product.purchasePrice)}</span><span className="text-xs font-normal text-muted-foreground">/ {product.baseUnit.symbol}</span></span></button>; })}{results.length === 0 && <p className="p-4 text-sm text-muted-foreground">No products found — press Enter to search the full catalogue again.</p>}{results.length > 1 && <p className="sticky bottom-0 flex items-center gap-1.5 bg-card px-4 py-2 text-[11px] text-muted-foreground"><Key>↑</Key><Key>↓</Key> browse · <Key>Enter</Key> add · <Key>Esc</Key> clear</p>}</div>}
        </div>
        {outOfStock && <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"><span><strong>{outOfStock}</strong> is out of stock. Receive a purchase before selling it.</span>{canPurchase && <Link href="/purchases" className="font-semibold underline">Create a purchase</Link>}<button type="button" onClick={() => setOutOfStock("")} className="ml-auto rounded-md p-1 hover:bg-danger/10" aria-label="Dismiss stock warning"><X size={14} /></button></div>}
        <div className="mt-4">{lines.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nothing added yet. Scan a barcode, or press <Key>F2</Key> and start typing.</div> : <div className="overflow-hidden rounded-xl border border-border/70">
          <div className="hidden bg-muted/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_96px_160px_128px_36px] sm:gap-3"><span>Product</span><span>Unit</span><span>Quantity</span><span className="text-right">Price / unit</span><span className="sr-only">Remove</span></div>
          <div className="divide-y divide-border/70">{lines.map((line, index) => { const product = products.find((item) => item.id === line.productId); const units = unitOptions(line); const selectedUnit = units.find((unit) => unit.id === line.unitId); const wholeQuantity = usesWholeQuantity(selectedUnit?.name ?? "", selectedUnit?.symbol ?? ""); const lineTotal = centsToMoney(moneyProductCents(line.price || "0", line.quantity || "0")); return <div key={`${line.productId}-${index}`} className="p-3 transition-colors hover:bg-primary-soft/10 sm:p-3.5">
            <div className="grid grid-cols-2 items-end gap-x-2 gap-y-3 sm:grid-cols-[minmax(0,1fr)_96px_160px_128px_36px] sm:items-center sm:gap-3">
              <div className="col-span-2 min-w-0 sm:col-span-1">{product ? <p className="truncate text-sm font-semibold">{product.name}<span className="ml-2 text-xs font-normal text-muted-foreground">{product.sku}</span></p> : <select required aria-label="Product" value={line.productId} onChange={(e) => { const item = products.find((x) => x.id === e.target.value); if (item) addProduct(item); }} className={selectClass}><option value="">Choose product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}{product && <p className="break-words text-xs tabular-nums text-muted-foreground [overflow-wrap:anywhere]">Line total {formatMoney(lineTotal)}<span className="sm:hidden"> · {trimDecimalZeros(product.stockOnHand)} in stock</span></p>}</div>
              {product && <label className="block min-w-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">Unit</span><select aria-label="Unit" value={line.unitId} onChange={(e) => { const nextUnit = units.find((unit) => unit.id === e.target.value); const oldUnit = units.find((unit) => unit.id === line.unitId); const convertedPrice = nextUnit && oldUnit ? convertUnitDecimal(line.price, oldUnit.conversion, nextUnit.conversion) : line.price; updateLine(index, { unitId: e.target.value, price: trimDecimalZeros(convertedPrice) }); }} className={selectClass}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
              <div className="min-w-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">Quantity</span><div className="flex items-center gap-1">
                <button type="button" onClick={() => stepQuantity(index, -1)} aria-label={`Reduce ${line.productId} quantity`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"><Minus size={13}/></button>
                <input ref={(node) => { qtyRefs.current[index] = node; }} aria-label="Quantity" required type="number" inputMode={wholeQuantity ? "numeric" : "decimal"} min={wholeQuantity ? "1" : "0.01"} step={wholeQuantity ? "1" : "0.01"} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} onKeyDown={(e) => quantityKeyDown(e, index)} className={`${inputClass} min-w-0 flex-1 px-1 text-center`}/><span className="w-9 shrink-0 text-xs text-muted-foreground sm:hidden">{selectedUnit?.symbol}</span>
                <button type="button" onClick={() => stepQuantity(index, 1)} aria-label={`Increase ${line.productId} quantity`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"><Plus size={13}/></button>
              </div></div>
              <label className="block min-w-0"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">{isSale ? "Price / unit" : "Unit cost"}</span><input aria-label={isSale ? "Configured unit price" : "Unit cost"} required readOnly={isSale} type="number" inputMode="decimal" min="0" step="0.01" value={line.price} onChange={(e) => updateLine(index, { price: e.target.value })} className={`${inputClass} text-right`} placeholder={isSale ? "Price" : "Cost"}/></label>
              <button type="button" onClick={() => removeLine(index)} aria-label="Remove line" className="justify-self-end rounded-[10px] border border-danger/15 bg-danger/10 p-2 text-danger transition-colors hover:bg-danger/20"><X size={15}/></button>
            </div>
            {!isSale && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <input aria-label="Selling price per stock unit" required type="number" inputMode="decimal" min="0.01" step="0.01" value={line.sellingPrice} onChange={(e) => updateLine(index, { sellingPrice: e.target.value })} className={inputClass} placeholder="Selling price / stock unit"/>
              {line.trackBatch && <input required aria-label="Batch number" value={line.batchNumber} onChange={(e) => updateLine(index, { batchNumber: e.target.value })} className={inputClass} placeholder="Batch number"/>}
              {line.trackExpiry && <DateField required ariaLabel="Expiry date" value={line.expiresAt} onChange={(v) => updateLine(index, { expiresAt: v })} placeholder="Pick a date"/>}
              <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/60 px-3 py-2 text-xs lg:col-span-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={line.trackBatch} disabled={Boolean(product?.tracksBatch)} onChange={(e) => updateLine(index, { trackBatch: e.target.checked, batchNumber: e.target.checked ? line.batchNumber : "" })} className="accent-primary"/>Track batches</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={line.trackExpiry} disabled={Boolean(product?.tracksExpiry)} onChange={(e) => updateLine(index, { trackExpiry: e.target.checked, expiresAt: e.target.checked ? line.expiresAt : "" })} className="accent-primary"/>Track expiry</label>
                <span className="text-muted-foreground">Once enabled, tracking stays on for this product.</span>
              </div>
            </div>}
          </div>; })}</div>
        </div>}</div>
      </Panel>

      <Panel className="min-w-0" title={isSale ? "Customer" : "Supplier"} description={isSale ? "A phone number that matches an existing customer selects them." : "Search an existing supplier, or enter details below."}>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input ref={contactRef} aria-label={`Search existing ${isSale ? "customers" : "suppliers"}`} autoComplete="off" value={contactSearch} onFocus={() => setContactSearchOpen(true)} onBlur={() => window.setTimeout(() => setContactSearchOpen(false), 120)} onChange={(event) => { const value = event.target.value; if (contactId) clearContact(); setContactSearch(value); setContactSearchOpen(true); }} className={`${inputClass} pl-9`} placeholder={`Search ${isSale ? "customer" : "supplier"} (F4)`}/>{contactSearchOpen && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">{contactResults.map((contact) => <button type="button" key={contact.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseContact(contact)} className="block w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted"><span className="block text-sm font-medium">{contact.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{[contact.phoneE164, contact.email].filter(Boolean).join(" · ") || "No phone or email"}</span></button>)}{contactResults.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching {isSale ? "customers" : "suppliers"} found.</p>}</div>}</div>
          <input name="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} placeholder={`${isSale ? "Customer" : "Supplier"} name — blank is a walk-in sale`}/>
        </div>
        {selectedContact && <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm"><span>Selected: <strong>{selectedContact.name}</strong> — details below are theirs, edit only for this invoice.</span><button type="button" onClick={clearContact} className="ml-3 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear selected contact"><X size={15}/></button></div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><PhoneInput name="contactPhone" countryCode={countryCode} value={contactPhone} onChange={updateContactPhone} placeholder="Phone (optional)"/><input name="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" inputMode="email" className={inputClass} placeholder="Email (optional)"/><AddressInput name="contactAddress" value={contactAddress} onChange={(value) => { setAddressAutoFilled(false); setContactAddress(value); }} countryCode={countryCode} placeholder="Search address or type manually" suggestions={!addressAutoFilled} className="sm:col-span-2"/></div>
        {!isSale && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Supplier invoice number (optional)</span><input name="supplierInvoiceNumber" maxLength={100} className={inputClass} placeholder="Number printed on supplier bill"/></label>
          <label className="block"><span className="mb-1.5 block text-xs font-medium">Additional landed cost</span><input name="additionalCost" type="number" inputMode="decimal" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} className={inputClass} placeholder="0"/></label>
        </div>}
      </Panel>

      <Panel className="min-w-0" title="Charge" description="Review totals, discounts and payment before completing.">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-[18px] border border-primary/15 bg-primary-soft/55 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-strong">Total to collect</p>
                <p className="mt-1.5 max-w-full break-words text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-tight tracking-[-0.04em] tabular-nums text-teal-strong [overflow-wrap:anywhere]">{formatMoney(total)}</p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
                <span className={`max-w-full break-words rounded-full px-2.5 py-1 text-[11px] font-semibold [overflow-wrap:anywhere] ${fullyPaid ? "bg-success/10 text-success" : "bg-amber-soft text-amber-strong"}`}>{fullyPaid ? "Paid in full" : `Due ${formatMoney(duePreview)}`}</span>
                {discountCents > BigInt(0) && <p className="text-xs font-semibold tabular-nums text-amber-strong">− {formatMoney(centsToMoney(discountCents))} discount included</p>}
              </div>
            </div>

            <div className={`grid gap-3 ${canDiscount && methods.length > 0 ? "2xl:grid-cols-3" : canDiscount || methods.length > 0 ? "2xl:grid-cols-2" : "2xl:grid-cols-1"}`}>
              {canDiscount && <div className="rounded-xl border border-border/70 bg-background p-3.5"><p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Discount</p><div role="radiogroup" aria-label="Discount type" className="grid grid-cols-3 gap-1.5"><Chip group="discountPick" label="None" checked={discountType === ""} onPick={() => setDiscountType("")}/><Chip group="discountPick" label="%" checked={discountType === "PERCENTAGE"} onPick={() => setDiscountType("PERCENTAGE")}/><Chip group="discountPick" label="Amount" checked={discountType === "FIXED_AMOUNT"} onPick={() => setDiscountType("FIXED_AMOUNT")}/></div><div className="relative mt-2.5"><input aria-label="Discount value" disabled={!discountType} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" max={discountType === "PERCENTAGE" ? 100 : undefined} className={`${inputClass} ${discountType === "PERCENTAGE" ? "pr-7" : ""}`} placeholder="0"/>{discountType === "PERCENTAGE" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}</div><p className="mt-2 text-[11px] leading-4 text-muted-foreground">{discountType ? (discountType === "PERCENTAGE" ? "Enter 1–100 to reduce the subtotal by a percentage." : "Enter the fixed amount to reduce the subtotal.") : "Choose % or Amount to apply a discount."}</p></div>}

              <div className="rounded-xl border border-border/70 bg-background p-3.5"><label className="block"><span className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Paid</span><input aria-label="Amount paid" value={amountPaid} onChange={(e) => setPaidAmount(e.target.value)} readOnly={!allowDue} type="number" inputMode="decimal" min="0" max={total} step="0.01" className={allowDue ? `${inputClass} h-12 text-right text-lg font-semibold tabular-nums` : "h-12 w-full rounded-[12px] border border-dashed border-border bg-muted/70 px-3 text-right text-lg font-semibold tabular-nums text-muted-foreground outline-none"}/></label><label className={`mt-2.5 flex items-center justify-between gap-3 rounded-lg p-2.5 text-xs ${allowDue ? "bg-amber-soft/65 text-amber-strong" : "bg-muted/60 text-muted-foreground"}`}><span className="flex items-center gap-2"><input type="checkbox" checked={allowDue} onChange={(e) => toggleAllowDue(e.target.checked)} className="accent-primary"/>Allow due</span><Key>F8</Key></label><p aria-live="polite" className="mt-2 text-xs leading-4 text-muted-foreground">{allowDue ? <>Enter <strong>0</strong> to leave the full amount due.</> : <>Paid in full — enable <strong>Allow due</strong> to take a part payment.</>}</p>{methods.length === 0 && <p className="mt-2 rounded-lg bg-amber-soft/60 px-2.5 py-2 text-[11px] leading-4 text-amber-strong">No enabled payment methods. Leave this sale or purchase due, or enable a method in Settings to record payment.</p>}</div>

              {methods.length > 0 && <div className="rounded-xl border border-border/70 bg-background p-3.5"><p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Payment method</p><div role="radiogroup" aria-label="Payment method" className="grid gap-1.5 sm:grid-cols-2">{methods.map((method) => <Chip key={method.id} group="methodPick" label={method.name} checked={paymentMethodId === method.id} disabled={Number(amountPaid) <= 0} onPick={() => setPaymentMethodId(method.id)}/>)}</div>{Number(amountPaid) <= 0 ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Add an amount before choosing how it was paid.</p> : <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Select the method used for this payment.</p>}</div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Payment reference</span><input name="paymentReference" className={inputClass} placeholder="Reference (optional)"/></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Invoice note</span><textarea name="notes" className={`${inputClass} min-h-16 py-2`} placeholder="Invoice note (optional)"/></label>
            </div>

            <div className="rounded-[12px] border border-border/70 bg-muted/35 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-muted-foreground"><Key>F9</Key> or <Key>Ctrl</Key>+<Key>Enter</Key> completes the invoice · <Key>Tab</Key> moves through the form</p>
                <Button type="submit" className="w-full sm:w-auto sm:min-w-56" disabled={busy || !lines.length}>{busy ? "Saving invoice…" : `Complete ${isSale ? "sale" : "purchase"}`}</Button>
              </div>
            </div>
          </div>
        </Panel>

      <Panel className="min-w-0" title={`Recent ${isSale ? "sales" : "purchases"}`} description={`Latest ${recent.length.toLocaleString()} invoices — click a row to preview it without leaving the counter.`}>
        {recent.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-border bg-background px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">No invoices yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Completed invoices will appear here for quick review.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 xl:hidden">
              {recent.map((item) => {
                const due = Number(item.dueAmount);
                const party = item.customer?.name ?? item.supplier?.name ?? "Walk-in customer";
                return (
                  <button key={item.id} type="button" onClick={() => setDetailId(item.id)} className="w-full rounded-[16px] border border-border/70 bg-background p-4 text-left transition-[background-color,border-color,box-shadow] hover:border-primary/25 hover:bg-primary-soft/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25">
                    <span className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold tabular-nums text-foreground">{item.invoiceNumber}</span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{formatDateTime(item.soldAt ?? item.purchasedAt ?? "")}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${invoiceStatusTones[item.status] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{item.status.replaceAll("_", " ")}</span>
                    </span>
                    <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-border/70 pt-3">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-foreground">{party}</span>
                        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{isSale ? "Customer" : "Supplier"}</span>
                      </span>
                      <span className="min-w-0 max-w-[58%] text-right">
                        <span className="block break-words text-sm font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatMoney(item.total)}</span>
                        <span className={`mt-1 block break-words text-[11px] font-medium tabular-nums [overflow-wrap:anywhere] ${due > 0 ? "text-amber-strong" : "text-muted-foreground"}`}>{due > 0 ? `Due ${formatMoney(item.dueAmount)}` : "Fully paid"}</span>
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold text-primary">View details <ArrowRight size={13} /></span>
                  </button>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-[16px] border border-border/70 bg-background xl:block">
              <div className="overflow-x-auto">
                <table className="stock-table recent-table w-full min-w-[980px] table-fixed text-left text-sm">
                  <thead className="bg-muted/45 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="w-[17%] px-2.5 py-2 font-semibold">Invoice</th>
                      <th className="w-[14%] px-2.5 py-2 font-semibold">Status</th>
                      <th className="w-[18%] px-2.5 py-2 font-semibold">{isSale ? "Customer" : "Supplier"}</th>
                      <th className="w-[16%] px-2.5 py-2 font-semibold">Date</th>
                      <th className="w-[13%] px-2.5 py-2 text-right font-semibold">Total</th>
                      <th className="w-[12%] px-2.5 py-2 text-right font-semibold">Due</th>
                      <th className="w-[10%] px-2.5 py-2 text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {recent.map((item) => {
                      const due = Number(item.dueAmount);
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-primary-soft/20">
                          <td className="px-2.5 py-2">
                            <button type="button" onClick={() => setDetailId(item.id)} className="block max-w-full truncate text-left text-sm font-semibold tabular-nums text-foreground hover:text-primary">{item.invoiceNumber}</button>
                          </td>
                          <td className="px-2.5 py-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${invoiceStatusTones[item.status] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{item.status.replaceAll("_", " ")}</span></td>
                          <td className="px-2.5 py-2"><span className="block truncate text-sm font-medium text-foreground" title={item.customer?.name ?? item.supplier?.name ?? undefined}>{item.customer?.name ?? item.supplier?.name ?? "Walk-in customer"}</span></td>
                          <td className="px-2.5 py-2 text-xs tabular-nums text-muted-foreground">{formatDateTime(item.soldAt ?? item.purchasedAt ?? "")}</td>
                          <td className="px-2.5 py-2 text-right"><span className="ml-auto block max-w-full break-words text-sm font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatMoney(item.total)}</span></td>
                          <td className="px-2.5 py-2 text-right"><span className={`ml-auto block max-w-full break-words text-sm font-semibold tabular-nums [overflow-wrap:anywhere] ${due > 0 ? "text-amber-strong" : "text-muted-foreground"}`}>{due > 0 ? formatMoney(item.dueAmount) : "—"}</span></td>
                          <td className="px-2.5 py-2 text-right"><button type="button" aria-label={`Open ${item.invoiceNumber} details`} onClick={() => setDetailId(item.id)} className="group ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-primary bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25">Details<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Panel>
    </form>

    {detailId && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 print:hidden sm:items-center sm:p-6 hide-scrollbar">
      <button type="button" aria-label="Close invoice details" className="fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={() => setDetailId(null)}/>
      <div role="dialog" aria-modal="true" aria-labelledby="recent-invoice-title" className="relative my-auto flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[16px] border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-card px-5 py-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{isSale ? "Sale invoice" : "Purchase invoice"}</p><h2 id="recent-invoice-title" className="mt-1 truncate text-[21px] font-semibold leading-tight tabular-nums text-foreground">{detail?.invoiceNumber ?? "Loading…"}</h2></div>
          <div className="flex shrink-0 items-center gap-2">{detail && <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusTones[detail.status] ?? "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current"/>{detail.status.replaceAll("_", " ")}</span>}<button type="button" onClick={() => setDetailId(null)} aria-label="Close invoice details" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X size={18}/></button></div>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {detailError && <div className="space-y-4"><ErrorMessage>{detailError}</ErrorMessage><Button variant="outline" className="h-10 px-4" onClick={() => setDetailNonce((count) => count + 1)}>Try again</Button></div>}
          {!detailError && !detail && <div className="space-y-3" aria-busy="true" aria-label="Loading invoice">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/60"/>)}</div>}
          {!detailError && detail && <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0 rounded-[16px] border border-border/70 bg-background p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{isSale ? "Customer" : "Supplier"}</p>
                <p className="mt-1.5 break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{detail.customer?.name ?? detail.supplier?.name ?? "Walk-in customer"}</p>
                {detail.customer?.phoneE164 && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{detail.customer.phoneE164}</p>}
              </div>
              <div className="min-w-0 rounded-[16px] border border-border/70 bg-background p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice details</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{formatDateTime(detail.soldAt ?? detail.purchasedAt ?? "")}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">Recorded by {detail.createdBy?.fullName ?? "Staff"}</p>
                {detail.supplierInvoiceNumber && <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Supplier bill {detail.supplierInvoiceNumber}</p>}
              </div>
            </div>

            <section className="mt-5"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">Items</h3><span className="text-[11px] font-medium tabular-nums text-muted-foreground">{detail.items.length} {detail.items.length === 1 ? "line" : "lines"}</span></div><div className="space-y-2">
              {detail.items.map((line, index) => <article key={line.id} className="rounded-[13px] border border-border/70 bg-background/80 px-3 py-2.5">
                <div className="flex min-w-0 items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2.5"><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary-soft text-[10px] font-bold tabular-nums text-teal-strong">{index + 1}</span><span className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground" title={line.productName}>{line.productName}</span></span><span className="max-w-[45%] shrink-0 break-words text-right text-sm font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatMoney(line.lineTotal)}</span></div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-border/80 pt-2 text-[11px] leading-4 text-muted-foreground"><span className="min-w-0 truncate">{line.skuSnapshot}{line.batchNumber ? ` · Batch ${line.batchNumber}` : ""}</span><span className="max-w-full break-words text-right tabular-nums [overflow-wrap:anywhere]">{trimDecimalZeros(line.quantity)} {line.unit?.symbol ?? ""} × {formatMoney(line.unitPrice ?? line.unitCost ?? 0)}</span></div>
              </article>)}
            </div>

            </section>

            <div className="space-y-2 border-b border-border py-3.5 text-[15px] leading-5">
              <div className="flex items-baseline justify-between gap-3"><span className="font-semibold text-muted-foreground">Subtotal</span><span className="min-w-0 max-w-[60%] break-words text-right font-bold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatMoney(detail.subtotal)}</span></div>
              {detail.discountAmount > 0 && <div className="flex items-baseline justify-between gap-3"><span className="text-muted-foreground">Discount</span><span className="min-w-0 max-w-[60%] break-words text-right font-semibold tabular-nums text-amber-strong [overflow-wrap:anywhere]">− {formatMoney(detail.discountAmount)}</span></div>}
              {!isSale && (detail.additionalCost ?? 0) > 0 && <div className="flex items-baseline justify-between gap-3"><span className="text-muted-foreground">Additional cost</span><span className="min-w-0 max-w-[60%] break-words text-right font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">{formatMoney(detail.additionalCost ?? 0)}</span></div>}
              {detail.payments.length ? detail.payments.map((payment) => <div key={payment.id} className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate text-xs text-muted-foreground" title={`${payment.method?.name ?? "Payment"} · ${formatDateTime(payment.paidAt)}${payment.reference ? ` · ${payment.reference}` : ""} · ${payment.collectedBy?.fullName ?? ""}`}>Paid · {payment.method?.name ?? "Payment"}{payment.reference ? ` · ${payment.reference}` : ""}</span><span className="max-w-[55%] shrink-0 break-words text-right text-[13px] font-semibold tabular-nums text-teal-strong [overflow-wrap:anywhere]">{formatMoney(payment.amount)}</span></div>) : <div className="flex items-baseline justify-between gap-3"><span className="text-muted-foreground">Paid</span><span className="text-[13px] font-semibold tabular-nums text-muted-foreground">No payment yet</span></div>}
            </div>

            <div className="mt-4 rounded-[18px] border border-primary/15 bg-primary-soft/55 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-strong">{isSale ? "Total collected" : "Total paid"}</p><p className="min-w-0 max-w-full break-words text-[clamp(1.5rem,6vw,1.625rem)] font-semibold leading-tight tabular-nums text-teal-strong [overflow-wrap:anywhere]">{formatMoney(detail.total)}</p></div>
              <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-primary/15 pt-2.5">
                <p className="min-w-0 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{detail.payments.length} payment{detail.payments.length === 1 ? "" : "s"} · paid {formatMoney(detail.paidAmount)}</p>
                <span className={`inline-flex max-w-full items-center break-words rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums [overflow-wrap:anywhere] ${Number(detail.dueAmount) > 0 ? "bg-amber-soft text-amber-strong" : "bg-teal-soft text-teal-strong"}`}>{Number(detail.dueAmount) > 0 ? `Due ${formatMoney(detail.dueAmount)}` : "Fully paid"}</span>
              </div>
            </div>

            {detail.returns && detail.returns.length > 0 && <p className="mt-3.5 text-xs leading-5 text-muted-foreground">{detail.returns.length.toLocaleString()} return{detail.returns.length === 1 ? "" : "s"} recorded — {detail.returns.map((entry) => `${entry.returnNumber} (${formatMoney(entry.total)})`).join(", ")}.</p>}
            {detail.notes && <p className="mt-3.5 rounded-[12px] border border-border/70 bg-background p-4 text-[13px] leading-5 text-foreground"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Note</span>{detail.notes}</p>}
          </>}
        </div>

        <div className="flex flex-col gap-3 border-t border-line bg-muted/35 px-5 py-4"><p className="text-xs leading-5 text-muted-foreground">Closing this preview keeps the basket you were building · <Key>Esc</Key></p><div className="flex items-center gap-2"><Button variant="outline" className="h-10 flex-1" onClick={() => setDetailId(null)}>Close</Button><Link className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90" href={`/${isSale ? "sales" : "purchases"}/${detailId}`}>Printable invoice<ArrowRight size={14}/></Link></div></div>
      </div>
    </div>}
  </div>;
}




