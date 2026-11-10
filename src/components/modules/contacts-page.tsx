"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { createClientRequestId } from "@/lib/client-request-id";
import { notifySuccessToast } from "@/lib/client-notifications";
import { Button } from "@/components/ui/button";
import { ErrorMessage, inputClass, Notice, PageHeader, Panel } from "@/components/ui/page";
import { useHasPermission, useShopCountryCode, useShopFormat } from "@/components/app/shop-context";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { RotateCcw, X } from "lucide-react";

type Contact = { id: string; name: string; phoneE164: string | null; email: string | null; address: string | null; isActive: boolean };
type PaymentMethod = { id: string; name: string; isEnabled?: boolean };
type HistoryRecord = { id: string; invoiceNumber: string; total: string; paidAmount: string; dueAmount: string; soldAt?: string; purchasedAt?: string; payments: { amount: string; paidAt: string; method: { name: string } }[] };
type Detail = { customer?: Contact & { sales: HistoryRecord[] }; supplier?: Contact & { purchases: HistoryRecord[] }; balanceDue: string };
type PaymentReceipt = { kind: "sale" | "purchase"; shopName: string; shopAddress: string | null; shopPhone: string | null; currencyCode: string; contactName: string; contactPhone: string | null; invoiceNumber: string; amount: string; balanceDue: string; methodName: string; reference: string | null; recordedBy: string; paidAt: string };
export function ContactsPage({ mode, initialSearch = "" }: { mode: "customer" | "supplier"; initialSearch?: string }) {
  const isCustomer = mode === "customer"; const { formatMoney, formatDate, formatDateTime } = useShopFormat(); const countryCode = useShopCountryCode();
  const canCollect = useHasPermission("COLLECT_PAYMENTS");
  const endpoint = isCustomer ? "/api/customers" : "/api/suppliers";
  const [items, setItems] = useState<Contact[]>([]); const [selected, setSelected] = useState<Detail | null>(null); const [historyLoading, setHistoryLoading] = useState(false); const [historyError, setHistoryError] = useState(""); const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null); const [receiptPrint, setReceiptPrint] = useState(false);
  const [search, setSearch] = useState(initialSearch); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [newPhone, setNewPhone] = useState(""); const [editPhone, setEditPhone] = useState(""); const [newAddress, setNewAddress] = useState(""); const [editAddress, setEditAddress] = useState("");
  const [editAddressAutoFilled, setEditAddressAutoFilled] = useState(false);
  const pendingPaymentRequests = useRef(new Map<string, string>());
  function showSuccess(message: string) { setNotice(message); notifySuccessToast(message); }
  const load = useCallback(async () => { try { const q = new URLSearchParams(); if (search) q.set("q", search); q.set("includeInactive", "true"); const payload = await apiRequest<Record<string, Contact[]>>(`${endpoint}?${q}`); setItems(payload[isCustomer ? "customers" : "suppliers"] ?? []); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Contacts could not be loaded."); } }, [endpoint, isCustomer, search]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!canCollect) return;
    const loadMethods = () => {
      void apiRequest<{ paymentMethods: PaymentMethod[] }>("/api/payment-methods")
        .then((result) => setMethods(result.paymentMethods.filter((method) => method.isEnabled !== false)))
        .catch(() => {});
    };
    const timer = window.setTimeout(loadMethods, 0);
    window.addEventListener("stockpilot:payment-methods-changed", loadMethods);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("stockpilot:payment-methods-changed", loadMethods);
    };
  }, [canCollect]);
  useEffect(() => { const reset = () => { document.getElementById("receipt-print-page-size")?.remove(); setReceiptPrint(false); }; window.addEventListener("afterprint", reset); return () => window.removeEventListener("afterprint", reset); }, []);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const formElement = event.currentTarget; const form = new FormData(formElement); try { await apiRequest(endpoint, { method: "POST", body: jsonBody({ name: form.get("name"), phone: newPhone || null, email: form.get("email") || null, address: newAddress || null, notes: form.get("notes") || null }) }); showSuccess(isCustomer ? "Customer created." : "Supplier created."); formElement.reset(); setNewPhone(""); setNewAddress(""); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Contact could not be saved."); } finally { setBusy(false); } }
  async function open(id: string) {
    const contact = items.find((item) => item.id === id);
    setHistoryError("");
    setHistoryLoading(true);
    if (contact) {
      setSelected({
        balanceDue: "0.00",
        ...(isCustomer
          ? { customer: { ...contact, sales: [] } }
          : { supplier: { ...contact, purchases: [] } }),
      });
    }
    try {
      setSelected(await apiRequest<Detail>(`${endpoint}/${id}`));
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Contact history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }
  async function toggle(item: Contact) { setError(""); try { await apiRequest(`${endpoint}/${item.id}`, { method: "PATCH", body: jsonBody({ isActive: !item.isActive }) }); showSuccess(isCustomer ? (item.isActive ? "Customer archived." : "Customer restored.") : (item.isActive ? "Supplier archived." : "Supplier restored.")); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Contact could not be updated."); } }
  async function saveEdit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!editing) return; setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { await apiRequest(`${endpoint}/${editing.id}`, { method: "PATCH", body: jsonBody({ name: form.get("name"), phone: editPhone || null, email: form.get("email") || null, address: form.get("address") || null, notes: form.get("notes") || null }) }); showSuccess(isCustomer ? "Customer updated." : "Supplier updated."); setEditing(null); setEditPhone(""); setEditAddress(""); setEditAddressAutoFilled(false); await load(); if (selected) await open(editing.id); } catch (e) { setError(e instanceof Error ? e.message : "Contact could not be updated."); } finally { setBusy(false); } }
  const detail = selected && (selected.customer ?? selected.supplier);
  const history = selected?.customer?.sales ?? selected?.supplier?.purchases ?? [];
  function closeEdit() { setEditing(null); setEditPhone(""); setEditAddress(""); setEditAddressAutoFilled(false); }
  async function collect(invoiceId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const payload = { invoiceType: isCustomer ? "sale" as const : "purchase" as const, invoiceId, amount: form.get("amount"), paymentMethodId: form.get("method"), reference: form.get("reference") || null };
    const fingerprint = JSON.stringify(payload);
    let clientRequestId = pendingPaymentRequests.current.get(fingerprint);
    if (!clientRequestId) {
      clientRequestId = createClientRequestId();
      pendingPaymentRequests.current.set(fingerprint, clientRequestId);
    }
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ receipt?: PaymentReceipt }>("/api/payments/collect", { method: "POST", body: jsonBody({ ...payload, clientRequestId }) });
      pendingPaymentRequests.current.delete(fingerprint);
      showSuccess(isCustomer ? "Customer payment recorded." : "Supplier payment recorded.");
      if (result.receipt) { setReceipt(result.receipt); setSelected(null); }
      else await open(detail?.id ?? "");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be recorded."); }
    finally { setBusy(false); }
  }
  function printReceipt() {
    setReceiptPrint(true);
    window.setTimeout(() => {
      document.getElementById("receipt-print-page-size")?.remove();
      const pageStyle = document.createElement("style");
      pageStyle.id = "receipt-print-page-size";
      pageStyle.textContent = "@media print { @page { size: 80mm auto; margin: 0; } }";
      document.head.append(pageStyle);
      // The tag lives in the shared document, so an 80 mm size left behind would re-size the next A4 print too.
      window.addEventListener("afterprint", () => document.getElementById("receipt-print-page-size")?.remove(), { once: true });
      window.print();
    }, 120);
  }
  const receiptPartyLine = [receipt?.shopAddress, receipt?.shopPhone].filter(Boolean).join(" · ");
  return <div className={`space-y-6 ${receiptPrint ? "payment-receipt-mode" : ""}`}><PageHeader eyebrow="People & account balances" title={isCustomer ? "Customers" : "Suppliers"} description={isCustomer ? "Customer contacts, purchase history and outstanding balances." : "Supplier directory, purchase history and outstanding balances."}/>{notice && <Notice>{notice}</Notice>}{error && <ErrorMessage>{error}</ErrorMessage>}
    {receipt && <div className="receipt-mode">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground print:hidden">{receipt.kind === "sale" ? "Payment recorded — receipt" : "Payment recorded — proof of payment"}</p>
      <div className="print-document mx-auto max-w-sm rounded-2xl border border-border bg-card p-5 text-sm">
        <header className="text-center">
          <p className="receipt-shop-name text-base font-semibold">{receipt.shopName}</p>
          {receiptPartyLine && <p className="mt-1 text-xs text-muted-foreground">{receiptPartyLine}</p>}
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em]">{receipt.kind === "sale" ? "Payment received" : "Payment made"}</p>
        </header>
        <section className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground">{receipt.kind === "sale" ? "Received from" : "Paid to"}</p><p className="font-medium">{receipt.contactName || "—"}</p>{receipt.contactPhone && <p className="text-muted-foreground">{receipt.contactPhone}</p>}</div>
          <div><p className="text-muted-foreground">Invoice</p><p className="font-medium">{receipt.invoiceNumber}</p></div>
          <div><p className="text-muted-foreground">Date</p><p>{formatDateTime(receipt.paidAt)}</p></div>
          <div><p className="text-muted-foreground">Method</p><p>{receipt.methodName}</p></div>
        </section>
        <table className="w-full text-left">
          <tbody>
            <tr><td className="py-1 text-muted-foreground">This payment</td><td className="py-1 text-right font-semibold">{formatMoney(receipt.amount)}</td></tr>
            <tr><td className="py-1 text-muted-foreground">Balance due after</td><td className="py-1 text-right font-semibold">{formatMoney(receipt.balanceDue)}</td></tr>
          </tbody>
        </table>
        <section className="ml-auto text-xs">
          {receipt.reference && <p>Reference: {receipt.reference}</p>}
          <p>Recorded by: {receipt.recordedBy}</p>
        </section>
        <footer className="mt-2 border-t border-border pt-2 text-center text-[11px] text-muted-foreground">{receipt.kind === "sale" ? "Thank you for your business." : "Please keep this slip as proof of payment."}</footer>
      </div>
      <div className="mt-3 flex justify-center gap-2 print:hidden">
        <Button variant="outline" onClick={printReceipt}>Print 80 mm receipt</Button>
        <Button variant="ghost" onClick={() => setReceipt(null)}>Close</Button>
      </div>
    </div>}
    <Panel title={`Add ${mode}`} description="Phone numbers are checked against the shop country setting. Choose an address suggestion or type the full address yourself."><form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input name="name" required minLength={1} maxLength={160} className={inputClass} placeholder="Full name / business"/><PhoneInput name="phone" countryCode={countryCode} value={newPhone} onChange={setNewPhone} placeholder="Phone (optional)"/><input name="email" type="email" className={inputClass} placeholder="Email (optional)"/><AddressInput value={newAddress} onChange={setNewAddress} countryCode={countryCode} placeholder="Search address or type manually"/><Button type="submit" disabled={busy}>{busy ? "Saving…" : `Add ${mode}`}</Button><textarea name="notes" className={`${inputClass} sm:col-span-2 lg:col-span-5`} placeholder="Notes (optional)"/></form></Panel>
    <Panel title={`${isCustomer ? "Customer" : "Supplier"} directory`} description={`${items.length.toLocaleString()} ${isCustomer ? "customers" : "suppliers"} with invoice history and outstanding balances.`} action={<input aria-label="Search contacts" className={`${inputClass} max-w-xs`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email or address"/>}><div className="overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="stock-table w-full min-w-[880px] text-left text-sm"><thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Name</th><th className="px-3 py-2.5 font-semibold">Phone</th><th className="px-3 py-2.5 font-semibold">Email</th><th className="px-3 py-2.5 font-semibold">Address</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-border/70">{items.map((item) => <tr key={item.id} className="align-middle transition-colors hover:bg-teal-soft/40"><td className="px-3 py-3 font-semibold text-foreground">{item.name}</td><td className="px-3 py-3 tabular-nums">{item.phoneE164 ?? <span className="text-muted-foreground">—</span>}</td><td className="px-3 py-3 text-muted-foreground">{item.email ?? "—"}</td><td className="max-w-52 truncate px-3 py-3 text-muted-foreground" title={item.address ?? undefined}>{item.address ?? "—"}</td><td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current" />{item.isActive ? "Active" : "Archived"}</span></td><td className="px-3 py-3"><div className="flex justify-end gap-2"><Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => void open(item.id)}>History</Button><Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => { setError(""); setEditing(item); setEditPhone(item.phoneE164 ?? ""); setEditAddress(item.address ?? ""); setEditAddressAutoFilled(Boolean(item.address)); }}>Edit</Button><Button className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs shadow-sm transition-[filter] hover:brightness-95" style={{ backgroundColor: item.isActive ? "#475569" : "var(--success)", color: "#fff" }} onClick={() => void toggle(item)}>{item.isActive ? "Archive" : <><RotateCcw size={13} strokeWidth={2.25} />Restore</>}</Button></div></td></tr>)}{items.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No contacts found.</td></tr>}</tbody></table></div></div></Panel>
    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit(); }}><section role="dialog" aria-modal="true" aria-labelledby="contact-editor-title" className="hide-scrollbar max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-border bg-card p-5 shadow-2xl sm:rounded-[28px] sm:p-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{isCustomer ? "Customers" : "Suppliers"}</p><h2 id="contact-editor-title" className="mt-1 text-xl font-semibold">Edit {mode}</h2><p className="mt-1 text-sm text-muted-foreground">Phone numbers are validated using the shop's selected country.</p></div><button type="button" onClick={closeEdit} aria-label="Close form" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={17} /></button></div><form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-medium">Full name / business</span><input name="name" required maxLength={160} className={inputClass} defaultValue={editing.name} placeholder="Name"/></label><div className="block"><span className="mb-1.5 block text-xs font-medium">Phone <span className="text-muted-foreground">optional</span></span><PhoneInput name="phone" countryCode={countryCode} value={editPhone} onChange={setEditPhone} placeholder="Phone"/></div><label className="block"><span className="mb-1.5 block text-xs font-medium">Email <span className="text-muted-foreground">optional</span></span><input name="email" type="email" className={inputClass} defaultValue={editing.email ?? ""} placeholder="Email"/></label><div className="block"><span className="mb-1.5 block text-xs font-medium">Address <span className="text-muted-foreground">optional</span></span><AddressInput value={editAddress} onChange={(value) => { setEditAddressAutoFilled(false); setEditAddress(value); }} countryCode={countryCode} placeholder="Search address or type manually" suggestions={!editAddressAutoFilled}/></div><label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-medium">Notes <span className="text-muted-foreground">optional</span></span><textarea name="notes" className={inputClass} placeholder="Notes (optional)"/></label>{error && <div className="sm:col-span-2"><ErrorMessage>{error}</ErrorMessage></div>}<div className="flex justify-end gap-2 border-t border-border pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : `Save ${mode}`}</Button></div></form></section></div>}
    {detail && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="contact-history-title" className="hide-scrollbar max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-border bg-card p-5 shadow-2xl sm:rounded-[28px] sm:p-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{isCustomer ? "Customers" : "Suppliers"}</p><h2 id="contact-history-title" className="mt-1 text-xl font-semibold">{detail.name}</h2><p className="mt-1 text-sm text-muted-foreground">Outstanding balance: {formatMoney(selected?.balanceDue ?? "0.00")}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close history" className="grid size-9 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"><X size={17} /></button></div><div className="space-y-3">{history.map((record) => <article key={record.id} className="rounded-xl border border-border/70 p-4 transition-colors hover:bg-teal-soft/30"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold text-foreground">{record.invoiceNumber}</p><p className="text-xs tabular-nums text-muted-foreground">{formatDate(record.soldAt ?? record.purchasedAt ?? "")}</p></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">{[[`Total`, formatMoney(record.total), "font-medium text-foreground"], [`Paid`, formatMoney(record.paidAmount), "font-medium text-success"], [`Due`, formatMoney(record.dueAmount), Number(record.dueAmount) > 0 ? "font-semibold text-amber-strong" : "font-medium text-muted-foreground"]].map(([label, value, valueClass]) => <div key={label} className="rounded-lg bg-muted/40 px-3 py-2"><p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className={`mt-1 tabular-nums ${valueClass}`}>{value}</p></div>)}</div>{record.payments?.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Payments: {record.payments.map((payment) => `${payment.method.name} ${formatMoney(payment.amount)} (${formatDate(payment.paidAt)})`).join(" · ")}</div>}{canCollect && Number(record.dueAmount) > 0 && <form onSubmit={(event) => void collect(record.id, event)} className="mt-3 grid gap-2 sm:grid-cols-4"><input name="amount" type="number" required min="0.01" max={record.dueAmount} step="0.01" className={inputClass} placeholder="Amount to collect"/><select name="method" required className={inputClass}>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select><input name="reference" className={inputClass} placeholder="Reference (optional)"/><Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record payment"}</Button></form>}</article>)}{historyLoading ? <div className="space-y-3" aria-busy="true" aria-label="Loading transaction history">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div> : historyError ? <ErrorMessage>{historyError}</ErrorMessage> : history.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No transaction history.</p>}</div></section></div>}
  </div>;
}



