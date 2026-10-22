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
  useEffect(() => { if (!canManage) return; const timer = window.setTimeout(() => { void apiRequest<{ paymentMethods: Method[] }>("/api/payment-methods").then((result) => { console.log("Payment methods loaded:", result.paymentMethods); setMethods(result.paymentMethods); }).catch(() => {}); }, 0); return () => window.clearTimeout(timer); }, [canManage]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawMethodId = form.get("methodId");
    console.log("Form methodId raw value:", rawMethodId, "type:", typeof rawMethodId);
    console.log("Available methods:", methods);
    const payload = { title: form.get("title"), category: form.get("category") || null, amount: form.get("amount"), expenseDate: form.get("expenseDate"), methodId: rawMethodId === "" ? null : rawMethodId, notes: form.get("notes") || null };
    console.log("Payload being sent:", payload);
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
    {canManage && <Panel title="Record expense" description="Expense dates and payment methods are saved to the shop ledger."><form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><input name="title" required className={inputClass} placeholder="Expense description"/><input name="category" className={inputClass} placeholder="Category"/><input name="amount" required type="number" min="0.01" step="0.01" className={inputClass} placeholder={`Amount (${currency})`}/><input name="expenseDate" required type="date" defaultValue={localDateKey(new Date(), timezone)} className={inputClass}/><select name="methodId" className={selectClass}><option value="">Payment method (optional)</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select><Button disabled={busy}>{busy ? "Saving…" : "Save expense"}</Button><textarea name="notes" className={`${inputClass} sm:col-span-2 lg:col-span-6`} placeholder="Notes (optional)"/></form></Panel>}
    {canView && <Panel title="Recent expenses" description="Voided entries are excluded from profit calculations but remain in the audit log."><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Expense</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Recorded by</th><th className="px-3 py-3 text-right">Amount</th><th/></tr></thead><tbody className="divide-y divide-border">{expenses.map((expense) => <tr key={expense.id}><td className="px-3 py-3">{formatDate(expense.expenseDate)}</td><td className="px-3 py-3 font-medium">{expense.title}</td><td className="px-3 py-3">{expense.category ?? "—"}</td><td className="px-3 py-3">{expense.method?.name ?? "—"}</td><td className="px-3 py-3">{expense.createdBy.fullName}</td><td className="px-3 py-3 text-right">{formatMoney(expense.amount)}</td><td className="px-3 py-3">{canManage && <Button variant="ghost" onClick={() => openVoidModal(expense)}>Void</Button>}</td></tr>)}{expenses.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No expenses in this period.</td></tr>}</tbody></table></div></Panel>}
    {voidModalOpen && expenseToVoid && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg"><h3 className="text-lg font-semibold">Void Expense</h3><p className="mt-2 text-sm text-muted-foreground">Are you sure you want to void "<strong>{expenseToVoid.title}</strong>" for {formatMoney(expenseToVoid.amount)}?</p><label className="mt-4 block text-xs text-muted-foreground">Reason (required, min 3 characters)<textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className={`${inputClass} mt-1`} rows={3} placeholder="Explain why this expense is being voided..." autoFocus/></label><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => { setVoidModalOpen(false); setExpenseToVoid(null); setVoidReason(""); }} disabled={busy}>Cancel</Button><Button onClick={confirmVoidExpense} disabled={busy || voidReason.trim().length < 3}>{busy ? "Voiding…" : "Confirm Void"}</Button></div></div></div>}
  </div>;
}
