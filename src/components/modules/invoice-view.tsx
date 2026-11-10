'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/client-api';
import { createClientRequestId } from '@/lib/client-request-id';
import { ErrorMessage, PageHeader, Panel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { useHasPermission, useShopFormat } from '@/components/app/shop-context';
import { usesWholeQuantity } from '@/lib/quantity';
import { Scissors } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function formatQuantity(value: number | string) {
    return String(Number(value));
}

function limitText(value: string | null | undefined, maxLength: number) {
    const text = value?.trim() ?? '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

type Invoice = {
    id: string;
    invoiceNumber: string;
    supplierInvoiceNumber?: string | null;
    status: string;
    subtotal: string;
    discountAmount: string;
    additionalCost?: string;
    total: string;
    paidAmount: string;
    dueAmount: string;
    notes: string | null;
    soldAt?: string;
    purchasedAt?: string;
    customer?: { name: string; phoneE164: string | null; address: string | null } | null;
    supplier?: { name: string; phoneE164: string | null; address: string | null } | null;
    items: {
        id: string;
        productName: string;
        skuSnapshot: string;
        quantity: string;
        conversionToBase?: string;
        unit: { name?: string; symbol: string };
        unitPrice?: string;
        unitCost?: string;
        lineTotal: string;
        batchNumber?: string | null;
        expiresAt?: string | null;
        product?: { tracksBatch: boolean; tracksExpiry: boolean };
    }[];
    returns?: {
        id: string;
        returnNumber: string;
        status: string;
        reason: string | null;
        total: string;
        refundAmount: string;
        returnedAt: string;
        items: {
            saleItemId?: string;
            purchaseItemId?: string;
            quantity: string;
            lineTotal?: string;
            unit?: { symbol: string };
        }[];
    }[];
    payments: {
        amount: string;
        paidAt: string;
        method: { name: string };
        reference: string | null;
    }[];
};

type PaymentMethod = { id: string; name: string };
type ShopBranding = {
    shopName: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
};

export function InvoiceView({ mode }: { mode: 'sale' | 'purchase' }) {
    const params = useParams<{ saleId?: string; purchaseId?: string }>();
    const id = mode === 'sale' ? params.saleId : params.purchaseId;
    const { formatMoney, formatDate, formatDateTime } = useShopFormat();
    const canProcessReturns = useHasPermission('PROCESS_RETURNS');
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [shop, setShop] = useState<ShopBranding | null>(null);
    const [receiptPrint, setReceiptPrint] = useState(false);
    const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
    const pendingReturnRequests = useRef(new Map<string, string>());

    const load = useCallback(async () => {
        if (!id) return;
        try {
            const result = await apiRequest<{
                sale?: Invoice;
                purchase?: Invoice;
                shop?: ShopBranding | null;
            }>(`/api/${mode === 'sale' ? 'sales' : 'purchases'}/${id}`);
            setInvoice(result.sale ?? result.purchase ?? null);
            setShop(result.shop ?? null);
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Invoice could not be loaded.');
        }
    }, [id, mode]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    useEffect(() => {
        const reset = () => {
            document.getElementById('receipt-print-page-size')?.remove();
        };
        window.addEventListener('afterprint', reset);
        return () => window.removeEventListener('afterprint', reset);
    }, []);

    useEffect(() => {
        if (!canProcessReturns) return;
        const timer = window.setTimeout(() => {
            void apiRequest<{ paymentMethods: PaymentMethod[] }>('/api/payment-methods')
                .then((result) => setMethods(result.paymentMethods))
                .catch(() => {});
        }, 0);
        return () => window.clearTimeout(timer);
    }, [canProcessReturns]);

    async function cancelInvoice() {
        if (
            !invoice ||
            !window.confirm(
                `Cancel ${invoice.invoiceNumber}? This will reverse its stock movement.`,
            )
        )
            return;
        setBusy(true);
        setError('');
        try {
            await apiRequest(
                `/api/${mode === 'sale' ? 'sales' : 'purchases'}/${invoice.id}/cancel`,
                { method: 'POST' },
            );
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Invoice could not be cancelled.');
        } finally {
            setBusy(false);
        }
    }

    async function returnItems(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!invoice || busy) return;
        setBusy(true);
        setError('');
        const form = new FormData(event.currentTarget);
        const items = invoice.items
            .map((item) => ({ item, quantity: String(form.get(`quantity-${item.id}`) ?? '0') }))
            .filter((line) => Number(line.quantity) > 0)
            .map(({ item, quantity }) =>
                mode === 'sale'
                    ? {
                          saleItemId: item.id,
                          quantity,
                          batchNumber: String(form.get(`batch-${item.id}`) ?? '').trim() || null,
                          expiresAt: form.get(`expiry-${item.id}`)
                              ? new Date(
                                    `${String(form.get(`expiry-${item.id}`))}T00:00:00.000Z`,
                                ).toISOString()
                              : null,
                      }
                    : { purchaseItemId: item.id, quantity },
            );
        if (!items.length) {
            setBusy(false);
            setError('Enter a return quantity for at least one product.');
            return;
        }
        const payload = {
            items,
            reason: form.get('reason') || null,
            refundMethodId: form.get('refundMethodId') || null,
        };
        const fingerprint = JSON.stringify({ mode, invoiceId: invoice.id, ...payload });
        let clientRequestId = pendingReturnRequests.current.get(fingerprint);
        if (!clientRequestId) {
            clientRequestId = createClientRequestId();
            pendingReturnRequests.current.set(fingerprint, clientRequestId);
        }
        try {
            await apiRequest(
                `/api/${mode === 'sale' ? 'sales' : 'purchases'}/${invoice.id}/returns`,
                { method: 'POST', body: JSON.stringify({ ...payload, clientRequestId }) },
            );
            pendingReturnRequests.current.delete(fingerprint);
            setReturnQuantities({});
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Return could not be processed.');
        } finally {
            setBusy(false);
        }
    }

    function setReceiptPageSize(enabled: boolean) {
        document.getElementById('receipt-print-page-size')?.remove();
        if (!enabled) return;
        const pageStyle = document.createElement('style');
        pageStyle.id = 'receipt-print-page-size';
        pageStyle.textContent = '@media print { @page { size: 80mm auto; margin: 0; } }';
        document.head.append(pageStyle);
    }

    function printWithInvoiceFilename(useReceiptSize: boolean) {
        if (!invoice) return;
        const previousTitle = document.title;
        document.title = invoice.invoiceNumber;
        window.addEventListener('afterprint', () => {
            document.title = previousTitle;
        }, { once: true });
        setReceiptPrint(useReceiptSize);
        window.setTimeout(() => {
            setReceiptPageSize(useReceiptSize);
            window.print();
        }, 100);
    }

    function printReceipt() {
        printWithInvoiceFilename(true);
    }

    function printInvoice() {
        printWithInvoiceFilename(false);
    }

    if (error) return <ErrorMessage>{error}</ErrorMessage>;
    if (!invoice) return <div className="h-40 animate-pulse rounded-2xl bg-muted sm:h-56" />;

    const party = invoice.customer ?? invoice.supplier;
    const date = invoice.soldAt ?? invoice.purchasedAt;
    const completedReturns = (invoice.returns ?? []).filter(
        (entry) => entry.status === 'COMPLETED',
    );
    const returnTotals = new Map<string, number>();
    for (const returned of completedReturns)
        for (const line of returned.items) {
            const key = line.saleItemId ?? line.purchaseItemId;
            if (key)
                returnTotals.set(
                    key,
                    Number(((returnTotals.get(key) ?? 0) + Number(line.quantity)).toFixed(6)),
                );
        }
    const returnedAmount = completedReturns.reduce((sum, entry) => sum + Number(entry.total), 0);
    const refundedAmount = completedReturns.reduce(
        (sum, entry) => sum + Number(entry.refundAmount),
        0,
    );
    const dueReducedByReturns = Math.max(0, returnedAmount - refundedAmount);
    const saleItemsById = new Map(invoice.items.map((item) => [item.id, item]));
    const isPaid = Number(invoice.dueAmount) <= 0;
    const invoiceQrValue = [
        `Store: ${shop?.shopName || 'StockPilot'}`,
        shop?.address ? `Store address: ${limitText(shop.address, 80)}` : '',
        shop?.phone ? `Store phone: ${shop.phone}` : '',
        `Type: ${mode === 'sale' ? 'Sales invoice' : 'Purchase invoice'}`,
        `Invoice: ${invoice.invoiceNumber}`,
        mode === 'purchase' && invoice.supplierInvoiceNumber
            ? `Supplier reference: ${invoice.supplierInvoiceNumber}`
            : '',
        date ? `Date: ${formatDateTime(date)}` : '',
        party?.name ? `${mode === 'sale' ? 'Customer' : 'Supplier'}: ${party.name}` : '',
        party?.phoneE164 ? `Contact phone: ${party.phoneE164}` : '',
        party?.address ? `Contact address: ${limitText(party.address, 80)}` : '',
        `Total: ${formatMoney(invoice.total)}`,
        `Paid: ${formatMoney(invoice.paidAmount)}`,
        `Due: ${formatMoney(invoice.dueAmount)}`,
        `Payment status: ${isPaid ? 'Fully paid' : 'Balance due'}`,
    ].filter(Boolean).join('\n');

    return (
        <div className={`min-w-0 space-y-4 sm:space-y-6 ${receiptPrint ? 'receipt-mode' : ''}`}>
            {/* ── Screen header action bar ── */}
            <div className="print:hidden">
                <PageHeader
                    eyebrow={mode === 'sale' ? 'Sales invoice' : 'Purchase invoice'}
                    title={limitText(invoice.invoiceNumber, 32)}
                    description={`${invoice.status.replaceAll('_', ' ')} · ${date ? formatDateTime(date) : ''}`}
                    action={
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                            <Link
                                href={`/${mode === 'sale' ? 'sales' : 'purchases'}`}
                                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted sm:flex-none sm:px-4"
                            >
                                Back
                            </Link>
                            <div className="flex min-h-10 items-center gap-0.5 rounded-xl border border-border p-0.5">
                                <button
                                    type="button"
                                    aria-pressed={!receiptPrint}
                                    onClick={() => setReceiptPrint(false)}
                                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${receiptPrint ? 'text-muted-foreground hover:bg-muted' : 'bg-teal-soft text-teal-strong'}`}
                                >
                                    A4
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={receiptPrint}
                                    onClick={() => setReceiptPrint(true)}
                                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${receiptPrint ? 'bg-teal-soft text-teal-strong' : 'text-muted-foreground hover:bg-muted'}`}
                                >
                                    80 mm
                                </button>
                            </div>
                            <Button
                                className="min-h-10 flex-1 text-sm sm:flex-none"
                                variant="outline"
                                onClick={printInvoice}
                            >
                                Print invoice
                            </Button>
                            <Button
                                className="min-h-10 flex-1 text-sm sm:flex-none"
                                variant="outline"
                                onClick={printReceipt}
                            >
                                Print 80 mm receipt
                            </Button>
                        </div>
                    }
                />
            </div>

            {error && (
                <div className="print:hidden">
                    <ErrorMessage>{error}</ErrorMessage>
                </div>
            )}

            {/* ── Printable Paper Document (No heavy boxes, clean typography & generous spacing) ── */}
            <Panel className="invoice-panel overflow-hidden">
                <div className={`print-document invoice-paper mx-auto w-full min-w-0 max-w-4xl break-words px-4 py-6 sm:px-8 sm:py-8 print:px-0 print:py-0 ${receiptPrint ? 'receipt-coupon-paper' : ''}`}>
                    {/* Header: Brand details + Invoice title */}
                    <header className="invoice-brand-header pb-4 sm:pb-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3.5">
                                {shop?.logoUrl ? (
                                    <span className="invoice-logo-frame grid shrink-0 place-items-center">
                                        <img
                                            className="invoice-shop-logo h-11 max-w-32 object-contain sm:h-14 sm:max-w-44"
                                            src={shop.logoUrl}
                                            alt={`${shop.shopName} logo`}
                                        />
                                    </span>
                                ) : null}
                                <div className="min-w-0 flex-1">
                                    <h1 className="receipt-shop-name text-lg font-bold tracking-tight text-foreground sm:text-2xl">
                                        {shop?.shopName || 'StockPilot'}
                                    </h1>
                                    {shop?.address && (
                                        <p className="truncate-receipt mt-0.5 text-xs text-muted-foreground leading-relaxed sm:max-w-md">
                                            {shop.address}
                                        </p>
                                    )}
                                    {shop?.phone && (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Tel: {shop.phone}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className={`invoice-number-block text-left sm:text-right ${mode === 'sale' && !receiptPrint ? 'a4-sales-invoice-meta' : ''} ${mode === 'purchase' && !receiptPrint ? 'a4-purchase-invoice-meta' : ''}`}>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {mode === 'sale' ? (receiptPrint ? 'Sales Receipt' : 'Sales Invoice') : 'Purchase Invoice'}
                                </p>
                                {receiptPrint && (
                                    <p className="receipt-doc-no mt-1 text-base font-bold tabular-nums text-foreground sm:text-xl">
                                        {invoice.invoiceNumber}
                                    </p>
                                )}
                                {mode === 'purchase' && receiptPrint && invoice.supplierInvoiceNumber && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Supplier Ref: {invoice.supplierInvoiceNumber}
                                    </p>
                                )}
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Date: {date ? formatDateTime(date) : ''}
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* Party information: clean 2-column without boxed backgrounds */}
                    <section className="receipt-party-section py-4 sm:py-5 border-t border-b border-border/70">
                        <div className="grid grid-cols-2 gap-4 sm:gap-8">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {mode === 'sale' ? 'Bill To' : 'Supplier'}
                                </p>
                                <p className="receipt-party-name mt-1 text-sm font-semibold capitalize text-foreground sm:text-base">
                                    {party?.name ?? (mode === 'sale' ? 'Walk-in customer' : 'Supplier')}
                                </p>
                                {party?.phoneE164 && (
                                    <p className="receipt-party-phone mt-0.5 text-xs text-muted-foreground">
                                        {party.phoneE164}
                                    </p>
                                )}
                                {party?.address && (
                                    <p className="truncate-receipt mt-0.5 text-xs leading-relaxed text-muted-foreground max-w-xs">
                                        {party.address}
                                    </p>
                                )}
                            </div>

                            <div className="min-w-0 text-right">
                                {!receiptPrint && (
                                    <div className="invoice-payment-reference a4-invoice-reference mb-3">
                                        <p className="receipt-doc-no text-sm font-bold tabular-nums text-foreground">
                                            {invoice.invoiceNumber}
                                        </p>
                                        {mode === 'purchase' && invoice.supplierInvoiceNumber && (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Supplier Ref: {invoice.supplierInvoiceNumber}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="payment-status-content">
                                    <p className="payment-status-label text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Payment Status
                                    </p>
                                    <p className={`payment-status-value mt-1 text-sm font-bold sm:text-base ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {isPaid ? 'Fully Paid' : 'Balance Due'}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {isPaid ? 'Amount Settled' : `${formatMoney(invoice.dueAmount)} due`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Items table: clear headers, borderless look, comfortable spacing */}
                    <div className="receipt-items-wrap overflow-x-auto py-2">
                        <table className={`a4-invoice-table w-full min-w-[500px] text-left text-xs sm:min-w-0 sm:text-sm print:min-w-0 ${!receiptPrint ? 'a4-print-invoice-table' : ''} ${mode === 'sale' && !receiptPrint ? 'a4-sales-invoice-table' : ''}`}>
                            <thead>
                                <tr className="border-b border-border/80 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {!receiptPrint && <th className="py-2.5 px-2 w-[24mm]">SKU</th>}
                                    <th className="py-2.5 px-2">Item</th>
                                    <th className="py-2.5 px-2 text-right">Qty</th>
                                    {completedReturns.length > 0 && (
                                        <>
                                            <th className="py-2.5 px-2 text-right">Ret</th>
                                            <th className="py-2.5 px-2 text-right">Net</th>
                                        </>
                                    )}
                                    <th className="py-2.5 px-2 text-right">Rate</th>
                                    <th className="py-2.5 px-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {invoice.items.map((item) => (
                                    <tr key={item.id} className="align-top">
                                        {!receiptPrint && <td className="break-words py-2.5 px-2 text-muted-foreground text-xs">{item.skuSnapshot}</td>}
                                        <td className="py-2.5 px-2">
                                            <p className={`font-medium text-foreground ${receiptPrint ? 'uppercase' : ''}`}>
                                                {item.productName}
                                            </p>
                                            {!receiptPrint && item.batchNumber && <p className="receipt-item-meta text-[11px] text-muted-foreground">
                                                Batch: {item.batchNumber}
                                            </p>}
                                        </td>
                                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                            {formatQuantity(item.quantity)} {item.unit.symbol}
                                        </td>
                                        {completedReturns.length > 0 && (
                                            <>
                                                <td className="py-2.5 px-2 text-right whitespace-nowrap text-muted-foreground">
                                                    {formatQuantity(returnTotals.get(item.id) ?? 0)}
                                                </td>
                                                <td className="py-2.5 px-2 text-right whitespace-nowrap font-medium">
                                                    {formatQuantity(
                                                        Math.max(
                                                            0,
                                                            Number(item.quantity) -
                                                                (returnTotals.get(item.id) ?? 0),
                                                        ),
                                                    )}
                                                </td>
                                            </>
                                        )}
                                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                            {formatMoney(
                                                mode === 'sale'
                                                    ? (item.unitPrice ?? '0')
                                                    : (item.unitCost ?? '0'),
                                            )}
                                        </td>
                                        <td className="py-2.5 px-2 text-right whitespace-nowrap font-semibold">
                                            {formatMoney(item.lineTotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary & Totals: clean aligned figures, no box */}
                    <section className="receipt-totals ml-auto mt-4 w-full max-w-xs space-y-1.5 text-xs sm:text-sm border-t border-border/80 pt-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="tabular-nums font-medium">{formatMoney(invoice.subtotal)}</span>
                        </div>
                        {Number(invoice.discountAmount) > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Discount</span>
                                <span className="tabular-nums">− {formatMoney(invoice.discountAmount)}</span>
                            </div>
                        )}
                        {invoice.additionalCost && Number(invoice.additionalCost) > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                                <span>Additional Cost</span>
                                <span className="tabular-nums">{formatMoney(invoice.additionalCost)}</span>
                            </div>
                        )}

                        <div className="receipt-grand-total flex items-center justify-between border-t-2 border-b-2 border-foreground/80 py-2 my-2 text-sm sm:text-base font-bold uppercase text-foreground">
                            <span>Grand Total</span>
                            <span className="tabular-nums text-base sm:text-lg">
                                {formatMoney(invoice.total)}
                            </span>
                        </div>

                        <div className="flex justify-between text-muted-foreground pt-0.5">
                            <span>Paid Amount</span>
                            <span className="tabular-nums font-medium text-foreground">{formatMoney(invoice.paidAmount)}</span>
                        </div>

                        <div className={`flex justify-between font-bold pt-0.5 ${isPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            <span>Balance Due</span>
                            <span className="tabular-nums">{formatMoney(invoice.dueAmount)}</span>
                        </div>
                    </section>

                    {/* Returns summary (if any) */}
                    {completedReturns.length > 0 && (
                        <section className="receipt-return-summary mt-6 border-t border-border/80 pt-4 text-xs">
                            <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                                Returns & Adjustments
                            </p>
                            <div className="mt-2 space-y-2">
                                {completedReturns.map((returned) => (
                                    <div key={returned.id} className="receipt-return flex justify-between border-b border-dashed border-border/60 pb-1.5">
                                        <div>
                                            <p className="font-medium">{returned.returnNumber}</p>
                                            {returned.reason && (
                                                <p className="text-[11px] text-muted-foreground">{returned.reason}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium tabular-nums">{formatMoney(returned.total)}</p>
                                            <p className="text-[11px] text-muted-foreground">{formatDateTime(returned.returnedAt)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Payment methods history */}
                    {invoice.payments.length > 0 && (
                        <section className="receipt-payment-history mt-5 border-t border-border/70 pt-3 text-xs">
                            <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                                Payment History
                            </p>
                            <div className="mt-1.5 divide-y divide-border/30">
                                {invoice.payments.map((payment, index) => (
                                    <div
                                        key={`${payment.paidAt}-${index}`}
                                        className="receipt-payment-row flex items-center justify-between py-1.5 text-muted-foreground"
                                    >
                                        <span>
                                            {payment.method.name} · {formatDate(payment.paidAt)}
                                            {payment.reference ? ` (${payment.reference})` : ''}
                                        </span>
                                        <span className="font-medium text-foreground tabular-nums">
                                            {formatMoney(Math.abs(Number(payment.amount)))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                            <p className="font-semibold text-foreground">Note:</p>
                            <p className="mt-0.5 leading-relaxed">{invoice.notes}</p>
                        </div>
                    )}

                    {/* ── A4 invoice details QR ── */}
                    {!receiptPrint && (
                        <div className="invoice-qr-block my-5 flex flex-col items-center justify-center text-center">
                            <div className="invoice-qr-code">
                                <QRCodeSVG value={invoiceQrValue} size={164} level="M" marginSize={4} />
                            </div>
                            <p className="mt-1 font-mono text-[10px] tracking-[0.25em] text-foreground">
                                {invoice.invoiceNumber}
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <footer className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                            Thank you for your {mode === 'sale' ? 'business' : 'partnership'}!
                        </p>
                        <p className="mt-0.5 text-[11px]">
                            Please retain this invoice for your warranty & records.
                        </p>
                    </footer>

                    {/* Subtle tear-off dashed line on thermal prints */}
                    <div className="receipt-cut-line hidden items-center gap-1.5 text-neutral-400 my-3" aria-hidden="true">
                        <span className="receipt-cut-rule" />
                        <Scissors className="receipt-cut-icon" size={14} strokeWidth={1.8} />
                        <span className="receipt-cut-rule" />
                    </div>
                </div>
            </Panel>

            {/* ── Screen-only Process Returns Form ── */}
            {canProcessReturns && ['COMPLETED', 'PARTIALLY_RETURNED'].includes(invoice.status) && (
                <Panel
                    className="print:hidden"
                    title={`${mode === 'sale' ? 'Process customer return' : 'Process supplier return'}`}
                    description={
                        mode === 'sale'
                            ? "Returned stock goes back into inventory. Any unpaid amount reduces the customer's due; any amount already paid is refunded as money out."
                            : 'Returned stock leaves inventory and goes back to the supplier. Any unpaid amount reduces what you owe; any amount already paid is received back from the supplier.'
                    }
                >
                    <form onSubmit={returnItems} className="min-w-0 space-y-4">
                        <div className="-mx-1 overflow-x-auto rounded-lg sm:mx-0">
                            <table className="w-full min-w-[850px] text-left text-xs sm:min-w-[980px] sm:text-sm">
                                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                                    <tr>
                                        <th className="px-2 py-3 sm:px-3">Product</th>
                                        <th className="px-2 py-3 sm:px-3">Sold / purchased</th>
                                        <th className="px-2 py-3 sm:px-3">Returned</th>
                                        <th className="px-2 py-3 sm:px-3">Remaining</th>
                                        <th className="px-2 py-3 sm:px-3">Return quantity</th>
                                        {mode === 'sale' && (
                                            <>
                                                <th className="px-2 py-3 sm:px-3">Return batch</th>
                                                <th className="px-2 py-3 sm:px-3">Expiry</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items.map((item) => {
                                        const returned = returnTotals.get(item.id) ?? 0;
                                        const remaining = Math.max(
                                            0,
                                            Number((Number(item.quantity) - returned).toFixed(6)),
                                        );
                                        return (
                                            <tr key={item.id} className="border-t border-border">
                                                <td
                                                    title={item.productName}
                                                    className="max-w-52 px-2 py-2 font-medium sm:px-3"
                                                >
                                                    <span className="print:hidden">
                                                        {limitText(item.productName, 42)}
                                                    </span>
                                                    <span className="hidden print:inline">
                                                        {item.productName}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                    {formatQuantity(item.quantity)}{' '}
                                                    {item.unit.symbol}
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                    {formatQuantity(returned)} {item.unit.symbol}
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                    {formatQuantity(remaining)} {item.unit.symbol}
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                    <input
                                                        name={`quantity-${item.id}`}
                                                        type="number"
                                                        min="0"
                                                        max={remaining}
                                                        step={
                                                            usesWholeQuantity(
                                                                item.unit.name ?? '',
                                                                item.unit.symbol,
                                                            )
                                                                ? '1'
                                                                : '0.01'
                                                        }
                                                        value={returnQuantities[item.id] ?? '0'}
                                                        onChange={(event) =>
                                                            setReturnQuantities((current) => ({
                                                                ...current,
                                                                [item.id]: event.target.value,
                                                            }))
                                                        }
                                                        disabled={remaining <= 0}
                                                        className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none transition focus:border-primary sm:w-28"
                                                    />
                                                </td>
                                                {mode === 'sale' && (
                                                    <>
                                                        <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                            <input
                                                                name={`batch-${item.id}`}
                                                                required={
                                                                    Boolean(
                                                                        item.product?.tracksBatch,
                                                                    ) &&
                                                                    Number(
                                                                        returnQuantities[item.id] ??
                                                                            0,
                                                                    ) > 0
                                                                }
                                                                disabled={remaining <= 0}
                                                                className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none transition focus:border-primary sm:w-28"
                                                                placeholder={
                                                                    item.product?.tracksBatch
                                                                        ? 'Required'
                                                                        : 'Optional'
                                                                }
                                                            />
                                                        </td>
                                                        <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                                                            <span className="block w-36">
                                                                <DateField
                                                                    dense
                                                                    name={`expiry-${item.id}`}
                                                                    required={
                                                                        Boolean(
                                                                            item.product
                                                                                ?.tracksExpiry,
                                                                        ) &&
                                                                        Number(
                                                                            returnQuantities[
                                                                                item.id
                                                                            ] ?? 0,
                                                                        ) > 0
                                                                    }
                                                                    disabled={remaining <= 0}
                                                                    placeholder={
                                                                        item.product?.tracksExpiry
                                                                            ? 'Required'
                                                                            : 'Optional'
                                                                    }
                                                                />
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <input
                                name="reason"
                                className="h-10 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/75 focus:border-primary"
                                placeholder="Return reason (optional)"
                            />
                            {methods.length > 0 && (
                                <select
                                    name="refundMethodId"
                                    className="h-10 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/75 focus:border-primary"
                                >
                                    <option value="">Refund method (if refund due)</option>
                                    {methods.map((method) => (
                                        <option key={method.id} value={method.id}>
                                            {limitText(method.name, 40)}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <Button
                                className="min-h-10 w-full sm:col-span-2 lg:col-span-1"
                                disabled={busy}
                            >
                                Complete return
                            </Button>
                        </div>
                    </form>
                </Panel>
            )}

            {canProcessReturns &&
                invoice.status === 'COMPLETED' &&
                Number(invoice.paidAmount) === 0 && (
                    <Panel
                        className="print:hidden"
                        title="Cancel unpaid invoice"
                        description="Cancellation is allowed only before any payment is recorded. The API reverses stock and writes the audit trail."
                    >
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => void cancelInvoice()}
                        >
                            Cancel invoice
                        </Button>
                    </Panel>
                )}
        </div>
    );
}
