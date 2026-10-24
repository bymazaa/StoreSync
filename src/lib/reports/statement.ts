// The paper half of a statement: the same sections and cells the screen shows, rendered as a standalone
// HTML document for Chromium. Server-side only — it embeds the statement face as a data URI because a
// sidecar container has no copy of public/fonts.

import { readFileSync } from "node:fs";
import path from "node:path";
import { columnLabel, isNumericColumn, moneyKeys, printable, reportLabel, reportRows, statementCell, statementCellTone, statementSections, statementTotals, statementWidths, type ReportPayload, type ReportType, type Row, type StatementFormat } from "./format";

export type { ReportPayload };

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const paperTone = { negative: "statement-negative", due: "statement-due", lead: "statement-lead", plain: "" } as const;

// The payload is the /api/reports response. Shop, currency, summary and rows all come from it, so a
// PDF can never disagree with the screen about what the statement contains.
export type StatementDocument = {
  type: ReportType;
  payload: ReportPayload;
  format: StatementFormat;
  period: string;
  generatedAt: string;
};

let faceCache: string | null = null;
// The sidecar container carries no system fonts, so every face a statement needs is inlined: Cutive Mono
// for the figures and Bengali product names shape only if their real font travels with the document.
function fontFaces(root: string) {
  if (!faceCache) {
    const faces = [
      { file: "cutive-mono-latin-400-normal.woff2", family: "Cutive Mono", range: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
      { file: "cutive-mono-latin-ext-400-normal.woff2", family: "Cutive Mono", range: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
      { file: "noto-sans-bengali-wght-normal.woff2", family: "Noto Sans Bengali", range: "U+0980-09FF, U+200C-200D", weight: "100 900" },
    ];
    faceCache = faces.map((face) => `@font-face { font-family: "${face.family}"; font-style: normal; font-weight: ${face.weight ?? "400"}; font-display: block; src: url("data:font/woff2;base64,${readFileSync(path.join(root, "public", "fonts", face.file)).toString("base64")}") format("woff2"); unicode-range: ${face.range}; }`).join("\n");
  }
  return faceCache;
}

function paperStyles(root: string) {
  // Mirrors the print block in src/app/globals.css: same page box, same hairlines, same column shares.
  return `${fontFaces(root)}
@page { size: A4 landscape; margin: 9mm 10mm; }
* { margin: 0; box-sizing: border-box; }
html, body { background: #fff; }
body { font-family: "Cutive Mono", "Noto Sans Bengali", sans-serif; font-size: 7.2pt; line-height: 1.45; color: #1b2b28; font-variant-numeric: tabular-nums; }
.statement { width: 100%; }
.letterhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; padding-bottom: 1.6mm; border-bottom: 0.3mm solid #0f766e; }
.shop-name { font-size: 12pt; font-weight: 700; letter-spacing: 0.02em; line-height: 1.3; color: #0c4a44; }
.contact { margin-top: 0.6mm; font-size: 7.6pt; line-height: 1.5; color: #5d6b68; }
.meta { font-size: 7.2pt; color: #2f403c; text-align: left; }
.meta > div { display: flex; justify-content: flex-end; gap: 2mm; }
.meta > div + div { margin-top: 0.4mm; }
.meta-label { min-width: 20mm; text-align: right; font-size: 6.2pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #86938f; }
.title-band { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm; margin-top: 2mm; }
.title { font-size: 9.6pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #172523; }
.period { font-size: 7.2pt; color: #5d6b68; }
.summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 2.4mm; border: 0.2mm solid #d6e2de; border-radius: 1.4mm; overflow: hidden; break-inside: avoid; }
.summary > div { padding: 1.5mm 2mm; border-left: 0.2mm solid #e6eeeb; }
.summary > div:nth-child(4n+1) { border-left: 0; }
.summary > div:nth-child(n+5) { border-top: 0.2mm solid #e6eeeb; }
.summary p:first-child { font-size: 6pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #7f8c89; }
.summary p:last-child { margin-top: 0.5mm; font-size: 8.4pt; font-weight: 700; color: #0c4a44; }
.section { margin-top: 2.4mm; padding: 2mm 2.4mm; border: 0.2mm solid #d6e2de; border-radius: 1.4mm; }
.section-head { margin-bottom: 1.5mm; padding-bottom: 1.2mm; border-bottom: 0.2mm solid #e6eeeb; }
.section h2 { font-size: 8.2pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #0c4a44; }
.section .description { font-size: 7pt; color: #6b7a76; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { padding: 1.1mm 1.4mm; line-height: 1.3; background: #cfe1db; color: #24352f; font-size: 6.2pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; text-align: left; vertical-align: bottom; border-bottom: 0.3mm solid #0f766e; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
td { padding: 1mm 1.4mm; line-height: 1.5; border-bottom: 0.12mm solid #d8e4e1; color: #22322e; vertical-align: top; overflow-wrap: anywhere; }
.serial { color: #8a9793; font-size: 6.4pt; text-align: right; }
.right { text-align: right; }
.statement-lead { color: #172523; }
.statement-due { color: #8a5a12; }
.statement-negative { color: #a33a3a; }
tbody tr:nth-child(even) td { background: #fbfdfc; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
tfoot td { padding-top: 1.3mm; border-top: 0.3mm solid #0f766e; border-bottom: 0; color: #0c4a44; font-weight: 700; }
tfoot .count { font-size: 6.2pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #86938f; }
.empty { padding: 8mm 0; text-align: center; color: #7c8a86; }
.footnote { display: flex; justify-content: space-between; gap: 6mm; margin-top: 2.4mm; padding-top: 1.2mm; border-top: 0.3mm solid #0f766e; font-size: 6.2pt; letter-spacing: 0.04em; color: #74817e; }`;
}

function tableHtml(format: StatementFormat, rows: Row[], columns: string[]) {
  const { totals, labelIndex, showTotal } = statementTotals(columns, rows);
  const span = Math.max(columns.length + 1, 2);
  const head = `<tr><th class="serial">#</th>${columns.map((key) => `<th${isNumericColumn(key) ? ' class="right"' : ""}>${escapeHtml(columnLabel(key))}</th>`).join("")}</tr>`;
  const body = rows.length
    ? rows.map((row, index) => `<tr><td class="serial">${index + 1}</td>${columns.map((key, cellIndex) => {
      const tone = paperTone[statementCellTone(key, row[key], cellIndex === 0)];
      const cls = [isNumericColumn(key) ? "right" : "", tone].filter(Boolean).join(" ");
      return `<td${cls ? ` class="${cls}"` : ""}>${escapeHtml(statementCell(format, key, row[key], "paper"))}</td>`;
    })}</tr>`).join("")
    : `<tr><td class="empty" colspan="${span}">No entries in this period.</td></tr>`;
  const foot = showTotal ? `<tr><td class="serial count">&nbsp;</td>${columns.map((key, index) => `<td${isNumericColumn(key) ? ' class="right"' : ""}>${index === labelIndex ? '<span class="count">Total</span>' : totals[index] === null ? "&nbsp;" : escapeHtml(statementCell(format, "total", String(totals[index]), "paper"))}</td>`).join("")}</tr>` : "";
  return `<table><colgroup>${statementWidths(columns).map((width) => `<col style="width:${width}">`).join("")}</colgroup><thead>${head}</thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ""}</table>`;
}

export function renderStatementHtml(document: StatementDocument, root: string) {
  const label = reportLabel(document.type);
  const shop = document.payload.shop ?? { name: "StockPilot", address: null, phone: null };
  const currencyCode = document.payload.currencyCode ?? "";
  const contact = [shop.address, shop.phone].filter(Boolean).join(" · ");
  const summary = Object.entries(document.payload.summary ?? {}).slice(0, 8);
  const entryCount = reportRows(document.type, document.payload).length;
  const meta: [string, string][] = [["Statement", label], ["Period", document.period], ["Entries", entryCount.toLocaleString()], ["Generated", document.generatedAt], ["Currency", currencyCode || "—"]];
  const sections = statementSections(document.type, document.payload);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(label)} statement</title><style>${paperStyles(root)}</style></head>
<body><main class="statement">
<header class="letterhead"><div><p class="shop-name">${escapeHtml(shop.name)}</p>${contact ? `<p class="contact">${escapeHtml(contact)}</p>` : ""}</div>
<div class="meta">${meta.map(([key, value]) => `<div><span class="meta-label">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("")}</div></header>
<div class="title-band"><p class="title">${escapeHtml(`${label} statement`)}</p><p class="period">${escapeHtml(document.period)}</p></div>
${summary.length ? `<section class="summary">${summary.map(([key, value]) => {
    const money = moneyKeys.has(key);
    const numeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
    const shown = money ? statementCell(document.format, "total", value, "paper") : numeric ? document.format.number(value) : printable(value);
    return `<div><p>${escapeHtml(columnLabel(key))}</p><p>${escapeHtml(shown)}</p></div>`;
  }).join("")}</section>` : ""}
${sections.map((section) => `<section class="section"><div class="section-head"><h2>${escapeHtml(section.title)}</h2><p class="description">${escapeHtml(section.description)}</p></div>${tableHtml(document.format, section.rows, section.columns)}</section>`).join("")}
<footer class="footnote"><span>StockPilot · ${escapeHtml(`${label} statement`)} · ${escapeHtml(document.generatedAt)}</span><span>${currencyCode ? `All amounts in ${escapeHtml(currencyCode)}. ` : ""}Data from this shop’s own database — verify before external use.</span></footer>
</main></body></html>`;
}
