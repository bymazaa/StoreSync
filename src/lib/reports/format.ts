// One source of truth for a statement: its sections, columns and cells. The screen table and the
// server-rendered PDF read this file, because staff reconcile the paper against the screen.

export type ReportType = "sales" | "purchases" | "product-sales" | "profit-loss" | "stock" | "due" | "expenses";
export type Row = Record<string, unknown>;

export const printable = (value: unknown): string => { if (value == null) return "—"; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value); return ""; };
// Mongoose's version key (__v) and every foreign key arrive on the row objects; neither belongs on a statement.
export const isInternalField = (key: string) => key.startsWith("_") || key.toLowerCase() === "id" || /(?:Id|ID|_id)$/.test(key) || key.toLowerCase().includes("requestid");
// Column keys are machine names; these are the words the shop actually reads on a statement.
const labelOverrides: Record<string, string> = { due0to30: "Due 0-30", due31to60: "Due 31-60", dueOver60: "Over 60", oldestDueDays: "Oldest due days", costOfGoods: "Cost of goods", costPerBaseUnit: "Cost per unit", invoiceCount: "Invoices", stockOnHand: "In stock", lowStockThreshold: "Reorder at", soldQuantity: "Qty sold", receivedQuantity: "Qty received" };
export const columnLabel = (key: string) => labelOverrides[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
// Enum values arrive in snake_case; a statement column reads them as plain words.
export const sentenceCase = (value: string) => value.replace(/[_-]+/g, " ").trim().replace(/^./, (letter) => letter.toUpperCase());

export const moneyKeys = new Set(["total", "subtotal", "paidAmount", "dueAmount", "discountAmount", "discountValue", "additionalCost", "revenue", "grossSales", "grossPurchases", "returns", "grossProfit", "netProfit", "expenses", "costOfGoods", "costPerBaseUnit", "purchasePrice", "sellingPrice", "amount", "lineTotal", "valuation", "customerDue", "supplierDue", "due0to30", "due31to60", "dueOver60"]);
export const quantityKeys = new Set(["quantity", "baseQuantity", "soldQuantity", "receivedQuantity", "availableQuantity", "stockOnHand", "lowStockThreshold", "count", "rowCount", "invoiceCount", "invoices", "oldestDueDays"]);
// Statements are curated, not scraped: each report prints the columns the shop actually reads.
export const reportColumns: Record<ReportType, string[]> = {
  sales: ["soldAt", "invoiceNumber", "status", "subtotal", "discountAmount", "total", "paidAmount", "dueAmount"],
  purchases: ["purchasedAt", "invoiceNumber", "status", "subtotal", "discountAmount", "additionalCost", "total", "paidAmount", "dueAmount"],
  "product-sales": ["productName", "unit", "quantity", "revenue", "costOfGoods", "grossProfit"],
  "profit-loss": ["soldAt", "invoiceNumber", "subtotal", "discountAmount"],
  expenses: ["expenseDate", "title", "category", "amount", "notes"],
  stock: ["name", "sku", "stockOnHand", "lowStockThreshold", "purchasePrice", "sellingPrice"],
  due: ["name", "phone", "dueAmount", "due0to30", "due31to60", "dueOver60", "oldestDueDays", "invoices"],
};
export const expiringColumns = ["productName", "batchNumber", "expiresAt", "availableQuantity", "costPerBaseUnit"];
export const isNumericColumn = (key: string) => moneyKeys.has(key) || quantityKeys.has(key);
const columnRank = (key: string) => { const lower = key.toLowerCase(); if (lower.endsWith("date") || lower.endsWith("at")) return 0; return isNumericColumn(key) ? 2 : 1; };
const genericColumns = (rows: Row[]) => rows.length ? Object.keys(rows[0]).filter((key) => !isInternalField(key) && typeof rows[0][key] !== "object").sort((a, b) => columnRank(a) - columnRank(b)) : [];
// A key the API left out of a row is skipped rather than printed as an empty column.
export const statementColumns = (rows: Row[], preferred: string[]) => {
  if (!rows.length) return [];
  const present = Object.keys(rows[0]).filter((key) => !isInternalField(key) && typeof rows[0][key] !== "object");
  const picked = preferred.filter((key) => present.includes(key));
  return (picked.length ? picked : genericColumns(rows)).slice(0, 9);
};
// Every column gets a fixed share of the landscape page, so a long value wraps inside its own cell instead of pushing the table off the paper.
const columnWeight = (key: string) => { const lower = key.toLowerCase(); if (lower.endsWith("date") || lower.endsWith("at")) return 1.6; if (moneyKeys.has(key)) return 1.35; if (quantityKeys.has(key)) return 0.95; return 1.3; };
const serialShare = 4;
export const statementWidths = (columns: string[]) => {
  const total = columns.reduce((sum, key) => sum + columnWeight(key), 0) || 1;
  return [`${serialShare}%`, ...columns.map((key) => `${(columnWeight(key) * (100 - serialShare) / total).toFixed(2)}%`)];
};

export type StatementFormat = {
  money: (value: string | number) => string;
  amount: (value: string | number) => string;
  number: (value: string | number, maximumFractionDigits?: number) => string;
  date: (value: string | number | Date) => string;
  dateTime: (value: string | number | Date) => string;
};

export function createStatementFormat(options: { locale: string; timezone: string; currencyCode: string }): StatementFormat {
  const { locale, timezone, currencyCode } = options;
  return {
    money: (value) => new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(Number(value)),
    // Paper states the currency once in the header, which keeps every ledger column narrow enough to fit.
    amount: (value) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)),
    number: (value, maximumFractionDigits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits }).format(Number(value)),
    date: (value) => new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: "medium" }).format(new Date(value)),
    dateTime: (value) => new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)),
  };
}

// *Date is a calendar day, *At a moment — both render on the shop's clock, never as raw UTC.
export function statementCell(format: StatementFormat, key: string, value: unknown, medium: "screen" | "paper"): string {
  if (moneyKeys.has(key)) {
    const raw = printable(value);
    return raw === "" || raw === "—" || !Number.isFinite(Number(raw)) ? raw : medium === "screen" ? format.money(raw) : format.amount(raw);
  }
  if (quantityKeys.has(key)) {
    const raw = printable(value);
    return raw === "" || raw === "—" || !Number.isFinite(Number(raw)) ? raw : format.number(raw, 3);
  }
  const raw = printable(value);
  if (raw === "" || raw === "—") return raw;
  const lower = key.toLowerCase();
  if (lower === "status") return sentenceCase(raw);
  if (lower.endsWith("date")) return format.date(raw);
  if (lower.endsWith("at")) return format.dateTime(raw);
  return raw;
}

export type CellTone = "negative" | "due" | "lead" | "plain";
// One colour per cell: a negative figure is money coming back, an open due is money still to collect.
export function statementCellTone(key: string, value: unknown, isFirst: boolean): CellTone {
  const number = Number(printable(value));
  const finite = key.toLowerCase() !== "status" && Number.isFinite(number);
  if (finite && number < 0) return "negative";
  if (finite && number > 0 && moneyKeys.has(key) && key.toLowerCase().includes("due")) return "due";
  if (isFirst || moneyKeys.has(key)) return "lead";
  return "plain";
}

export const reportLabels: Record<ReportType, string> = { sales: "Sales", purchases: "Purchases", "product-sales": "Product sales", "profit-loss": "Profit & loss", stock: "Stock valuation", due: "Customer & supplier due", expenses: "Expenses" };
export const reportLabel = (type: ReportType) => reportLabels[type] ?? "Report";

// The /api/reports response, shaped by report type: each branch returns only its own row collections.
export type ReportPayload = Record<string, unknown> & { type: string; currencyCode?: string; shop?: { name: string; address: string | null; phone: string | null }; summary?: Record<string, string | number>; sales?: Row[]; purchases?: Row[]; products?: Row[]; expenses?: Row[]; customers?: Row[]; suppliers?: Row[]; lowStock?: Row[]; expiringBatches?: Row[] };

export type StatementSection = { title: string; description: string; rows: Row[]; columns: string[] };

// A statement never lists a batch's internal keys; the populated product object is lifted by batchRows.
export const batchRows = (payload: ReportPayload): Row[] => (payload.expiringBatches ?? []).map((batch) => ({ ...batch, product: undefined, productName: (batch.product as { name?: string } | null | undefined)?.name ?? "" }));

export function reportRows(type: ReportType, payload: ReportPayload): Row[] {
  if (type === "due") return [...(payload.customers ?? []), ...(payload.suppliers ?? [])];
  if (type === "stock") return payload.lowStock ?? [];
  return payload.sales ?? payload.purchases ?? payload.products ?? payload.expenses ?? [];
}

// One section list drives both the on-screen panels and the paper, so the two can never disagree.
export function statementSections(type: ReportType, payload: ReportPayload): StatementSection[] {
  if (type === "stock") {
    const lowStock = payload.lowStock ?? [];
    const batches = batchRows(payload);
    return [
      { title: "Low stock", description: `${lowStock.length} products at or below their reorder threshold.`, rows: lowStock, columns: statementColumns(lowStock, reportColumns.stock) },
      { title: "Expiring batches", description: `${batches.length} batches expiring within 30 days.`, rows: batches, columns: statementColumns(batches, expiringColumns) },
    ];
  }
  if (type === "due") {
    const customers = payload.customers ?? [];
    const suppliers = payload.suppliers ?? [];
    return [
      { title: "Customers with due balances", description: `${customers.length} customers · grouped by how long each invoice has been unpaid.`, rows: customers, columns: statementColumns(customers, reportColumns.due) },
      { title: "Suppliers with due balances", description: `${suppliers.length} suppliers with unpaid invoices.`, rows: suppliers, columns: statementColumns(suppliers, reportColumns.due) },
    ];
  }
  const label = reportLabel(type);
  const rows = reportRows(type, payload);
  return [{ title: `${label} entries`, description: `${rows.length.toLocaleString()} entries.`, rows, columns: statementColumns(rows, reportColumns[type]) }];
}

// Only amount columns close with a statement total; quantities mix units and counters mix meanings.
export function statementTotals(columns: string[], rows: Row[]) {
  const totals = columns.map((key) => {
    if (!moneyKeys.has(key)) return null;
    let sum = 0; let counted = 0;
    for (const row of rows) { const value = Number(row[key]); if (Number.isFinite(value)) { sum += value; counted += 1; } }
    return counted ? sum : null;
  });
  return { totals, labelIndex: columns.findIndex((key) => !isNumericColumn(key)), showTotal: rows.length > 1 && totals.some((value) => value !== null) };
}
