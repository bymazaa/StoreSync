'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Globe,
    History,
    Laptop,
    MapPin,
    Monitor,
    Network,
    RefreshCw,
    Search,
    ShieldCheck,
    Smartphone,
    X,
} from 'lucide-react';
import { apiRequest } from '@/lib/client-api';
import {
    ErrorMessage,
    inputClass,
    PageHeader,
    Panel,
    selectClass,
    TableEmpty,
} from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { useShopFormat, useShopPermissions } from '@/components/app/shop-context';

type Log = {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string;
    actorName: string;
    detail: string;
    ipAddress: string;
    userAgent?: string;
    createdAt: string;
};

type DeviceNetworkInfo = {
    ip: string;
    isLocal: boolean;
    type: string;
    network: string;
    isp: string;
    city: string;
    region: string;
    country: string;
    countryCode: string;
    timezone: string;
    latitude?: number | null;
    longitude?: number | null;
};

function parseUserAgent(ua?: string) {
    if (!ua) {
        return {
            os: 'Windows / Linux / macOS',
            browser: 'Web Browser',
            device: 'Desktop / POS Terminal',
            isMobile: false,
        };
    }

    let os = 'Unknown OS';
    if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Web Browser';
    if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Google Chrome';
    else if (/firefox\//i.test(ua)) browser = 'Mozilla Firefox';
    else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Apple Safari';
    else if (/opera|opr\//i.test(ua)) browser = 'Opera';

    let device = 'Desktop';
    const isMobile = /mobile|android|iphone|ipod/i.test(ua);
    if (/ipad|tablet/i.test(ua)) device = 'Tablet';
    else if (isMobile) device = 'Mobile Phone';

    return { os, browser, device, isMobile };
}
type Payload = {
    logs: Log[];
    total: number;
    page: number;
    pageSize: number;
    actors: { id: string; name: string }[];
};

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
    'auth.password_changed': 'Password changed',
    'auth.password_reset': 'Password reset from the server',
    'category.created': 'Category created',
    'category.updated': 'Category updated',
    'customer.created': 'Customer added',
    'customer.updated': 'Customer details changed',
    'expense.created': 'Expense recorded',
    'expense.voided': 'Expense voided',
    'inventory.adjusted': 'Stock adjusted',
    'payment_method.created': 'Payment method added',
    'payment_method.updated': 'Payment method changed',
    'product.created': 'Product created',
    'product.updated': 'Product changed',
    'purchase.cancelled': 'Purchase cancelled',
    'purchase.completed': 'Purchase completed',
    'purchase.payment_paid': 'Supplier payment recorded',
    'purchase.returned': 'Supplier return processed',
    'role_permissions.updated': 'Role permissions changed',
    'sale.cancelled': 'Sale cancelled',
    'sale.completed': 'Sale completed',
    'sale.payment_collected': 'Customer payment recorded',
    'sale.returned': 'Customer return processed',
    'settings.updated': 'Shop settings changed',
    'setup.owner_created': 'Shop setup finished',
    'supplier.created': 'Supplier added',
    'supplier.updated': 'Supplier details changed',
    'unit.created': 'Unit created',
    'unit.updated': 'Unit changed',
    'user.created': 'Staff account created',
    'user.deleted': 'Staff account deleted',
    'user.updated': 'Staff account changed',
};

const entityLabels: Record<string, string> = {
    auth: 'Sign in',
    category: 'Category',
    customer: 'Customer',
    expense: 'Expense',
    inventory: 'Stock',
    payment_method: 'Payment method',
    product: 'Product',
    purchase: 'Purchase',
    role_permissions: 'Roles & permissions',
    sale: 'Sale',
    settings: 'Shop settings',
    setup: 'Setup',
    supplier: 'Supplier',
    unit: 'Unit',
    user: 'Staff account',
};

const actionList = Object.keys(actionLabels).sort();
const entityList = Object.keys(entityLabels).sort((a, b) =>
    entityLabels[a].localeCompare(entityLabels[b]),
);

const actionLabel = (action: string) => actionLabels[action] ?? action.replaceAll('_', ' ');
const entityLabel = (entityType: string) =>
    entityLabels[entityType] ?? entityType.replaceAll('_', ' ');

function toneOf(action: string) {
    if (action.endsWith('.created')) return 'bg-teal-soft text-teal-strong';
    if (action.endsWith('.cancelled') || action.endsWith('.voided') || action.endsWith('.deleted'))
        return 'bg-danger/10 text-danger';
    if (action.includes('return') || action.endsWith('.adjusted'))
        return 'bg-amber-soft text-amber-strong';
    return 'bg-blue-soft text-blue-strong';
}

export function ActivityPage() {
    const { formatDateTime, timezone } = useShopFormat();
    const permissions = useShopPermissions();
    const canView = permissions.includes('MANAGE_SETTINGS') || permissions.includes('MANAGE_USERS');
    const [logs, setLogs] = useState<Log[]>([]);
    const [actors, setActors] = useState<Payload['actors']>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [actorId, setActorId] = useState('');
    const [entityType, setEntityType] = useState('');
    const [action, setAction] = useState('');
    const [search, setSearch] = useState('');
    const [committedSearch, setCommittedSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [deviceDetails, setDeviceDetails] = useState<DeviceNetworkInfo | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [copiedIp, setCopiedIp] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        setError('');
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (actorId) params.set('actorId', actorId);
        if (entityType) params.set('entityType', entityType);
        if (action) params.set('action', action);
        if (committedSearch) params.set('q', committedSearch);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        try {
            const payload = await apiRequest<Payload>(`/api/audit-logs?${params.toString()}`);
            setLogs(payload.logs ?? []);
            setActors(payload.actors ?? []);
            setTotal(payload.total ?? 0);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not load the activity log.');
        } finally {
            setBusy(false);
        }
    }, [action, actorId, committedSearch, entityType, from, page, to]);

    useEffect(() => {
        if (!canView) return;
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [canView, load]);

    useEffect(() => {
        if (!selectedLog) {
            setDeviceDetails(null);
            return;
        }
        let cancelled = false;
        setDetailsLoading(true);
        setCopiedIp(false);

        apiRequest<DeviceNetworkInfo>(
            `/api/ip-lookup?ip=${encodeURIComponent(selectedLog.ipAddress || '')}`,
        )
            .then((data) => {
                if (!cancelled) setDeviceDetails(data);
            })
            .catch(() => {
                if (!cancelled) {
                    setDeviceDetails({
                        ip: selectedLog.ipAddress || '127.0.0.1',
                        isLocal: true,
                        type: 'IPv4',
                        network: 'Local Store Network (LAN)',
                        isp: 'Internal POS Terminal',
                        city: 'Store Premises',
                        region: 'Local',
                        country: 'Local Network',
                        countryCode: 'LOC',
                        timezone: 'Local',
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setDetailsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedLog]);

    useEffect(() => {
        if (!selectedLog) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedLog(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLog]);

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, total);

    if (!canView)
        return (
            <PageHeader
                eyebrow="Records"
                title="Activity log"
                description="Only owners and managers can see who changed what."
            />
        );

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Records"
                title="Activity log"
                description="Every create, update and reversal in this shop — who did it, when, and what changed."
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Panel
                title="Find an entry"
                description="Filters use the shop timezone. Leave any field empty to include everything."
            >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Who did it
                        </span>
                        <select
                            value={actorId}
                            onChange={(event) => {
                                setActorId(event.target.value);
                                setPage(1);
                            }}
                            className={`${selectClass} mt-1.5`}
                        >
                            <option value="">Anyone</option>
                            {actors.map((actor) => (
                                <option key={actor.id} value={actor.id}>
                                    {actor.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Which area
                        </span>
                        <select
                            value={entityType}
                            onChange={(event) => {
                                setEntityType(event.target.value);
                                setPage(1);
                            }}
                            className={`${selectClass} mt-1.5`}
                        >
                            <option value="">Every area</option>
                            {entityList.map((value) => (
                                <option key={value} value={value}>
                                    {entityLabels[value]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Which action
                        </span>
                        <select
                            value={action}
                            onChange={(event) => {
                                setAction(event.target.value);
                                setPage(1);
                            }}
                            className={`${selectClass} mt-1.5`}
                        >
                            <option value="">Every action</option>
                            {actionList.map((value) => (
                                <option key={value} value={value}>
                                    {actionLabels[value]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            From date
                        </span>
                        <DateField
                            value={from}
                            onChange={(value) => {
                                setFrom(value);
                                setPage(1);
                            }}
                            className="mt-1.5"
                        />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            To date
                        </span>
                        <DateField
                            value={to}
                            onChange={(value) => {
                                setTo(value);
                                setPage(1);
                            }}
                            className="mt-1.5"
                        />
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Search text
                        </span>
                        <input
                            className={`${inputClass} mt-1.5 max-w-sm`}
                            placeholder="Invoice number, reason or record ID"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    setCommittedSearch(search.trim());
                                    setPage(1);
                                }
                            }}
                        />
                    </label>
                    <Button
                        variant="outline"
                        className="h-10"
                        icon={<Search size={15} />}
                        onClick={() => {
                            setCommittedSearch(search.trim());
                            setPage(1);
                        }}
                        disabled={busy}
                    >
                        Search
                    </Button>
                    {committedSearch && (
                        <Button
                            variant="ghost"
                            className="h-10 text-xs"
                            onClick={() => {
                                setSearch('');
                                setCommittedSearch('');
                                setPage(1);
                            }}
                        >
                            Clear “{committedSearch}”
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="h-10 text-xs"
                        icon={<RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />}
                        onClick={() => void load()}
                        disabled={busy}
                    >
                        Refresh
                    </Button>
                </div>
            </Panel>
            <Panel
                title={`${total.toLocaleString()} entries`}
                description={
                    total === 0
                        ? 'Nothing matches these filters yet.'
                        : `Showing ${firstShown}–${lastShown}.`
                }
            >
                <div className="overflow-hidden rounded-xl border border-border/70">
                    <div className="overflow-x-auto">
                        <table className="stock-table w-full min-w-[980px] text-left text-sm">
                            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2.5 font-semibold">When</th>
                                    <th className="px-3 py-2.5 font-semibold">Who</th>
                                    <th className="px-3 py-2.5 font-semibold">Action</th>
                                    <th className="px-3 py-2.5 font-semibold">Area / record</th>
                                    <th className="px-3 py-2.5 font-semibold">What changed</th>
                                    <th className="px-3 py-2.5 font-semibold text-right">Device & Network</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70">
                                {logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="align-top transition-colors hover:bg-teal-soft/40"
                                    >
                                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">
                                            {formatDateTime(log.createdAt)}
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-foreground">
                                            {log.actorName}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneOf(log.action)}`}
                                            >
                                                <span className="size-1.5 rounded-full bg-current" />
                                                {actionLabel(log.action)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {entityLabel(log.entityType)}
                                            {log.entityId && (
                                                <span
                                                    className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground"
                                                    title={log.entityId}
                                                >
                                                    #{log.entityId.slice(0, 8)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="max-w-md px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                                            {log.detail || '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-primary"
                                                >
                                                    <Monitor size={13} className="text-muted-foreground" />
                                                    <span>View device details</span>
                                                </button>
                                                {log.ipAddress ? (
                                                    <span className="font-mono text-[10px] text-muted-foreground">
                                                        IP: {log.ipAddress}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && !busy && (
                                    <tr>
                                        <td colSpan={6}>
                                            <TableEmpty>
                                                No activity matches these filters.
                                            </TableEmpty>
                                        </td>
                                    </tr>
                                )}
                                {logs.length === 0 && busy && (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="space-y-2 py-4">
                                                {Array.from({ length: 6 }, (_, index) => (
                                                    <div
                                                        key={index}
                                                        className="h-9 animate-pulse rounded-lg bg-muted"
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <History size={14} />
                        Entries are written by the app itself and cannot be edited or deleted from
                        the interface.
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="h-9 px-3"
                            icon={<ChevronLeft size={15} />}
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                            disabled={busy || page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            Page {page} of {pageCount}
                        </span>
                        <Button
                            variant="outline"
                            className="h-9 px-3"
                            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                            disabled={busy || page >= pageCount}
                        >
                            Next
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            </Panel>

            {selectedLog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="device-modal-title"
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                                    <Monitor size={20} />
                                </span>
                                <div>
                                    <h3 id="device-modal-title" className="text-lg font-semibold text-foreground">
                                        Device & Network Details
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Detailed origin, location, and device footprint for this action
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Action overview banner */}
                        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${toneOf(selectedLog.action)}`}
                                >
                                    <span className="size-1.5 rounded-full bg-current" />
                                    {actionLabel(selectedLog.action)}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {formatDateTime(selectedLog.createdAt)}
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-foreground">
                                <span className="font-semibold text-foreground">{selectedLog.actorName}</span>
                                {selectedLog.detail ? (
                                    <span className="text-muted-foreground"> — {selectedLog.detail}</span>
                                ) : null}
                            </div>
                        </div>

                        {/* Network & Location Section */}
                        <div className="mt-5 space-y-4">
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    <Globe size={14} className="text-primary" />
                                    <span>Network & Location Origin</span>
                                </h4>

                                <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                                    {/* IP Address Card */}
                                    <div className="rounded-xl border border-border/70 bg-background p-3.5 sm:col-span-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-medium text-muted-foreground">IP Address</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedLog.ipAddress) {
                                                        void navigator.clipboard.writeText(selectedLog.ipAddress);
                                                        setCopiedIp(true);
                                                        setTimeout(() => setCopiedIp(false), 2000);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                            >
                                                {copiedIp ? (
                                                    <>
                                                        <Check size={12} className="text-teal-strong" />
                                                        <span className="text-teal-strong">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={12} />
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                                            {selectedLog.ipAddress || '127.0.0.1'}
                                        </p>
                                        <span className="mt-1 inline-block text-[11px] text-muted-foreground">
                                            {deviceDetails?.isLocal
                                                ? 'Internal Shop POS Network (Loopback / LAN)'
                                                : `Public Network Address (${deviceDetails?.type || 'IPv4'})`}
                                        </span>
                                    </div>

                                    {/* Network / ISP */}
                                    <div className="rounded-xl border border-border/70 bg-background p-3.5">
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Network size={13} className="text-muted-foreground" />
                                            <span>Network / ISP</span>
                                        </span>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                            {detailsLoading ? (
                                                <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" />
                                            ) : (
                                                deviceDetails?.network || deviceDetails?.isp || 'Local Store Network'
                                            )}
                                        </p>
                                        <span className="text-[11px] text-muted-foreground">
                                            {detailsLoading
                                                ? 'Looking up provider…'
                                                : deviceDetails?.isLocal
                                                  ? 'In-store LAN connection'
                                                  : deviceDetails?.isp || 'Internet Service Provider'}
                                        </span>
                                    </div>

                                    {/* Location */}
                                    <div className="rounded-xl border border-border/70 bg-background p-3.5">
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <MapPin size={13} className="text-muted-foreground" />
                                            <span>Location</span>
                                        </span>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                            {detailsLoading ? (
                                                <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
                                            ) : (
                                                [deviceDetails?.city, deviceDetails?.country].filter(Boolean).join(', ') || 'Local Store'
                                            )}
                                        </p>
                                        <span className="text-[11px] text-muted-foreground">
                                            {detailsLoading
                                                ? 'Detecting region…'
                                                : deviceDetails?.region || 'Store Premises'}
                                        </span>
                                    </div>

                                    {/* Timezone & Security */}
                                    <div className="rounded-xl border border-border/70 bg-background p-3.5 sm:col-span-2">
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Network Timezone:</span>
                                                <p className="mt-0.5 font-medium text-foreground">
                                                    {detailsLoading ? 'Loading…' : deviceDetails?.timezone || timezone || 'Local'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Network Security:</span>
                                                <p className="mt-0.5 flex items-center gap-1 font-medium text-teal-strong">
                                                    <ShieldCheck size={13} />
                                                    <span>{deviceDetails?.isLocal ? 'Internal LAN Verified' : 'External Connection'}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Device & Client Section */}
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    <Laptop size={14} className="text-primary" />
                                    <span>Client & Device Info</span>
                                </h4>

                                {(() => {
                                    const parsed = parseUserAgent(selectedLog.userAgent);
                                    return (
                                        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl border border-border/70 bg-background p-3">
                                                <span className="text-[11px] text-muted-foreground">Device Type</span>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                                    {parsed.isMobile ? <Smartphone size={14} /> : <Monitor size={14} />}
                                                    <span>{parsed.device}</span>
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-border/70 bg-background p-3">
                                                <span className="text-[11px] text-muted-foreground">Operating System</span>
                                                <p className="mt-0.5 text-sm font-semibold text-foreground">
                                                    {parsed.os}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-border/70 bg-background p-3">
                                                <span className="text-[11px] text-muted-foreground">Browser</span>
                                                <p className="mt-0.5 text-sm font-semibold text-foreground">
                                                    {parsed.browser}
                                                </p>
                                            </div>

                                            {selectedLog.userAgent ? (
                                                <div className="rounded-xl border border-border/70 bg-background p-3 sm:col-span-3">
                                                    <span className="text-[11px] font-medium text-muted-foreground">
                                                        User Agent String
                                                    </span>
                                                    <p className="mt-1 break-all rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                                                        {selectedLog.userAgent}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 flex justify-end border-t border-border/70 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedLog(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
