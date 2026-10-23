'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/client-api';
import { ErrorMessage, PageHeader, Panel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { useHasPermission, useShopFormat } from '@/components/app/shop-context';
import { usesWholeQuantity } from '@/lib/quantity';

function formatQuantity(value: number | string) {
    return String(Number(value));
}

/** Keep long invoice labels readable while preserving the original value in the title tooltip. */
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
            clientRequestId = crypto.randomUUID();
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
    /** Chrome ignores named pages, so the 80 mm sheet size is injected only for the print job that needs it. */
    function setReceiptPageSize(enabled: boolean) {
        document.getElementById('receipt-print-page-size')?.remove();
        if (!enabled) return;
        const pageStyle = document.createElement('style');
        pageStyle.id = 'receipt-print-page-size';
        pageStyle.textContent = '@media print { @page { size: 80mm auto; margin: 0; } }';
        document.head.append(pageStyle);
    }
    function printReceipt() {
        setReceiptPrint(true);
        window.setTimeout(() => {
            setReceiptPageSize(true);
            window.print();
        }, 100);
    }
    function printInvoice() {
        setReceiptPrint(false);
        window.setTimeout(() => {
            setReceiptPageSize(false);
            window.print();
        }, 100);
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
    return (
        <div className={`min-w-0 space-y-4 sm:space-y-6 ${receiptPrint ? 'receipt-mode' : ''}`}>
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
                                <button type="button" aria-pressed={!receiptPrint} onClick={() => setReceiptPrint(false)} className={`h-9 rounded-[10px] px-3 text-xs font-semibold transition-colors ${receiptPrint ? 'text-muted-foreground hover:bg-muted' : 'bg-teal-soft text-teal-strong'}`}>A4</button>
                                <button type="button" aria-pressed={receiptPrint} onClick={() => setReceiptPrint(true)} className={`h-9 rounded-[10px] px-3 text-xs font-semibold transition-colors ${receiptPrint ? 'bg-teal-soft text-teal-strong' : 'text-muted-foreground hover:bg-muted'}`}>80 mm</button>
                            </div>
                            <Button className="min-h-10 flex-1 text-sm sm:flex-none" variant="outline" onClick={printInvoice}>
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
            <Panel className="invoice-panel overflow-hidden">
                <div className="print-document invoice-paper mx-auto w-full min-w-0 max-w-4xl break-words px-3 py-4 sm:px-6 sm:py-6 print:px-0 print:py-0">
                    <header className="invoice-brand-header flex min-w-0 flex-col items-start justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:gap-6 sm:pb-5">
                        <div className="flex min-w-0 w-full items-start gap-3 sm:w-auto">
                            {shop?.logoUrl ? (
                                <img
                                    className="invoice-shop-logo h-10 max-w-24 shrink-0 object-contain sm:h-14 sm:max-w-40"
                                    src={shop.logoUrl}
                                    alt={`${shop.shopName} logo`}
                                />
                            ) : (
                                <span className="invoice-shop-mark grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-base font-bold text-white sm:size-12 sm:rounded-2xl sm:text-lg">
                                    {(shop?.shopName || 'S').trim().charAt(0).toUpperCase()}
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <p
                                    title={shop?.shopName || 'StockPilot'}
                                    className="receipt-shop-name max-w-full truncate text-lg font-bold uppercase tracking-tight sm:text-2xl"
                                >
                                    {limitText(shop?.shopName || 'StockPilot', 42)}
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {mode === 'sale' ? 'Sales receipt' : 'Purchase invoice'}
                                </p>
                                {shop?.address && (
                                    <p
                                        title={shop.address}
                                        className="truncate-receipt mt-1 max-w-full break-words text-xs leading-4 text-muted-foreground sm:max-w-[26rem] sm:leading-5"
                                    >
                                        {limitText(shop.address, 84)}
                                    </p>
                                )}
                                {shop?.phone && (
                                    <p
                                        title={shop.phone}
                                        className="max-w-full truncate text-xs text-muted-foreground sm:max-w-72"
                                    >
                                        {limitText(shop.phone, 28)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="invoice-number-block w-full min-w-0 border-t border-dashed border-border pt-3 text-left sm:w-auto sm:max-w-[44%] sm:border-0 sm:pt-0 sm:text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {mode === 'sale' ? 'Invoice' : 'Purchase invoice'}
                            </p>
                            <p
                                title={invoice.invoiceNumber}
                                className="receipt-doc-no mt-1 max-w-full break-words text-base font-semibold sm:text-lg"
                            >
                                {limitText(invoice.invoiceNumber, 36)}
                            </p>
                            {mode === 'purchase' && invoice.supplierInvoiceNumber && (
                                <p
                                    title={invoice.supplierInvoiceNumber}
                                    className="max-w-full break-words text-xs text-muted-foreground"
                                >
                                    Supplier bill: {limitText(invoice.supplierInvoiceNumber, 36)}
                                </p>
                            )}
                            <p className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
                                {date ? formatDateTime(date) : ''}
                            </p>
                        </div>
                    </header>
                    <section className="grid min-w-0 gap-4 border-b border-border py-4 sm:grid-cols-2 sm:gap-6 sm:py-5">
                        <div className="min-w-0 rounded-xl  p-3 sm:p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {mode === 'sale' ? 'Customer' : 'Supplier'}
                            </p>
                            <p
                                title={party?.name ?? 'Walk-in customer'}
                                className="mt-2 max-w-full break-words text-sm font-semibold capitalize sm:text-base"
                            >
                                {limitText(party?.name ?? 'Walk-in customer', 48)}
                            </p>
                            {party?.phoneE164 && (
                                <p
                                    title={party.phoneE164}
                                    className="mt-1 max-w-full break-words text-sm text-muted-foreground"
                                >
                                    {limitText(party.phoneE164, 28)}
                                </p>
                            )}
                            {party?.address && (
                                <p
                                    title={party.address}
                                    className="truncate-receipt mt-1 max-w-full break-words text-sm leading-5 text-muted-foreground"
                                >
                                    {limitText(party.address, 90)}
                                </p>
                            )}
                        </div>
                        <div className="min-w-0 rounded-xl  p-3 sm:p-4 sm:text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Payment status
                            </p>
                            <p
                                className={`mt-2 inline-flex max-w-full rounded-full px-3 py-1 text-sm font-semibold ${Number(invoice.dueAmount) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                            >
                                {Number(invoice.dueAmount) > 0 ? 'Balance due' : 'Paid'}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
                                Created by shop staff
                            </p>
                        </div>
                    </section>
                    <div className="-mx-1 overflow-x-auto rounded-lg sm:mx-0">
                        <table className={`w-full min-w-[560px] text-left text-xs sm:min-w-0 sm:text-sm print:min-w-0 ${completedReturns.length > 0 ? 'receipt-items-returns' : ''}`}>
                            <thead className="border-b border-border bg-muted/35 text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                                <tr>
                                    <th className="px-2 py-3 sm:px-3">Product</th>
                                    <th className="px-2 py-3 sm:px-3">Quantity</th>
                                    {completedReturns.length > 0 && (
                                        <>
                                            <th className="px-2 py-3 sm:px-3">Returned</th>
                                            <th className="px-2 py-3 sm:px-3">Remaining</th>
                                        </>
                                    )}
                                    <th className="px-2 py-3 sm:px-3">Unit price</th>
                                    <th className="px-2 py-3 text-right sm:px-3">Line total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {invoice.items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="max-w-52 px-2 py-3 font-medium sm:px-3">
                                            <span title={item.productName} className="block max-w-52 break-words font-semibold">
                                                {limitText(item.productName, 42)}
                                            </span>
                                            <span className="receipt-item-meta mt-0.5 block max-w-52 break-words text-[10px] text-muted-foreground sm:text-xs">
                                                SKU {limitText(item.skuSnapshot, 24)}
                                                {item.batchNumber
                                                    ? ` · Batch ${limitText(item.batchNumber, 18)}`
                                                    : ''}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                            {formatQuantity(item.quantity)} {item.unit.symbol}
                                        </td>
                                        {completedReturns.length > 0 && (
                                            <>
                                                <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                                    {formatQuantity(returnTotals.get(item.id) ?? 0)}{' '}
                                                    {item.unit.symbol}
                                                </td>
                                                <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                                    {formatQuantity(
                                                        Math.max(
                                                            0,
                                                            Number(item.quantity) -
                                                                (returnTotals.get(item.id) ?? 0),
                                                        ),
                                                    )}{' '}
                                                    {item.unit.symbol}
                                                </td>
                                            </>
                                        )}
                                        <td className="whitespace-nowrap px-2 py-3 sm:px-3">
                                            {formatMoney(
                                                mode === 'sale'
                                                    ? (item.unitPrice ?? '0')
                                                    : (item.unitCost ?? '0'),
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-3 text-right sm:px-3">
                                            {formatMoney(item.lineTotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <section className="receipt-totals ml-auto mt-5 w-full max-w-sm space-y-2.5 text-sm sm:mt-6">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatMoney(invoice.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount</span>
                            <span>− {formatMoney(invoice.discountAmount)}</span>
                        </div>
                        {invoice.additionalCost && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Additional cost</span>
                                <span>{formatMoney(invoice.additionalCost)}</span>
                            </div>
                        )}
                        <div className="receipt-grand-total flex items-center justify-between gap-4 border-t-2 border-foreground/20 pt-3 text-base font-bold uppercase sm:text-lg">
                            <span>Grand total</span>
                            <span className="text-right tabular-nums">{formatMoney(invoice.total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Paid</span>
                            <span>{formatMoney(invoice.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>Due</span>
                            <span>{formatMoney(invoice.dueAmount)}</span>
                        </div>
                    </section>
                    {completedReturns.length > 0 && (
                        <section className="receipt-return-summary mt-6 border-t border-border pt-4 sm:mt-7">
                            <h2 className="text-sm font-semibold">Returns and refunds</h2>
                            <div className="mt-3 space-y-3">
                                {completedReturns.map((returned) => (
                                    <article
                                        key={returned.id}
                                        className="receipt-return border-b border-dashed border-border pb-3"
                                    >
                                        <div className="flex justify-between gap-2 text-sm font-medium">
                                            <span
                                                title={returned.returnNumber}
                                                className="min-w-0 break-words"
                                            >
                                                {limitText(returned.returnNumber, 34)}
                                            </span>
                                            <span>{formatDateTime(returned.returnedAt)}</span>
                                        </div>
                                        {returned.reason && (
                                            <p
                                                title={returned.reason}
                                                className="mt-1 max-w-full break-words text-xs leading-5 text-muted-foreground"
                                            >
                                                Reason: {limitText(returned.reason, 120)}
                                            </p>
                                        )}
                                        <ul className="mt-2 space-y-1 text-xs">
                                            {returned.items.map((line, index) => {
                                                const item = line.saleItemId
                                                    ? saleItemsById.get(line.saleItemId)
                                                    : undefined;
                                                return (
                                                    <li
                                                        key={`${returned.id}-${line.saleItemId ?? index}`}
                                                        className="flex min-w-0 flex-col justify-between gap-1 sm:flex-row sm:gap-2"
                                                    >
                                                        <span
                                                            title={item?.productName ?? 'Returned item'}
                                                            className="min-w-0 break-words"
                                                        >
                                                            {limitText(item?.productName ?? 'Returned item', 42)} ·{' '}
                                                            {formatQuantity(line.quantity)}{' '}
                                                            {line.unit?.symbol ?? item?.unit.symbol ?? ''}
                                                        </span>
                                                        <span className="shrink-0 font-medium tabular-nums sm:text-right">
                                                            {formatMoney(line.lineTotal ?? '0')}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <div className="mt-2 flex justify-between text-xs">
                                            <span>Invoice amount reduced</span>
                                            <span>{formatMoney(returned.total)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span>
                                                {mode === 'sale'
                                                    ? 'Refund paid to customer'
                                                    : 'Refund received from supplier'}
                                            </span>
                                            <span>{formatMoney(returned.refundAmount)}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <div className="mt-3 space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Invoice amount before returns
                                    </span>
                                    <span>
                                        {formatMoney(Number(invoice.total) + returnedAmount)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total returns</span>
                                    <span>{formatMoney(returnedAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {mode === 'sale' ? 'Refunds paid' : 'Refunds received'}
                                    </span>
                                    <span>{formatMoney(refundedAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {mode === 'sale'
                                            ? 'Customer balance reduced'
                                            : 'Supplier balance reduced'}
                                    </span>
                                    <span>{formatMoney(dueReducedByReturns)}</span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                                    <span>Invoice total after returns</span>
                                    <span>{formatMoney(invoice.total)}</span>
                                </div>
                            </div>
                        </section>
                    )}
                    {invoice.payments.length > 0 && (
                        <section className="mt-6 border-t border-border pt-4">
                            <h2 className="text-sm font-semibold">
                                {completedReturns.length > 0
                                    ? 'Payment and refund history'
                                    : 'Payment history'}
                            </h2>
                            {invoice.payments.map((payment, index) => (
                                <div
                                    key={`${payment.paidAt}-${index}`}
                                    className="flex flex-col justify-between gap-1 border-b border-border/50 py-3 text-sm last:border-0 sm:flex-row sm:gap-4"
                                >
                                    <span
                                        title={[payment.method.name, payment.reference]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        className="min-w-0 break-words leading-5 sm:pr-4"
                                    >
                                        {Number(payment.amount) < 0
                                            ? `${mode === 'sale' ? 'Refund paid' : 'Refund received'} via ${limitText(payment.method.name, 28)}`
                                            : limitText(payment.method.name, 28)}{' '}
                                        · {formatDate(payment.paidAt)}
                                        {payment.reference
                                            ? ` · ${limitText(payment.reference, 32)}`
                                            : ''}
                                    </span>
                                    <span className="shrink-0 font-medium tabular-nums">
                                        {formatMoney(Math.abs(Number(payment.amount)))}
                                    </span>
                                </div>
                            ))}
                        </section>
                    )}
                    {invoice.notes && (
                        <p
                            title={invoice.notes}
                            className="mt-5 max-w-full border-t border-border pt-4 text-sm leading-6 text-muted-foreground"
                        >
                            Note: {limitText(invoice.notes, 360)}
                        </p>
                    )}
                    <footer className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-5 text-muted-foreground sm:mt-8 sm:text-xs">
                        Thank you. Please keep this invoice for your records.
                    </footer>
                </div>
            </Panel>
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
                                                    {limitText(item.productName, 42)}
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
                                                            <input
                                                                name={`expiry-${item.id}`}
                                                                type="date"
                                                                required={
                                                                    Boolean(
                                                                        item.product?.tracksExpiry,
                                                                    ) &&
                                                                    Number(
                                                                        returnQuantities[item.id] ??
                                                                            0,
                                                                    ) > 0
                                                                }
                                                                disabled={remaining <= 0}
                                                                className="h-9 w-36 rounded-lg border border-border bg-background px-2 text-sm outline-none transition focus:border-primary"
                                                            />
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
