"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, jsonBody } from "@/lib/client-api";
import { useHasPermission, useShopFormat } from "@/components/app/shop-context";
import { Button } from "@/components/ui/button";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { localDateKey } from "@/lib/date-time";

type Expense = { id: string; title: string; category: string | null; amount: string; expenseDate: string; notes: string | null; method: { name: string } | null; createdBy: { fullName: string } };
type Method = { id: string; name: string };
export function ExpensesPage() {
  const { currency, timezone, formatMoney, formatDate } = useShopFormat(); const canManage = useHasPermission("MANAGE_EXPENSES"); const canView = useHasPermission("VIEW_REPORTS");
  const [expenses, setExpenses] = useState<Expense[]>([]); const [methods, setMethods] = useState<Method[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [voidModalOpen, setVoidModalOpen] = useState(false); const [expenseToVoid, setExpenseToVoid] = useState<Expense | null>(null); const [voidReason, setVoidReason] = useState("");
  const pendingExpenseRequests = useRef(new Map<string, string>());
  const load = useCallback(async () => { if (!canView) return; try { const result = await apiRequest<{ expenses: Expense[] }>("/api/expenses"); setExpenses(result.expenses); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Expenses could not be loaded."); } }, [canView]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (!canManage) return; const timer = window.setTimeout(() => { void apiRequest<{ paymentMethods: Method[] }>("/api/payment-methods").then((result) => { setMethods(result.paymentMethods); }).catch(() => {}); }, 0); return () => window.clearTimeout(timer); }, [canManage]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawMethodId = form.get("methodId");
    const payload = { title: form.get("title"), category: form.get("category") || null, amount: form.get("amount"), expenseDate: form.get("expenseDate"), methodId: rawMethodId === "" ? null : rawMethodId, notes: form.get("notes") || null };
    const fingerprint = JSON.stringify(payload);
    let clientRequestId = pendingExpenseRequests.current.get(fingerprint);
    if (!clientRequestId) {
      clientRequestId = crypto.randomUUID();
      pendingExpenseRequests.current.set(fingerprint, clientRequestId);
    }
    setBusy(true); setError("");
    try {
      await apiRequest("/api/expenses", { method: "POST", body: jsonBody({ ...payload, clientRequestId }) });
      pendingExpenseRequests.current.delete(fingerprint);
      formElement.reset(); setNotice("Expense recorded."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Expense could not be recorded."); }
    finally { setBusy(false); }
  }
  function openVoidModal(expense: Expense) { setExpenseToVoid(expense); setVoidReason(""); setVoidModalOpen(true); }
  async function confirmVoidExpense() {
    if (!expenseToVoid || !voidReason.trim()) return;
    if (voidReason.trim().length < 3) { setError("Reason must be at least 3 characters."); return; }
    setBusy(true); setError("");
    try {
      await apiRequest(`/api/expenses/${expenseToVoid.id}/void`, { method: "POST", body: jsonBody({ reason: voidReason.trim() }) });
      // Clear modal state first
      setVoidModalOpen(false);
      setExpenseToVoid(null);
      setVoidReason("");
      setNotice("Expense voided and retained in audit history.");
      await load();
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Expense could not be voided.");
      // Keep modal open on error so user can see the message
    }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageHeader eyebrow="Operating costs" title="Expenses" description="Record shop expenses for profit reporting, with an audited void history."/>{error && <ErrorMessage>{error}</ErrorMessage>}{notice && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
    {canManage && <Panel title="Record expense" description="Expense dates and payment methods are saved to the shop ledger."><form onSubmit={create} className="grid grid-cols-2 gap-3 lg:grid-cols-6"><input name="title" required className={`${inputClass} col-span-2 lg:col-span-1`} placeholder="Expense description"/><input name="category" className={inputClass} placeholder="Category"/><input name="amount" required type="number" inputMode="decimal" min="0.01" step="0.01" className={inputClass} placeholder={`Amount (${currency})`}/><input name="expenseDate" required type="date" defaultValue={localDateKey(new Date(), timezone)} className={inputClass}/><select name="methodId" className={selectClass}><option value="">Payment method (optional)</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select><Button disabled={busy} className="col-span-2 lg:col-span-1">{busy ? "Saving…" : "Save expense"}</Button><textarea name="notes" className={`${inputClass} col-span-2 lg:col-span-6`} placeholder="Notes (optional)"/></form></Panel>}
    {canView && <Panel title="Recent expenses" description={`${expenses.length.toLocaleString()} entries in this period · voided entries are excluded from profit but stay in the audit log.`}><div className="overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm sm:min-w-[880px]"><thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Date</th><th className="px-3 py-2.5 font-semibold">Expense</th><th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Category</th><th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Payment</th><th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Recorded by</th><th className="px-3 py-2.5 text-right font-semibold">Amount</th><th className="px-3 py-2.5"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-border/70">{expenses.map((expense) => <tr key={expense.id} className="align-middle transition-colors hover:bg-teal-soft/40"><td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">{formatDate(expense.expenseDate)}</td><td className="px-3 py-3 font-semibold text-foreground">{expense.title}{expense.notes && <span className="mt-0.5 block max-w-40 truncate text-xs font-normal text-muted-foreground sm:max-w-64" title={expense.notes}>{expense.notes}</span>}</td><td className="hidden px-3 py-3 sm:table-cell">{expense.category ? <span className="rounded-md bg-teal-soft px-1.5 py-0.5 text-[11px] font-medium text-teal-strong">{expense.category}</span> : <span className="text-muted-foreground">—</span>}</td><td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">{expense.method?.name ?? "—"}</td><td className="hidden px-3 py-3 sm:table-cell">{expense.createdBy.fullName}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{formatMoney(expense.amount)}</td><td className="px-3 py-3">{canManage && <div className="flex justify-end"><Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => openVoidModal(expense)}>Void</Button></div>}</td></tr>)}{expenses.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">No expenses in this period.</td></tr>}</tbody></table></div></div></Panel>}
    {voidModalOpen && expenseToVoid && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"><div className="my-auto w-full max-w-md rounded-xl bg-background p-5 shadow-lg sm:p-6"><h3 className="text-lg font-semibold">Void Expense</h3><p className="mt-2 text-sm text-muted-foreground">Are you sure you want to void &ldquo;<strong>{expenseToVoid.title}</strong>&rdquo; for {formatMoney(expenseToVoid.amount)}?</p><label className="mt-4 block text-xs text-muted-foreground">Reason (required, min 3 characters)<textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className={`${inputClass} mt-1`} rows={3} placeholder="Explain why this expense is being voided..." autoFocus/></label><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => { setVoidModalOpen(false); setExpenseToVoid(null); setVoidReason(""); }} disabled={busy} className="w-full sm:w-auto">Cancel</Button><Button onClick={confirmVoidExpense} disabled={busy || voidReason.trim().length < 3} className="w-full sm:w-auto">{busy ? "Voiding…" : "Confirm Void"}</Button></div></div></div>}
  </div>;
}
