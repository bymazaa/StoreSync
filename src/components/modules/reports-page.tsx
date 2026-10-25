"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Download, Printer, Search } from "lucide-react";
import { apiRequest, readResponsePayload, refreshAuthSession } from "@/lib/client-api";
import { addDateKeyDays, localDateKey } from "@/lib/date-time";
import { ErrorMessage, inputClass, PageHeader, Panel, selectClass } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useShopFormat } from "@/components/app/shop-context";
import { columnLabel, isNumericColumn, moneyKeys, printable, reportLabel, reportRows, statementCell, statementCellTone, statementSections, statementTotals, statementWidths, type CellTone, type ReportPayload, type ReportType, type Row } from "@/lib/reports/format";

type Payload = ReportPayload;
const options: { value: ReportType; label: string }[] = [{ value: "sales", label: "Sales" }, { value: "purchases", label: "Purchases" }, { value: "product-sales", label: "Product sales" }, { value: "profit-loss", label: "Profit & loss" }, { value: "stock", label: "Stock valuation" }, { value: "due", label: "Customer & supplier due" }, { value: "expenses", label: "Expenses" }];
type Preset = "3" | "7" | "15" | "30" | "all" | "custom";
const presets: { value: Preset; label: string }[] = [{ value: "3", label: "Last 3 days" }, { value: "7", label: "Last 7 days" }, { value: "15", label: "Last 15 days" }, { value: "30", label: "Last 30 days" }, { value: "all", label: "All time" }, { value: "custom", label: "Custom range" }];

export function ReportsPage() {
  const { formatMoney, formatNumber, formatDateTime, timezone } = useShopFormat();
  const today = localDateKey(new Date(), timezone);
  const [type, setType] = useState<ReportType>("sales");
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState(() => addDateKeyDays(today, -30));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Payload | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false); const [saveNote, setSaveNote] = useState("");
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
  const rows = data ? reportRows(type, data) : [];
  const sections = data ? statementSections(type, data) : [];
  const label = reportLabel(type);
  const period = !from && !to ? "All time" : `${from || "Start"} → ${to || today}`;
  const generatedAt = data ? formatDateTime(new Date()) : "";
  const contact = [data?.shop?.address, data?.shop?.phone].filter(Boolean).join(" · ");
  const shopName = data?.shop?.name ?? "StockPilot";
  const currencyCode = data?.currencyCode ?? "";
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

  // The server's Chromium writes the file, so one click saves a PDF with no dialog in the way.
  async function saveStatement() {
    setSaving(true); setSaveNote("");
    try {
      const query = new URLSearchParams({ type }); if (from) query.set("from", from); if (to) query.set("to", to);
      const send = () => fetch(`/api/reports/pdf?${query}`, { cache: "no-store" });
      let response = await send();
      if (response.status === 401 && await refreshAuthSession()) response = await send();
      if (!response.ok) {
        const message = await readResponsePayload(response).then((payload) => payload.error?.message ?? "").catch(() => "");
        if (response.status === 503) { setSaveNote(message || "The PDF writer is offline on this server — use Print instead."); return; }
        throw new Error(message || `Statement PDF could not be created (status ${response.status}).`);
      }
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href; link.download = `${fileStem}.pdf`;
      document.body.append(link); link.click(); link.remove();
      // Revoking immediately can cancel the save on Safari, so the blob outlives the click.
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    }
    catch (caught) { setSaveNote(caught instanceof Error ? caught.message : "Statement PDF could not be created."); }
    finally { setSaving(false); }
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
            <div><span className="report-meta-label">Statement</span><span>{label}</span></div>
            <div><span className="report-meta-label">Period</span><span className="tabular-nums">{period}</span></div>
            <div><span className="report-meta-label">Entries</span><span className="tabular-nums">{rows.length.toLocaleString()}</span></div>
            <div><span className="report-meta-label">Generated</span><span className="tabular-nums">{generatedAt}</span></div>
            <div><span className="report-meta-label">Currency</span><span>{currencyCode || "—"}</span></div>
          </div>
        </div>
        <div className="report-title-band">
          <p className="report-title">{label} statement</p>
          <p className="report-period">{from || "Start"} → {to || today}</p>
        </div>
      </div>

      {error && <div className="print:hidden"><ErrorMessage>{error}</ErrorMessage></div>}
      <Panel className="print:hidden" title="Report filters" description="Date ranges follow the shop timezone." action={<div className="flex flex-wrap gap-2"><Button icon={<Download size={15}/>} onClick={() => { void saveStatement(); }} disabled={!data || busy || saving}>{saving ? "Preparing…" : "Statement PDF"}</Button><Button variant="ghost" icon={<Printer size={15}/>} onClick={printStatement} disabled={!data || busy}>Print</Button></div>}>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.2fr)_minmax(150px,1fr)_minmax(140px,0.85fr)_minmax(140px,0.85fr)_auto]">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Report type<select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)} className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Period<select aria-label="Period preset" value={preset} onChange={(e) => applyPreset(e.target.value as Preset)} className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}>{presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className={`${inputClass} mt-1.5`}/></label>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className={`${inputClass} mt-1.5`}/></label>
          <Button variant="outline" icon={<Search size={15}/>} onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</Button>
        </div>
        {type === "due" && <p className="mt-3 text-xs text-muted-foreground">Aging buckets are counted from each unpaid invoice date.</p>}
        {saveNote && <div className="mt-3"><ErrorMessage>{saveNote}</ErrorMessage></div>}
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
      {sections.map((section) => <Panel key={section.title} className="report-section" title={section.title} description={section.description}><ReportTable rows={section.rows} columns={section.columns}/></Panel>)}
      <div className="report-footnote hidden print:flex"><span>StockPilot · {label} statement · {generatedAt}</span><span>{currencyCode ? `All amounts in ${currencyCode}. ` : ""}Data from this shop’s own database — verify before external use.</span></div>
    </div>
  );
}

const toneClass: Record<CellTone, string> = { negative: "text-danger", due: "text-amber-strong", lead: "text-foreground", plain: "text-foreground/85" };

function ReportTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  const { statement } = useShopFormat();
  const widths = statementWidths(columns);
  const { totals, labelIndex, showTotal } = statementTotals(columns, rows);
  const cell = (key: string, value: unknown): ReactNode => {
    if (!moneyKeys.has(key)) return statementCell(statement, key, value, "screen");
    // Paper states the currency once in the header, which keeps every ledger column narrow enough to fit.
    return <><span className="print:hidden">{statementCell(statement, key, value, "screen")}</span><span className="hidden print:inline">{statementCell(statement, key, value, "paper")}</span></>;
  };
  return <div className="report-table-frame overflow-hidden rounded-xl border border-border/70"><div className="overflow-x-auto"><table className="w-full min-w-[720px] table-fixed text-left text-sm"><colgroup>{widths.map((width, index) => <col key={index} style={{ width }}/>)}</colgroup><thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-2 py-3 text-right font-semibold">#</th>{columns.map((key) => <th key={key} className={`${isNumericColumn(key) ? "text-right" : ""} px-4 py-3 font-semibold`}>{columnLabel(key)}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{rows.map((row, index) => <tr key={printable(row.id) || index} className={`${index % 2 === 1 ? "bg-muted/25" : ""} transition-colors hover:bg-teal-soft/50`}><td className="report-serial select-none px-2 py-3 text-right text-[11px] tabular-nums text-muted-foreground/80">{index + 1}</td>{columns.map((key, cellIndex) => <td key={key} className={`${isNumericColumn(key) ? "text-right" : ""} ${cellIndex === 0 ? "font-medium" : ""} ${toneClass[statementCellTone(key, row[key], cellIndex === 0)]} px-4 py-3 tabular-nums`}>{cell(key, row[key])}</td>)}</tr>)}{rows.length === 0 && <tr><td className="report-empty px-4 py-12 text-center text-sm text-muted-foreground" colSpan={Math.max(columns.length + 1, 2)}>No entries in this period.</td></tr>}</tbody>{showTotal && <tfoot><tr className="border-t-2 border-primary/60 bg-muted/20"><td className="px-2 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labelIndex === -1 ? "Total" : ""}</td>{columns.map((key, index) => <td key={key} className={`${isNumericColumn(key) ? "text-right" : ""} px-4 py-3.5 font-semibold tabular-nums ${index === labelIndex ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" : totals[index] === null ? "text-muted-foreground" : "text-teal-strong"}`}>{index === labelIndex ? "Total" : totals[index] === null ? "" : cell("total", String(totals[index]))}</td>)}</tr></tfoot>}</table></div></div>;
}
