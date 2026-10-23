"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Printer, Search } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useShopFormat } from "@/components/app/shop-context";

type ReportType = "sales" | "purchases" | "product-sales" | "profit-loss" | "stock" | "due" | "expenses";
type Row = Record<string, unknown>;
type Payload = Record<string, unknown> & { type: string; currencyCode?: string; shop?: { name: string; address: string | null; phone: string | null }; summary?: Record<string, string | number>; sales?: Row[]; purchases?: Row[]; products?: Row[]; expenses?: Row[]; customers?: Row[]; suppliers?: Row[]; lowStock?: Row[]; expiringBatches?: Row[] };
const options: { value: ReportType; label: string }[] = [{ value: "sales", label: "Sales" }, { value: "purchases", label: "Purchases" }, { value: "product-sales", label: "Product sales" }, { value: "profit-loss", label: "Profit & loss" }, { value: "stock", label: "Stock valuation" }, { value: "due", label: "Customer & supplier due" }, { value: "expenses", label: "Expenses" }];
const printable = (value: unknown): string => { if (value == null) return "—"; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value); return ""; };
const isInternalField = (key: string) => key.toLowerCase() === "id" || /(?:Id|ID|_id)$/.test(key) || key.toLowerCase().includes("requestid");
const columnLabel = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const moneyKeys = new Set(["total", "subtotal", "paidAmount", "dueAmount", "discountAmount", "revenue", "grossProfit", "netProfit", "expenses", "costOfGoods", "purchasePrice", "sellingPrice", "amount", "valuation", "customerDue", "supplierDue", "due0to30", "due31to60", "dueOver60"]);
const quantityKeys = new Set(["quantity", "baseQuantity", "soldQuantity", "stockOnHand", "lowStockThreshold", "count", "rowCount", "invoiceCount", "invoices", "oldestDueDays"]);
const hiddenColumns = ["createdBy", "customer", "supplier", "payments", "items", "returns", "product", "category", "baseUnit"];
const isNumericColumn = (key: string) => moneyKeys.has(key) || quantityKeys.has(key);
const visibleColumns = (rows: Row[]) => rows.length ? Object.keys(rows[0]).filter((key) => !isInternalField(key) && !hiddenColumns.includes(key) && typeof rows[0][key] !== "object").slice(0, 10) : [];

/** CSV and filenames must carry the shop's own clock: toISOString() would put every soldAt/createdAt line hours off for a Bengali shop. */
const zonedParts = (value: string, timeZone: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  // en-CA keeps the parts ISO-ordered with ASCII digits even when the shop locale is Bengali.
  return new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
};
const csvStampFor = (value: string, timeZone: string) => {
  const parts = zonedParts(value, timeZone);
  if (!parts) return printable(value);
  const part = (kind: string) => parts.find((item) => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
};
const csvDayFor = (value: string, timeZone: string) => csvStampFor(value, timeZone).slice(0, 10);
const shopDay = (timeZone: string) => csvDayFor(new Date().toISOString(), timeZone);
// SoldAt/createdAt are timestamps, expenseDate is a calendar day — both arrive as UTC ISO strings.
const csvValue = (key: string, value: unknown, stamp: (value: string) => string, day: (value: string) => string) => {
  if (value == null || value === "") return "";
  const lower = key.toLowerCase();
  if (lower.endsWith("date")) return day(String(value));
  if (lower.endsWith("at")) return stamp(String(value));
  return printable(value).replace("—", "");
};
const csvCell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

function buildCsv(tables: { name: string; rows: Row[] }[], meta: string[], stamp: (value: string) => string, day: (value: string) => string) {
  const lines = [`# ${meta.join(" · ")}`, ""];
  for (const table of tables) {
    const columns = visibleColumns(table.rows);
    if (columns.length === 0) continue;
    lines.push(`# ${table.name}`, columns.map((key) => csvCell(columnLabel(key))).join(","));
    for (const row of table.rows) lines.push(columns.map((key) => csvCell(csvValue(key, row[key], stamp, day))).join(","));
    lines.push("");
  }
  // Excel needs the BOM to read Bengali UTF-8 cells.
  return `﻿${lines.join("\r\n")}\r\n`;
}

function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage() {
  const { formatMoney, formatDateTime, timezone } = useShopFormat();
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState<Payload | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const query = new URLSearchParams({ type }); if (from) query.set("from", from); if (to) query.set("to", to); setData(await apiRequest<Payload>(`/api/reports?${query}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Report could not be loaded."); }
    finally { setBusy(false); }
  }, [type, from, to]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const rows = data ? (data.sales ?? data.purchases ?? data.products ?? data.expenses ?? (type === "due" ? [...(data.customers ?? []), ...(data.suppliers ?? [])] : data.lowStock ?? [])) : [];
  const columns = visibleColumns(rows);
  const reportLabel = options.find((item) => item.value === type)?.label ?? "Report";
  const period = `${from || "All time"} → ${to || "Today"}`;
  const generatedAt = data ? formatDateTime(new Date()) : "";
  const csvStamp = (value: string) => csvStampFor(value, timezone);
  const csvDay = (value: string) => csvDayFor(value, timezone);
  const contact = [data?.shop?.address, data?.shop?.phone].filter(Boolean).join(" · ");
  const shopName = data?.shop?.name ?? "StockPilot";
  const fileStem = `stockpilot-${type}-${shopDay(timezone)}`;
  const tables: { name: string; rows: Row[] }[] = data
    ? type === "stock"
      ? [{ name: "Low stock", rows: data.lowStock ?? [] }, { name: "Expiring batches", rows: data.expiringBatches ?? [] }]
      : type === "due"
        ? [{ name: "Customers with due", rows: data.customers ?? [] }, { name: "Suppliers with due", rows: data.suppliers ?? [] }]
        : [{ name: `${reportLabel} records`, rows }]
    : [];
  const dueCustomers = data?.customers ?? [];
  const dueSuppliers = data?.suppliers ?? [];
  // jsPDF cannot shape Bengali conjuncts, so the PDF comes from the browser's own print pipeline
  // instead — the document title becomes the suggested filename.
  function printReport() {
    const previousTitle = document.title;
    const restore = () => { document.title = previousTitle; window.removeEventListener("afterprint", restore); };
    document.title = fileStem;
    window.addEventListener("afterprint", restore);
    window.print();
  }
  function exportCsv() {
    if (!data) return;
    downloadFile(`${fileStem}.csv`, buildCsv(tables, [`${shopName} — ${reportLabel} report`, `Period: ${period}`, `Generated: ${csvStamp(new Date().toISOString())}`, `Currency: ${data.currencyCode ?? "—"}`], csvStamp, csvDay), "text/csv;charset=utf-8");
  }

  return (
    <div className="report-print space-y-6 print:space-y-0">
      <div className="print:hidden"><PageHeader eyebrow="Business insights" title="Reports" description="Filter store records, then print or save the report as a PDF."/></div>
      <div className="hidden print:block">
        <div className="report-letterhead">
          <div className="report-letterhead-shop">
            <p className="report-shop-name">{shopName}</p>
            {contact ? <p className="report-contact">{contact}</p> : null}
          </div>
          <div className="report-meta">
            <div><span className="report-meta-label">Report</span><span>{reportLabel}</span></div>
            <div><span className="report-meta-label">Period</span><span className="tabular-nums">{period}</span></div>
            <div><span className="report-meta-label">Generated</span><span className="tabular-nums">{generatedAt}</span></div>
            <div><span className="report-meta-label">Currency</span><span>{data?.currencyCode ?? "—"}</span></div>
          </div>
        </div>
        <div className="report-title-band">
          <p className="report-title">{reportLabel} report</p>
          <p className="report-period">{rows.length.toLocaleString()} records · {period}</p>
        </div>
      </div>

      {error && <div className="print:hidden"><ErrorMessage>{error}</ErrorMessage></div>}
      <Panel className="print:hidden" title="Report filters" description="Date ranges follow the shop timezone." action={<div className="flex flex-wrap gap-2"><Button variant="outline" icon={<FileDown size={15}/>} onClick={exportCsv} disabled={!data || busy}>Export CSV</Button><Button variant="outline" icon={<Printer size={15}/>} onClick={printReport} disabled={!data || busy}>Print / Save PDF</Button></div>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_1fr_1fr_auto]"><select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)} className={selectClass}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><label className="text-xs text-muted-foreground">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-xs text-muted-foreground">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`}/></label><Button variant="outline" icon={<Search size={15}/>} onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</Button></div>
        {type === "due" && <p className="mt-3 text-xs text-muted-foreground">Aging buckets are counted from each unpaid invoice date.</p>}
      </Panel>
      {data?.summary && <section className="report-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.summary).slice(0, 8).map(([key, value]) => <div key={key} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs capitalize text-muted-foreground">{columnLabel(key)}</p><p className="mt-2 text-xl font-semibold tabular-nums">{moneyKeys.has(key) ? formatMoney(String(value)) : value}</p></div>)}</section>}
      {type === "stock" && data && <><Panel className="report-section" title="Low stock" description="Products at or below their reorder threshold."><ReportTable rows={data.lowStock ?? []}/></Panel><Panel className="report-section" title="Expiring batches" description="Tracked stock due to expire within 30 days."><ReportTable rows={data.expiringBatches ?? []}/></Panel></>}
      {type === "due" && data && <><Panel className="report-section" title="Customers with due balances" description="Grouped by how long each invoice has been unpaid."><ReportTable rows={dueCustomers}/></Panel><Panel className="report-section" title="Suppliers with due balances"><ReportTable rows={dueSuppliers}/></Panel></>}
      {type !== "stock" && type !== "due" && <Panel className="report-section" title={`${reportLabel} records`} description={`${rows.length.toLocaleString()} rows returned.`}><ReportTable rows={rows} columns={columns}/></Panel>}
      <div className="report-footnote hidden print:flex"><span>StockPilot · {reportLabel} · {generatedAt}</span><span>Data from this shop’s own database — verify before external use.</span></div>
    </div>
  );
}

function ReportTable({ rows, columns: provided }: { rows: Row[]; columns?: string[] }) {
  const { formatMoney, formatDate, formatDateTime } = useShopFormat();
  const columns = provided ?? visibleColumns(rows);
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
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{columns.map((key) => <th key={key} className={isNumericColumn(key) ? "px-3 py-3 text-right" : "px-3 py-3"}>{columnLabel(key)}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={printable(row.id) || index}>{columns.map((key) => <td key={key} className={`${isNumericColumn(key) ? "text-right" : ""} max-w-64 truncate px-3 py-3 tabular-nums`}>{cell(key, row[key])}</td>)}</tr>)}{rows.length === 0 && <tr><td className="report-empty px-3 py-8 text-center text-muted-foreground" colSpan={Math.max(columns.length, 1)}>No records.</td></tr>}</tbody></table></div>;
}
