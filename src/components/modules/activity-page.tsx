"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, RefreshCw, Search } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass, TableEmpty } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useShopFormat, useShopPermissions } from "@/components/app/shop-context";

type Log = { id: string; action: string; entityType: string; entityId: string; actorId: string; actorName: string; detail: string; ipAddress: string; createdAt: string };
type Payload = { logs: Log[]; total: number; page: number; pageSize: number; actors: { id: string; name: string }[] };

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
  "auth.password_changed": "Password changed",
  "category.created": "Category created",
  "category.updated": "Category updated",
  "customer.created": "Customer added",
  "customer.updated": "Customer details changed",
  "expense.created": "Expense recorded",
  "expense.voided": "Expense voided",
  "inventory.adjusted": "Stock adjusted",
  "payment_method.created": "Payment method added",
  "payment_method.updated": "Payment method changed",
  "product.created": "Product created",
  "product.updated": "Product changed",
  "purchase.cancelled": "Purchase cancelled",
  "purchase.completed": "Purchase completed",
  "purchase.payment_paid": "Supplier payment recorded",
  "purchase.returned": "Supplier return processed",
  "role_permissions.updated": "Role permissions changed",
  "sale.cancelled": "Sale cancelled",
  "sale.completed": "Sale completed",
  "sale.payment_collected": "Customer payment recorded",
  "sale.returned": "Customer return processed",
  "settings.updated": "Shop settings changed",
  "setup.owner_created": "Shop setup finished",
  "supplier.created": "Supplier added",
  "supplier.updated": "Supplier details changed",
  "unit.created": "Unit created",
  "unit.updated": "Unit changed",
  "user.created": "Staff account created",
  "user.updated": "Staff account changed",
};

const entityLabels: Record<string, string> = {
  auth: "Sign in", category: "Category", customer: "Customer", expense: "Expense", inventory: "Stock",
  payment_method: "Payment method", product: "Product", purchase: "Purchase", role_permissions: "Roles & permissions",
  sale: "Sale", settings: "Shop settings", setup: "Setup", supplier: "Supplier", unit: "Unit", user: "Staff account",
};

const actionList = Object.keys(actionLabels).sort();
const entityList = Object.keys(entityLabels).sort((a, b) => entityLabels[a].localeCompare(entityLabels[b]));

const actionLabel = (action: string) => actionLabels[action] ?? action.replaceAll("_", " ");
const entityLabel = (entityType: string) => entityLabels[entityType] ?? entityType.replaceAll("_", " ");

function toneOf(action: string) {
  if (action.endsWith(".created")) return "bg-teal-soft text-teal-strong";
  if (action.endsWith(".cancelled") || action.endsWith(".voided")) return "bg-danger/10 text-danger";
  if (action.includes("return") || action.endsWith(".adjusted")) return "bg-amber-soft text-amber-strong";
  return "bg-blue-soft text-blue-strong";
}

export function ActivityPage() {
  const { formatDateTime } = useShopFormat();
  const permissions = useShopPermissions();
  const canView = permissions.includes("MANAGE_SETTINGS") || permissions.includes("MANAGE_USERS");
  const [logs, setLogs] = useState<Log[]>([]);
  const [actors, setActors] = useState<Payload["actors"]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (actorId) params.set("actorId", actorId);
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    if (committedSearch) params.set("q", committedSearch);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const payload = await apiRequest<Payload>(`/api/audit-logs?${params.toString()}`);
      setLogs(payload.logs ?? []);
      setActors(payload.actors ?? []);
      setTotal(payload.total ?? 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the activity log.");
    } finally {
      setBusy(false);
    }
  }, [action, actorId, committedSearch, entityType, from, page, to]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  if (!canView) return <PageHeader eyebrow="Records" title="Activity log" description="Only owners and managers can see who changed what." />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Records" title="Activity log" description="Every create, update and reversal in this shop — who did it, when, and what changed." />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Panel title="Find an entry" description="Filters use the shop timezone. Leave the date fields empty to search all history.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_minmax(200px,1fr)_1fr_1fr_auto]">
          <select aria-label="Staff member" value={actorId} onChange={(event) => { setActorId(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">Anyone</option>
            {actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
          <select aria-label="Area" value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">Every area</option>
            {entityList.map((value) => <option key={value} value={value}>{entityLabels[value]}</option>)}
          </select>
          <select aria-label="Action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">Every action</option>
            {actionList.map((value) => <option key={value} value={value}>{actionLabels[value]}</option>)}
          </select>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className={`${inputClass} mt-1.5 font-normal normal-case tracking-normal`} /></label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className={`${inputClass} mt-1.5 font-normal normal-case tracking-normal`} /></label>
          <Button variant="outline" icon={<Search size={15} />} onClick={() => { setCommittedSearch(search.trim()); setPage(1); }} disabled={busy}>Search</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input aria-label="Search invoice, reason or record ID" className={`${inputClass} max-w-sm`} placeholder="Invoice number, reason or record ID" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setCommittedSearch(search.trim()); setPage(1); } }} />
          {committedSearch && <Button variant="ghost" className="h-9 text-xs" onClick={() => { setSearch(""); setCommittedSearch(""); setPage(1); }}>Clear “{committedSearch}”</Button>}
          <Button variant="outline" className="h-9 text-xs" icon={<RefreshCw size={14} className={busy ? "animate-spin" : undefined} />} onClick={() => void load()} disabled={busy}>Refresh</Button>
        </div>
      </Panel>
      <Panel title={`${total.toLocaleString()} entries`} description={total === 0 ? "Nothing matches these filters yet." : `Showing ${firstShown}–${lastShown}.`}>
        <div className="overflow-hidden rounded-xl border border-border/70">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">When</th><th className="px-3 py-2.5 font-semibold">Who</th><th className="px-3 py-2.5 font-semibold">Action</th><th className="px-3 py-2.5 font-semibold">Area / record</th><th className="px-3 py-2.5 font-semibold">What changed</th><th className="px-3 py-2.5 font-semibold">IP</th></tr></thead>
            <tbody className="divide-y divide-border/70">
              {logs.map((log) => (
                <tr key={log.id} className="align-top transition-colors hover:bg-teal-soft/40">
                  <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-3 font-semibold text-foreground">{log.actorName}</td>
                  <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneOf(log.action)}`}><span className="size-1.5 rounded-full bg-current" />{actionLabel(log.action)}</span></td>
                  <td className="px-3 py-3">{entityLabel(log.entityType)}{log.entityId && <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground" title={log.entityId}>#{log.entityId.slice(0, 8)}</span>}</td>
                  <td className="max-w-md px-3 py-3 text-xs leading-relaxed text-muted-foreground">{log.detail || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">{log.ipAddress || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && !busy && <tr><td colSpan={6}><TableEmpty>No activity matches these filters.</TableEmpty></td></tr>}
              {logs.length === 0 && busy && <tr><td colSpan={6}><div className="space-y-2 py-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-muted" />)}</div></td></tr>}
            </tbody>
          </table>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><History size={14} />Entries are written by the app itself and cannot be edited or deleted from the interface.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-3" icon={<ChevronLeft size={15} />} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={busy || page <= 1}>Previous</Button>
            <span className="text-xs tabular-nums text-muted-foreground">Page {page} of {pageCount}</span>
            <Button variant="outline" className="h-9 px-3" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={busy || page >= pageCount}>Next<ChevronRight size={15} /></Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
