'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Banknote, FileText, HandCoins, Handshake, Hash, Package, PiggyBank, Printer, ReceiptText, RotateCcw, Search, ShoppingBag, ShoppingCart, Sigma, TrendingUp, Truck, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import { apiRequest } from '@/lib/client-api';
import { addDateKeyDays, localDateKey } from '@/lib/date-time';
import { ErrorMessage, PageHeader, Panel, selectClass } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { useCanViewProfit, useShopFormat } from '@/components/app/shop-context';
import {
    columnLabel,
    isNumericColumn,
    moneyKeys,
    printable,
    reportLabel,
    reportRows,
    statementCell,
    statementCellTone,
    statementSections,
    statementTotals,
    statementWidths,
    type CellTone,
    type ReportPayload,
    type ReportType,
    type Row,
} from '@/lib/reports/format';

type Payload = ReportPayload;
const options: { value: ReportType; label: string }[] = [
    { value: 'sales', label: 'Sales' },
    { value: 'purchases', label: 'Purchases' },
    { value: 'product-sales', label: 'Product sales' },
    { value: 'profit-loss', label: 'Profit & loss' },
    { value: 'stock', label: 'Stock valuation' },
    { value: 'due', label: 'Customer & supplier due' },
    { value: 'expenses', label: 'Expenses' },
];
type Preset = '3' | '7' | '15' | '30' | 'all' | 'custom';
const presets: { value: Preset; label: string }[] = [
    { value: '3', label: 'Last 3 days' },
    { value: '7', label: 'Last 7 days' },
    { value: '15', label: 'Last 15 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom range' },
];

// StatCard-style summary tiles: title on top, tinted icon chip, one big number. The gloss line
// under the number is a <span> on purpose — the print stylesheet sizes .report-summary's first
// and last <p>, so the value must stay the last paragraph.
const summaryIcons: Record<string, LucideIcon> = {
    invoiceCount: FileText,
    grossSales: ShoppingCart,
    returns: RotateCcw,
    returnCount: RotateCcw,
    revenue: Banknote,
    costOfGoods: Package,
    grossProfit: TrendingUp,
    netProfit: PiggyBank,
    expenses: Wallet,
    expenseCount: ReceiptText,
    grossPurchases: ShoppingBag,
    total: Sigma,
    count: Hash,
    customerDue: HandCoins,
    supplierDue: Handshake,
    customersOwed: UsersRound,
    suppliersOwed: Truck,
};

const summaryGloss: Record<string, string> = {
    invoiceCount: 'Invoices this period',
    grossSales: 'Before returns',
    returns: 'Refunds & reversals',
    returnCount: 'Returned invoices',
    revenue: 'Net of returns',
    costOfGoods: 'Cost of sold items',
    grossProfit: 'Revenue − cost of goods',
    netProfit: 'Profit after expenses',
    expenses: 'Recorded expenses',
    expenseCount: 'Expense entries',
    grossPurchases: 'Before returns',
    total: 'Net purchases',
    count: 'Entries this period',
    customerDue: "Customers' unpaid balance",
    supplierDue: "Suppliers' unpaid balance",
    customersOwed: 'Customers with a balance',
    suppliersOwed: 'Suppliers with a balance',
};

const summaryTones: Record<string, string> = {
    returns: 'bg-amber-soft text-amber-strong',
    costOfGoods: 'bg-violet-soft text-violet-strong',
    expenses: 'bg-amber-soft text-amber-strong',
    grossPurchases: 'bg-violet-soft text-violet-strong',
    customerDue: 'bg-amber-soft text-amber-strong',
    supplierDue: 'bg-amber-soft text-amber-strong',
};

export function ReportsPage() {
    const { formatMoney, formatNumber, formatDateTime, timezone } = useShopFormat();
    const canViewProfit = useCanViewProfit();
    const visibleOptions = options.filter((o) => canViewProfit || o.value !== 'profit-loss');
    // `new Date()` stays out of the render path so the page shell can be prerendered;
    // the real "today" lands in a mount effect.
    const [today, setToday] = useState('');
    const [type, setType] = useState<ReportType>('sales');
    const [preset, setPreset] = useState<Preset>('30');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [generatedAt, setGeneratedAt] = useState('');

    useEffect(() => {
        if (!canViewProfit && type === 'profit-loss') {
            setType('sales');
        }
    }, [canViewProfit, type]);
    useEffect(() => {
        const end = localDateKey(new Date(), timezone);
        setToday(end);
        setFrom((previous) => previous || addDateKeyDays(end, -30));
        setTo((previous) => previous || end);
    }, [timezone]);
    const load = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            const query = new URLSearchParams({ type });
            if (from) query.set('from', from);
            if (to) query.set('to', to);
            setData(await apiRequest<Payload>(`/api/reports?${query}`));
            setGeneratedAt(formatDateTime(new Date()));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Report could not be loaded.');
        } finally {
            setBusy(false);
        }
    }, [type, from, to]);
    useEffect(() => {
        if (!today) return;
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [load, today]);
    function applyPreset(value: Preset) {
        setPreset(value);
        if (value === 'all') {
            setFrom('');
            setTo('');
            return;
        }
        if (value === 'custom') return;
        const end = localDateKey(new Date(), timezone);
        setTo(end);
        setFrom(addDateKeyDays(end, -Number(value)));
    }
    const rows = data ? reportRows(type, data) : [];
    const sections = data ? statementSections(type, data) : [];
    const label = reportLabel(type);
    const period = !from && !to ? 'All time' : `${from || 'Start'} → ${to || today}`;
    const contact = [data?.shop?.address, data?.shop?.phone].filter(Boolean).join(' · ');
    const shopName = data?.shop?.name ?? 'StockPilot';
    const currencyCode = data?.currencyCode ?? '';
    const fileStem = `${type}-statement-${!from && !to ? 'all-time' : `${from || 'start'}-to-${to || today}`}`;

    // The browser's own print pipeline writes the paper, so Bengali conjuncts shape correctly and "Save as
    // PDF" is the same button — the document title becomes the suggested filename.
    function printStatement() {
        const previousTitle = document.title;
        const restore = () => {
            document.title = previousTitle;
            window.removeEventListener('afterprint', restore);
        };
        document.title = fileStem;
        window.addEventListener('afterprint', restore);
        window.print();
    }

    return (
        <div className="report-print space-y-6 print:space-y-0" aria-busy={busy}>
            <div className="print:hidden">
                <PageHeader
                    eyebrow="Business insights"
                    title="Reports"
                    description="Filter the store's records, then print or save the statement as a PDF from the print dialog."
                />
            </div>
            <div className="hidden print:block">
                <div className="report-letterhead">
                    <div className="report-letterhead-shop">
                        <p className="report-shop-name">{shopName}</p>
                        {data?.shop?.address && <p className="report-contact">{data.shop.address}</p>}
                        {data?.shop?.phone && <p className="report-contact">Phone: {data.shop.phone}</p>}
                        <div className="report-shop-extra">
                            <p className="report-meta-sub">
                                <span>Report Type:</span> {label} Statement
                            </p>
                            <p className="report-meta-sub">
                                <span>Date Range:</span> {period}
                            </p>
                            <p className="report-meta-sub">
                                <span>Total Records:</span> {rows.length.toLocaleString()} {rows.length === 1 ? 'entry' : 'entries'}
                            </p>
                        </div>
                    </div>
                    <div className="report-meta">
                        <div>
                            <span className="report-meta-label">Generated</span>
                            <span className="tabular-nums">{generatedAt}</span>
                        </div>
                        <div>
                            <span className="report-meta-label">Currency</span>
                            <span>{currencyCode || '—'}</span>
                        </div>
                        <div>
                            <span className="report-meta-label">Timezone</span>
                            <span>{timezone || 'Local'}</span>
                        </div>
                        <div>
                            <span className="report-meta-label">Document</span>
                            <span>Official Statement</span>
                        </div>
                    </div>
                </div>
                <div className="report-title-band">
                    <p className="report-title">{label} statement</p>
                    <p className="report-period">
                        {from || 'Start'} → {to || today}
                    </p>
                </div>
            </div>

            {error && (
                <div className="print:hidden">
                    <ErrorMessage>{error}</ErrorMessage>
                </div>
            )}
            <Panel
                className="print:hidden"
                title="Report filters"
                description="Date ranges follow the shop timezone."
                action={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="primary"
                            icon={<Printer size={15} />}
                            onClick={printStatement}
                            disabled={!data || busy}
                        >
                            Print
                        </Button>
                    </div>
                }
            >
                <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_auto]">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Report type
                        <select
                            aria-label="Report type"
                            value={type}
                            onChange={(e) => setType(e.target.value as ReportType)}
                            className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}
                        >
                            {visibleOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Period
                        <select
                            aria-label="Period preset"
                            value={preset}
                            onChange={(e) => applyPreset(e.target.value as Preset)}
                            className={`${selectClass} mt-1.5 font-normal normal-case tracking-normal`}
                        >
                            {presets.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        From
                        <DateField
                            value={from}
                            onChange={(value) => {
                                setFrom(value);
                                setPreset('custom');
                            }}
                            className="mt-1.5"
                        />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        To
                        <DateField
                            value={to}
                            onChange={(value) => {
                                setTo(value);
                                setPreset('custom');
                            }}
                            className="mt-1.5"
                        />
                    </label>
                    <Button
                        variant="outline"
                        icon={<Search size={15} />}
                        onClick={() => void load()}
                        disabled={busy}
                    >
                        {busy ? 'Loading…' : 'Refresh'}
                    </Button>
                </div>
                {type === 'due' && (
                    <p className="mt-3 text-xs text-muted-foreground">
                        Aging buckets are counted from each unpaid invoice date.
                    </p>
                )}
            </Panel>
            {data && (
                <div className="report-screen-meta print:hidden" aria-live="polite">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-foreground">{label}</span>
                        <span aria-hidden="true" className="text-border">·</span>
                        <span>{period}</span>
                        <span aria-hidden="true" className="text-border">·</span>
                        <span>{formatNumber(rows.length)} {rows.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    {generatedAt && <span className="shrink-0">Updated {generatedAt}</span>}
                </div>
            )}
            {data?.summary && (
                <section className="report-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(data.summary)
                        .filter(([key]) => canViewProfit || (key !== 'grossProfit' && key !== 'costOfGoods' && key !== 'netProfit'))
                        .slice(0, 8)
                        .map(([key, value]) => {
                            const money = moneyKeys.has(key);
                            const numeric =
                                typeof value === 'number' ||
                                (typeof value === 'string' &&
                                    value.trim() !== '' &&
                                    Number.isFinite(Number(value)));
                            const negative = numeric && Number(value) < 0;
                            const shown = money
                                ? formatMoney(String(value))
                                : numeric
                                  ? formatNumber(Number(value))
                                  : printable(value);
                            const Icon = summaryIcons[key] ?? (money ? Banknote : Hash);
                            const tone = negative
                                ? 'bg-danger/10 text-danger'
                                : summaryTones[key] ?? (money ? 'bg-teal-soft text-teal-strong' : 'bg-blue-soft text-blue-strong');
                            return (
                                <div key={key} className="rounded-[16px] border border-line bg-card p-5 shadow-2xl shadow-gray-100 dark:shadow-none">
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                            {columnLabel(key)}
                                        </p>
                                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl print:hidden ${tone}`}>
                                            <Icon size={17} strokeWidth={1.9} />
                                        </span>
                                    </div>
                                    <p className={`mt-4 text-[clamp(1.5rem,2.2vw,2rem)] font-medium leading-none tracking-[-0.03em] tabular-nums [overflow-wrap:anywhere] ${negative ? 'text-danger' : 'text-foreground'}`}>
                                        {shown}
                                    </p>
                                    <span className="mt-2 block text-[11px] text-muted-foreground print:hidden">
                                        {summaryGloss[key] ?? (money ? `All amounts in ${currencyCode}` : period)}
                                    </span>
                                </div>
                            );
                        })}
                </section>
            )}
            {sections.map((section) => (
                <Panel
                    key={section.title}
                    className="report-section"
                    title={section.title}
                    description={section.description}
                >
                    <ReportTable rows={section.rows} columns={section.columns} />
                </Panel>
            ))}
            <div className="report-footnote hidden print:flex">
                <span>
                    StockPilot · {label} statement · {generatedAt}
                </span>
                <span>
                    {currencyCode ? `All amounts in ${currencyCode}. ` : ''}Data from this shop’s
                    own database — verify before external use.
                </span>
            </div>
        </div>
    );
}

const toneClass: Record<CellTone, string> = {
    negative: 'text-danger',
    due: 'text-amber-strong',
    lead: 'text-foreground',
    plain: 'text-foreground/85',
};

function ReportTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
    const { statement } = useShopFormat();
    const widths = statementWidths(columns);
    const { totals, labelIndex, showTotal } = statementTotals(columns, rows);
    const cell = (key: string, value: unknown): ReactNode => {
        if (!moneyKeys.has(key)) return statementCell(statement, key, value, 'screen');
        // Paper states the currency once in the header, which keeps every ledger column narrow enough to fit.
        return (
            <>
                <span className="print:hidden">
                    {statementCell(statement, key, value, 'screen')}
                </span>
                <span className="hidden print:inline">
                    {statementCell(statement, key, value, 'paper')}
                </span>
            </>
        );
    };
    return (
        <div className="report-table-frame overflow-hidden rounded-xl border border-border/70 print:border-0 print:rounded-none">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                    <colgroup>
                        {widths.map((width, index) => (
                            <col key={index} style={{ width }} />
                        ))}
                    </colgroup>
                    <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground print:border-0">
                        <tr>
                            <th className="px-2 py-3 text-right font-semibold">#</th>
                            {columns.map((key) => (
                                <th
                                    key={key}
                                    className={`${isNumericColumn(key) ? 'text-right' : ''} px-4 py-3 font-semibold`}
                                >
                                    {columnLabel(key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-y-0">
                        {rows.map((row, index) => (
                            <tr
                                key={typeof row.id === 'string' && row.id.length > 0 ? String(row.id) : index}
                                className={`${index % 2 === 1 ? 'bg-muted/25' : ''} transition-colors hover:bg-teal-soft/50`}
                            >
                                <td className="report-serial select-none px-2 py-3 text-right text-[11px] tabular-nums text-muted-foreground/80">
                                    {index + 1}
                                </td>
                                {columns.map((key, cellIndex) => (
                                    <td
                                        key={key}
                                        className={`${isNumericColumn(key) ? 'text-right' : ''} ${cellIndex === 0 ? 'font-medium' : ''} ${toneClass[statementCellTone(key, row[key], cellIndex === 0)]} px-4 py-3 tabular-nums`}
                                    >
                                        {cell(key, row[key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    className="report-empty px-4 py-12 text-center text-sm text-muted-foreground"
                                    colSpan={Math.max(columns.length + 1, 2)}
                                >
                                    No entries in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {showTotal && (
                        <tfoot>
                            <tr className="border-t-2 border-primary/60 bg-muted/20 print:border-0">
                                <td className="px-2 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    {labelIndex === -1 ? 'Total' : ''}
                                </td>
                                {columns.map((key, index) => (
                                    <td
                                        key={key}
                                        className={`${isNumericColumn(key) ? 'text-right' : ''} px-4 py-3.5 font-semibold tabular-nums ${index === labelIndex ? 'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground' : totals[index] === null ? 'text-muted-foreground' : 'text-teal-strong'}`}
                                    >
                                        {index === labelIndex
                                            ? 'Total'
                                            : totals[index] === null
                                              ? ''
                                              : cell('total', String(totals[index]))}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
