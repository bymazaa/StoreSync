"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer, Search } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { addDateKeyDays, localDateKey } from "@/lib/date-time";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useShopFormat } from "@/components/app/shop-context";

type ReportType = "sales" | "purchases" | "product-sales" | "profit-loss" | "stock" | "due" | "expenses";
type Row = Record<string, unknown>;
type Payload = Record<string, unknown> & { type: string; currencyCode?: string; shop?: { name: string; address: string | null; phone: string | null }; summary?: Record<string, string | number>; sales?: Row[]; purchases?: Row[]; products?: Row[]; expenses?: Row[]; customers?: Row[]; suppliers?: Row[]; lowStock?: Row[]; expiringBatches?: Row[] };
const options: { value: ReportType; label: string }[] = [{ value: "sales", label: "Sales" }, { value: "purchases", label: "Purchases" }, { value: "product-sales", label: "Product sales" }, { value: "profit-loss", label: "Profit & loss" }, { value: "stock", label: "Stock valuation" }, { value: "due", label: "Customer & supplier due" }, { value: "expenses", label: "Expenses" }];
type Preset = "3" | "7" | "15" | "30" | "all" | "custom";
const presets: { value: Preset; label: string }[] = [{ value: "3", label: "Last 3 days" }, { value: "7", label: "Last 7 days" }, { value: "15", label: "Last 15 days" }, { value: "30", label: "Last 30 days" }, { value: "all", label: "All time" }, { value: "custom", label: "Custom range" }];

const printable = (value: unknown): string => { if (value == null) return "—"; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value); return ""; };
const isInternalField = (key: string) => key.toLowerCase() === "id" || /(?:Id|ID|_id)$/.test(key) || key.toLowerCase().includes("requestid");
const columnLabel = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const moneyKeys = new Set(["total", "subtotal", "paidAmount", "dueAmount", "discountAmount", "revenue", "grossProfit", "netProfit", "expenses", "costOfGoods", "purchasePrice", "sellingPrice", "amount", "valuation", "customerDue", "supplierDue", "due0to30", "due31to60", "dueOver60"]);
const quantityKeys = new Set(["quantity", "baseQuantity", "soldQuantity", "stockOnHand", "lowStockThreshold", "count", "rowCount", "invoiceCount", "invoices", "oldestDueDays"]);
// Row bookkeeping never belongs on a statement a shop hands to someone else, and invoiceNumbers is an
// unbounded list that would stretch one cell across the page.
const hiddenColumns = ["createdBy", "createdAt", "updatedAt", "voidedAt", "customer", "supplier", "payments", "items", "returns", "product", "category", "baseUnit", "invoiceNumbers"];
const isNumericColumn = (key: string) => moneyKeys.has(key) || quantityKeys.has(key);
const columnRank = (key: string) => { const lower = key.toLowerCase(); if (lower.endsWith("date") || lower.endsWith("at")) return 0; return isNumericColumn(key) ? 2 : 1; };
// Statements read like bank ledgers: date first, narration next, amounts last and right-aligned.
const visibleColumns = (rows: Row[]) => rows.length ? Object.keys(rows[0]).filter((key) => !isInternalField(key) && !hiddenColumns.includes(key) && typeof rows[0][key] !== "object").slice(0, 10).sort((a, b) => columnRank(a) - columnRank(b)) : [];
const serialShare = 4.5;
// Cutive Mono is a wide face, so every column gets a fixed share of the page and long values wrap inside it.
const statementWidths = (columns: string[]) => {
  const numeric = columns.filter(isNumericColumn).length;
  const text = columns.length - numeric;
  const unit = numeric + text === 0 ? 0 : (100 - serialShare) / (numeric + text * 1.8);
  return [`${serialShare}%`, ...columns.map((key) => `${(isNumericColumn(key) ? unit : unit * 1.8).toFixed(2)}%`)];
};

export function ReportsPage() {
  const { formatMoney, formatNumber, formatDateTime, timezone } = useShopFormat();
  const today = localDateKey(new Date(), timezone);
  const [type, setType] = useState<ReportType>("sales");
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState(() => addDateKeyDays(today, -30));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Payload | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const query = new URLSearchParams({ type }); if (from) query.set("from", from); if (to) query.set("to", to); setData(await apiRequest<Payload>(`/api/reports?${query}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Report could not be loaded."); }
    finally { setBusy(false); }
  }, [type, from, to]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  function applyPreset(value: Preset) {
    setPreset(value);
    if (value === "all") { setFrom(""); setTo(""); return; }
    if (value === "custom") return;
    const end = localDateKey(new Date(), timezone);
    setTo(end); setFrom(addDateKeyDays(end, -Number(value)));
  }
  const rows = data ? (data.sales ?? data.purchases ?? data.products ?? data.expenses ?? (type === "due" ? [...(data.customers ?? []), ...(data.suppliers ?? [])] : data.lowStock ?? [])) : [];
  const columns = visibleColumns(rows);
  const reportLabel = options.find((item) => item.value === type)?.label ?? "Report";
  const period = !from && !to ? "All time" : `${from || "Start"} → ${to || today}`;
  const generatedAt = data ? formatDateTime(new Date()) : "";
  const contact = [data?.shop?.address, data?.shop?.phone].filter(Boolean).join(" · ");
  const shopName = data?.shop?.name ?? "StockPilot";
  const fileStem = `${type}-statement-${!from && !to ? "all-time" : `${from || "start"}-to-${to || today}`}`;

  // jsPDF cannot shape Bengali conjuncts, so the PDF comes from the browser's own print pipeline
  // instead — the document title becomes the suggested filename.
  function printStatement() {
    const previousTitle = document.title;
    const restore = () => { document.title = previousTitle; window.removeEventListener("afterprint", restore); };
    document.title = fileStem;
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <div className="report-print space-y-6 print:space-y-0">
      <div className="print:hidden"><PageHeader eyebrow="Business insights" title="Reports" description="Filter the store's records, then save any report as a bank-style statement PDF."/></div>
      <div className="hidden print:block">
        <div className="report-letterhead">
          <div className="report-letterhead-shop">
            <p className="report-shop-name">{shopName}</p>
            {contact ? <p className="report-contact">{contact}</p> : null}
          </div>
          <div className="report-meta">
            <div><span className="report-meta-label">Statement</span><span>{reportLabel}</span></div>
            <div><span className="report-meta-label">Period</span><span className="tabular-nums">{period}</span></div>
            <div><span className="report-meta-label">Entries</span><span className="tabular-nums">{rows.length.toLocaleString()}</span></div>
            <div><span className="report-meta-label">Generated</span><span className="tabular-nums">{generatedAt}</span></div>
            <div><span className="report-meta-label">Currency</span><span>{data?.currencyCode ?? "—"}</span></div>
          </div>
        </div>
        <div className="report-title-band">
          <p className="report-title">{reportLabel} statement</p>
          <p className="report-period">{from || "Start"} → {to || today}</p>
        </div>
      </div>

      {error && <div className="print:hidden"><ErrorMessage>{error}</ErrorMessage></div>}
      <Panel className="print:hidden" title="Report filters" description="Date ranges follow the shop timezone." action={<div className="flex flex-wrap gap-2"><Button variant="outline" icon={<Printer size={15}/>} onClick={printStatement} disabled={!data || busy}>Statement PDF</Button></div>}>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.2fr)_minmax(150px,1fr)_minmax(140px,0.85fr)_minmax(140px,0.85fr)_auto]">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Report type<select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)} className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Period<select aria-label="Period preset" value={preset} onChange={(e) => applyPreset(e.target.value as Preset)} className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}>{presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className={`${inputClass} mt-1.5`}/></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className={`${inputClass} mt-1.5`}/></label>
          <Button variant="outline" icon={<Search size={15}/>} onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</Button>
        </div>
        {type === "due" && <p className="mt-3 text-xs text-muted-foreground">Aging buckets are counted from each unpaid invoice date.</p>}
      </Panel>
      {data?.summary && <section className="report-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.summary).slice(0, 8).map(([key, value]) => {
        const money = moneyKeys.has(key);
        const numeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
        const shown = money ? formatMoney(String(value)) : numeric ? formatNumber(Number(value)) : printable(value);
        return (
          <div key={key} className={`rounded-2xl border bg-card p-4 shadow-card ${money ? "border-primary/25" : "border-border"}`}>
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{columnLabel(key)}{money ? <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] text-teal-strong print:hidden">Amount</span> : null}</p>
            <p className={`mt-3 text-[26px] leading-none font-semibold tracking-tight tabular-nums ${money ? "text-teal-strong" : "text-foreground"}`}>{shown}</p>
          </div>
        );
      })}</section>}
      {type === "stock" && data && <><Panel className="report-section" title="Low stock" description={`${(data.lowStock ?? []).length} products at or below their reorder threshold.`}><ReportTable rows={data.lowStock ?? []}/></Panel><Panel className="report-section" title="Expiring batches" description={`${(data.expiringBatches ?? []).length} batches expiring within 30 days.`}><ReportTable rows={data.expiringBatches ?? []}/></Panel></>}
      {type === "due" && data && <><Panel className="report-section" title="Customers with due balances" description={`${(data.customers ?? []).length} customers · grouped by how long each invoice has been unpaid.`}><ReportTable rows={data.customers ?? []}/></Panel><Panel className="report-section" title="Suppliers with due balances" description={`${(data.suppliers ?? []).length} suppliers with unpaid invoices.`}><ReportTable rows={data.suppliers ?? []}/></Panel></>}
      {type !== "stock" && type !== "due" && <Panel className="report-section" title={`${reportLabel} statement`} description={`${rows.length.toLocaleString()} entries in ${period}.`}><ReportTable rows={rows} columns={columns}/></Panel>}
      <div className="report-footnote hidden print:flex"><span>StockPilot · {reportLabel} statement · {generatedAt}</span><span>Data from this shop’s own database — verify before external use.</span></div>
    </div>
  );
}

function ReportTable({ rows, columns: provided }: { rows: Row[]; columns?: string[] }) {
  const { formatMoney, formatDate, formatDateTime } = useShopFormat();
  const columns = provided ?? visibleColumns(rows);
  const widths = statementWidths(columns);
  // Only amount columns close with a statement total; quantities mix units and counters mix meanings.
  const totals = columns.map((key) => {
    if (!moneyKeys.has(key)) return null;
    let sum = 0; let counted = 0;
    for (const row of rows) { const value = Number(row[key]); if (Number.isFinite(value)) { sum += value; counted += 1; } }
    return counted ? sum : null;
  });
  const labelIndex = columns.findIndex((key) => !isNumericColumn(key));
  const showTotal = rows.length > 1 && totals.some((value) => value !== null);
  const cell = (key: string, value: unknown) => {
    if (moneyKeys.has(key)) return formatMoney(printable(value));
    const raw = printable(value);
    if (raw === "" || raw === "—") return raw;
    const lower = key.toLowerCase();
    // *Date is a calendar day, *At a moment — both must render on the shop's clock, not raw UTC.
    if (lower.endsWith("date")) return formatDate(raw);
    if (lower.endsWith("at")) return formatDateTime(raw);
    return raw;
  };
  return <div className="report-table-frame overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed text-left text-sm"><colgroup>{widths.map((width, index) => <col key={index} style={{ width }}/>)}</colgroup><thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-2 py-2.5 text-right font-semibold">#</th>{columns.map((key) => <th key={key} className={isNumericColumn(key) ? "px-3 py-2.5 text-right font-semibold" : "px-3 py-2.5 font-semibold"}>{columnLabel(key)}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{rows.map((row, index) => <tr key={printable(row.id) || index} className="transition-colors hover:bg-teal-soft/50"><td className="report-serial px-2 py-2.5 text-right tabular-nums text-muted-foreground">{index + 1}</td>{columns.map((key, cellIndex) => <td key={key} className={`${isNumericColumn(key) ? "text-right" : ""} ${cellIndex === 0 ? "font-medium text-foreground" : "text-foreground/85"} px-3 py-2.5 truncate tabular-nums`}>{cell(key, row[key])}</td>)}</tr>)}{rows.length === 0 && <tr><td className="report-empty px-3 py-10 text-center text-sm text-muted-foreground" colSpan={Math.max(columns.length + 1, 2)}>No entries in this period.</td></tr>}</tbody>{showTotal && <tfoot><tr className="border-t-2 border-primary/60 bg-muted/20"><td className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labelIndex === -1 ? "Total" : ""}</td>{columns.map((key, index) => <td key={key} className={`${isNumericColumn(key) ? "text-right" : ""} px-3 py-2.5 font-semibold tabular-nums ${index === labelIndex ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" : totals[index] === null ? "text-muted-foreground" : "text-teal-strong"}`}>{index === labelIndex ? "Total" : totals[index] === null ? "" : formatMoney(String(totals[index]))}</td>)}</tr></tfoot>}</table></div></div>;
}
