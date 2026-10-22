"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useShopFormat } from "@/components/app/shop-context";

type ReportType = "sales" | "purchases" | "product-sales" | "profit-loss" | "stock" | "due" | "expenses";
type Payload = Record<string, unknown> & { type: string; currencyCode?: string; shop?: { name: string; address: string | null; phone: string | null }; summary?: Record<string, string | number>; sales?: Record<string, unknown>[]; purchases?: Record<string, unknown>[]; products?: Record<string, unknown>[]; expenses?: Record<string, unknown>[]; customers?: Record<string, unknown>[]; suppliers?: Record<string, unknown>[]; lowStock?: Record<string, unknown>[]; expiringBatches?: Record<string, unknown>[] };
const options: { value: ReportType; label: string }[] = [{ value: "sales", label: "Sales" }, { value: "purchases", label: "Purchases" }, { value: "product-sales", label: "Product sales" }, { value: "profit-loss", label: "Profit & loss" }, { value: "stock", label: "Stock valuation" }, { value: "due", label: "Customer & supplier due" }, { value: "expenses", label: "Expenses" }];
const printable = (value: unknown): string => { if (value == null) return "—"; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value); return ""; };
const isInternalField = (key: string) => key.toLowerCase() === "id" || /(?:Id|ID|_id)$/.test(key) || key.toLowerCase().includes("requestid");
const columnLabel = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const moneyKeys = new Set(["total", "subtotal", "paidAmount", "dueAmount", "discountAmount", "revenue", "grossProfit", "netProfit", "expenses", "costOfGoods", "purchasePrice", "sellingPrice", "amount", "valuation"]);

export function ReportsPage() {
  const { formatMoney, formatDateTime, locale } = useShopFormat();
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
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => !isInternalField(key) && !["createdBy", "customer", "supplier", "payments", "items", "returns", "product", "category", "baseUnit"].includes(key) && typeof rows[0][key] !== "object").slice(0, 9) : [];
  const format = (key: string, value: unknown) => moneyKeys.has(key) ? formatMoney(printable(value)) : key.toLowerCase().endsWith("at") ? formatDateTime(printable(value)) : printable(value);
  // jsPDF's built-in fonts cannot render glyphs such as ₹, so PDF amounts use grouped numbers only.
  const pdfMoney = (value: unknown) => {
    const amount = Number(printable(value));
    return Number.isFinite(amount) ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) : printable(value);
  };
  const formatPdf = (key: string, value: unknown) => {
    if (moneyKeys.has(key)) return pdfMoney(value);
    if (key.toLowerCase() === "status") return printable(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    return key.toLowerCase().endsWith("at") ? formatDateTime(printable(value)) : printable(value);
  };
  async function exportPdf() {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const contentWidth = pageWidth - marginX * 2;
    const reportLabel = options.find((item) => item.value === type)?.label ?? "Report";
    const shopName = data.shop?.name ?? "StockPilot";
    const period = `${from || "All time"} to ${to || "Today"}`;
    const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;

    doc.setProperties({ title: `${shopName} ${reportLabel} report`, subject: period, creator: "StockPilot" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(12, 74, 68);
    doc.text(shopName.toUpperCase(), marginX, 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(35, 45, 44);
    doc.text(`${reportLabel} report`, marginX, 23);
    doc.setFontSize(8); doc.setTextColor(110, 120, 118);
    const contact = [data.shop?.address, data.shop?.phone].filter(Boolean).join("  ·  ");
    if (contact) doc.text(contact, marginX, 28);
    doc.text(`Period: ${period}`, pageWidth - marginX, 12, { align: "right" });
    doc.text(`Generated: ${formatDateTime(new Date())}`, pageWidth - marginX, 17, { align: "right" });
    doc.text(`Currency: ${data.currencyCode ?? "—"}`, pageWidth - marginX, 22, { align: "right" });
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.8); doc.line(marginX, 32, pageWidth - marginX, 32);

    const drawContinuationHeader = () => {
      if (doc.getCurrentPageInfo().pageNumber === 1) return;
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 0, pageWidth, 12, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
      doc.text(shopName.toUpperCase(), marginX, 7.8);
      doc.setFont("helvetica", "normal");
      doc.text(`${reportLabel} report  ·  ${period}`, pageWidth - marginX, 7.8, { align: "right" });
    };

    let y = 39;
    if (data.summary && Object.keys(data.summary).length) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(15, 76, 70);
      doc.text("SUMMARY", marginX, y);
      y += 3.5;
      const summaryRows: string[][] = Object.entries(data.summary).map(([key, value]) => [columnLabel(key), moneyKeys.has(key) ? pdfMoney(value) : String(value)]);
      autoTable(doc, {
        startY: y,
        body: summaryRows,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.2, textColor: [35, 45, 44], lineColor: [226, 234, 231], lineWidth: 0.1, overflow: "linebreak" },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: contentWidth * 0.68 }, 1: { fontStyle: "bold", halign: "right", cellWidth: contentWidth * 0.32 } },
        margin: { left: marginX, right: marginX, top: 18 },
        willDrawPage: drawContinuationHeader,
      });
      y = lastY() + 10;
    }

    const addSection = (sectionTitle: string, tableRows: Record<string, unknown>[]) => {
      if (!tableRows.length) {
        if (sectionTitle) {
          if (y > pageHeight - 24) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(120, 128, 126);
          doc.text(`${sectionTitle}: no records for this period.`, marginX, y); y += 8;
        }
        return;
      }
      if (y > pageHeight - 38) { doc.addPage(); y = 20; }
      if (sectionTitle) {
        doc.setFillColor(229, 244, 240);
        doc.rect(marginX, y - 4.2, contentWidth, 7, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(13, 96, 86);
        doc.text(sectionTitle.toUpperCase(), marginX + 2, y + 0.6);
        y += 6.5;
      }
      const keys = Object.keys(tableRows[0]).filter((key) => !isInternalField(key) && !["createdBy", "customer", "supplier", "payments", "items", "returns", "product", "category", "baseUnit"].includes(key) && typeof tableRows[0][key] !== "object").slice(0, 10);
      if (!keys.length) return;
      autoTable(doc, {
        startY: y,
        head: [keys.map(columnLabel)],
        body: tableRows.map((row) => keys.map((key) => formatPdf(key, row[key]))),
        theme: "grid",
        showHead: "everyPage",
        styles: { fontSize: 7.2, cellPadding: 1.8, overflow: "linebreak", textColor: [38, 48, 46], lineColor: [226, 234, 231], lineWidth: 0.1, valign: "middle" },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 7.4 },
        alternateRowStyles: { fillColor: [245, 249, 248] },
        columnStyles: Object.fromEntries(keys.map((key, index) => [index, moneyKeys.has(key) ? { halign: "right" } : {}])),
        margin: { left: marginX, right: marginX, top: 18, bottom: 16 },
        willDrawPage: drawContinuationHeader,
      });
      y = lastY() + 10;
    };

    if (type === "due") { addSection("Customer balances", data.customers ?? []); addSection("Supplier balances", data.suppliers ?? []); }
    else if (type === "stock") { addSection("Current stock", data.products ?? []); addSection("Low stock", data.lowStock ?? []); addSection("Expiring batches", data.expiringBatches ?? []); }
    else addSection(reportLabel, rows);

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(216, 226, 223); doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(115, 125, 123);
      doc.text(`${shopName}  ·  ${reportLabel} report  ·  ${period}`, marginX, pageHeight - 6);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginX, pageHeight - 6, { align: "right" });
    }
    doc.save(`stockpilot-${type}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return <div className="space-y-6 print:space-y-4"><div className="print:hidden"><PageHeader eyebrow="Business insights" title="Reports" description="Filter store records and export a clean printable report."/></div>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <Panel title="Report filters" description="Date ranges follow the shop timezone." action={<Button variant="outline" icon={<Download size={15}/>} onClick={() => void exportPdf()} disabled={!data || busy}>Export PDF</Button>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_1fr_1fr_auto]"><select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)} className={selectClass}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><label className="text-xs text-muted-foreground">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-xs text-muted-foreground">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`}/></label><Button variant="outline" icon={<Search size={15}/>} onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</Button></div>
    </Panel>
    {data?.summary && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.summary).slice(0, 8).map(([key, value]) => <div key={key} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs capitalize text-muted-foreground">{columnLabel(key)}</p><p className="mt-2 text-xl font-semibold">{moneyKeys.has(key) ? formatMoney(String(value)) : value}</p></div>)}</section>}
    {type === "stock" && data && <><Panel title="Low stock" description="Products at or below their reorder threshold."><ReportTable rows={data.lowStock ?? []}/></Panel><Panel title="Expiring batches" description="Tracked stock due to expire within 30 days."><ReportTable rows={data.expiringBatches ?? []}/></Panel></>}
    {type === "due" && data && <><Panel title="Customers with due balances"><ReportTable rows={data.customers ?? []}/></Panel><Panel title="Suppliers with due balances"><ReportTable rows={data.suppliers ?? []}/></Panel></>}
    {type !== "stock" && type !== "due" && <Panel title={`${options.find((o) => o.value === type)?.label ?? "Report"} records`} description={`${rows.length.toLocaleString()} rows returned.`}><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{columns.map((key) => <th className="px-3 py-3" key={key}>{columnLabel(key)}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={printable(row.id) || index}>{columns.map((key) => <td key={key} className="max-w-64 truncate px-3 py-3">{format(key, row[key])}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={Math.max(columns.length, 1)} className="px-3 py-8 text-center text-muted-foreground">No rows in the selected period.</td></tr>}</tbody></table></div></Panel>}
  </div>;
}

function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  const { formatMoney, formatDateTime } = useShopFormat();
  const columns = rows.length ? Object.keys(rows[0]).filter((key) => !isInternalField(key) && !["createdBy", "customer", "supplier", "payments", "items", "returns", "product", "category", "baseUnit"].includes(key) && typeof rows[0][key] !== "object").slice(0, 9) : [];
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{columns.map((key) => <th key={key} className="px-3 py-3">{columnLabel(key)}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={printable(row.id) || index}>{columns.map((key) => <td key={key} className="px-3 py-3">{moneyKeys.has(key) ? formatMoney(printable(row[key])) : key.toLowerCase().endsWith("at") ? formatDateTime(printable(row[key])) : printable(row[key])}</td>)}</tr>)}{rows.length === 0 && <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={Math.max(columns.length, 1)}>No records.</td></tr>}</tbody></table></div>;
}
