'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Activity,
    Boxes,
    ChevronDown,
    CircleHelp,
    FileChartColumnIncreasing,
    History,
    LayoutDashboard,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    Settings2,
    ShoppingBag,
    ShoppingCart,
    Truck,
    UsersRound,
    Wallet,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ErrorToastViewport } from '@/components/ui/error-toast';
import { ShopProvider } from '@/components/app/shop-context';
import { HeaderSearch } from '@/components/app/header-search';
import LogoMark from '@/components/brand/logo-mark';
import { APP_META } from '@/lib/constants/app';
import { refreshAuthSession } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const navigation = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, requires: ['VIEW_REPORTS'] },
    { label: 'Sales & POS', href: '/sales', icon: ShoppingCart, requires: ['CREATE_SALES'] },
    { label: 'Purchases', href: '/purchases', icon: ShoppingBag, requires: ['CREATE_PURCHASES'] },
    {
        label: 'Products',
        href: '/products',
        icon: Boxes,
        requires: ['MANAGE_PRODUCTS', 'CREATE_SALES', 'CREATE_PURCHASES'],
    },
    {
        label: 'Inventory',
        href: '/inventory',
        icon: Activity,
        requires: ['ADJUST_STOCK', 'VIEW_REPORTS', 'MANAGE_PRODUCTS'],
    },
    { label: 'Customers', href: '/customers', icon: UsersRound, requires: ['CREATE_SALES'] },
    { label: 'Suppliers', href: '/suppliers', icon: Truck, requires: ['CREATE_PURCHASES'] },
    {
        label: 'Reports',
        href: '/reports',
        icon: FileChartColumnIncreasing,
        requires: ['VIEW_REPORTS'],
    },
    {
        label: 'Activity log',
        href: '/activity',
        icon: History,
        requires: ['MANAGE_SETTINGS', 'MANAGE_USERS'],
    },
    {
        label: 'Expenses',
        href: '/expenses',
        icon: Wallet,
        requires: ['MANAGE_EXPENSES', 'VIEW_REPORTS'],
    },
    {
        label: 'Settings',
        href: '/settings',
        icon: Settings2,
        requires: ['MANAGE_SETTINGS', 'MANAGE_USERS'],
    },
    {
        label: 'Guide & setup',
        href: '/guide',
        icon: CircleHelp,
        requires: [
            'VIEW_REPORTS',
            'MANAGE_PRODUCTS',
            'ADJUST_STOCK',
            'CREATE_SALES',
            'CREATE_PURCHASES',
            'MANAGE_SETTINGS',
            'MANAGE_USERS',
        ],
    },
];

const COLLAPSE_STORAGE_KEY = 'stockpilot:sidebar-collapsed';

type AppShellProps = {
    user: { id: string; fullName: string; email: string; role: string };
    shopName: string;
    countryCode: string;
    currencyCode: string;
    locale: string;
    timezone: string;
    permissions: string[];
    children: ReactNode;
};

const roleLabels: Record<string, string> = {
    OWNER: 'Shop owner',
    MANAGER: 'Manager',
    CASHIER: 'Cashier',
    STOCK_CLERK: 'Stock clerk',
};

export function AppShell({
    user,
    shopName,
    countryCode,
    currencyCode,
    locale,
    timezone,
    permissions,
    children,
}: AppShellProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const pathname = usePathname();
    const router = useRouter();
    const initials = user.fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    const visibleNavigation = navigation.filter(
        (item) =>
            item.href !== '/settings' &&
            item.href !== '/guide' &&
            item.requires.some((permission) => permissions.includes(permission)),
    );
    const visibleBottomNavigation = navigation.filter(
        (item) =>
            (item.href === '/settings' || item.href === '/guide') &&
            item.requires.some((permission) => permissions.includes(permission)),
    );

    useEffect(() => {
        const handleUnauthorized = () => {
            router.replace('/login');
            router.refresh();
        };
        window.addEventListener('stockpilot:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('stockpilot:unauthorized', handleUnauthorized);
    }, [router]);

    // The preference is read after mount so the server render always matches the client's first paint.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true') setCollapsed(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
    }, [collapsed]);

    useEffect(() => {
        const handleToggleShortcut = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable]')) return;
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                setCollapsed((value) => !value);
            }
        };
        window.addEventListener('keydown', handleToggleShortcut);
        return () => window.removeEventListener('keydown', handleToggleShortcut);
    }, []);

    useEffect(() => {
        let lastRefreshAttempt = 0;
        const refreshWhileActive = () => {
            if (document.visibilityState !== 'visible' || Date.now() - lastRefreshAttempt < 60_000)
                return;
            lastRefreshAttempt = Date.now();
            void refreshAuthSession();
        };

        // Rebase the access-token lifetime on mount, then refresh before its 15-minute expiry.
        refreshWhileActive();
        const interval = window.setInterval(refreshWhileActive, 10 * 60 * 1000);
        window.addEventListener('focus', refreshWhileActive);
        document.addEventListener('visibilitychange', refreshWhileActive);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', refreshWhileActive);
            document.removeEventListener('visibilitychange', refreshWhileActive);
        };
    }, []);

    async function logout() {
        if (loggingOut) return;
        setLoggingOut(true);
        setLogoutError('');
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (!response.ok) throw new Error('Could not sign out. Please try again.');
            setLogoutOpen(false);
            setProfileOpen(false);
            setMenuOpen(false);
            router.replace('/login');
            router.refresh();
        } catch (caught) {
            setLogoutError(caught instanceof Error ? caught.message : 'Could not sign out. Please try again.');
        } finally {
            setLoggingOut(false);
        }
    }

    useEffect(() => {
        if (!logoutOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loggingOut) setLogoutOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [logoutOpen, loggingOut]);

    function renderNavItem(href: string, label: string, icon: typeof Settings2, active: boolean) {
        const Icon = icon;
        return (
            <Link
                key={href}
                href={href}
                title={label}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                    'nav-item group flex h-[42px] items-center gap-3 rounded-[14px] px-2.5 text-sm outline-none transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                    active
                        ? 'bg-primary font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/90'
                        : 'font-medium text-muted-foreground hover:bg-card hover:text-foreground',
                )}
            >
                <span
                    className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-[11px] bg-primary/5 text-muted-foreground ring-1 ring-primary/5 transition-colors',
                        active
                            ? 'bg-primary-foreground/15 text-primary-foreground ring-0'
                            : 'text-muted-foreground group-hover:text-primary',
                    )}
                >
                    <Icon size={18} strokeWidth={2} />
                </span>
                <span className="nav-label truncate">{label}</span>
                {active && (
                    <span aria-hidden="true" className="nav-active-indicator relative ml-auto grid size-2 shrink-0 place-items-center">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-70" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-primary-foreground" />
                    </span>
                )}
            </Link>
        );
    }

    return (
        <div className="app-shell-canvas flex min-h-screen bg-canvas text-foreground">
            <ErrorToastViewport />
            {menuOpen && (
                <button
                    aria-label="Close navigation"
                    className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}
            <aside
                aria-label="Workspace navigation"
                data-collapsed={collapsed ? 'true' : 'false'}
                className={cn(
                    'app-shell-nav fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col overflow-y-auto border-r border-shell-border/80 bg-sidebar px-3 py-4 transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0',
                    !collapsed && 'lg:w-[260px]',
                    menuOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="nav-logo-card flex items-center justify-between gap-2 px-1 py-2">
                    <Link
                        className="nav-brand flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        href="/"
                        aria-label={`${APP_META.name} home`}
                        onClick={() => setMenuOpen(false)}
                    >
                        <span className="nav-logo-emblem grid size-10 shrink-0 place-items-center text-primary">
                            <LogoMark className="size-9" />
                        </span>
                        <span className="nav-wordmark min-w-0">
                            <span className="block font-brand text-[17px] leading-none tracking-[0.04em] text-foreground">
                                STOCK PILOT
                            </span>
                            <span className="mt-1 block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Shop management
                            </span>
                        </span>
                    </Link>
                    <div className="nav-actions flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="Close navigation"
                            className="grid size-8 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-shell-border hover:bg-primary-soft hover:text-primary lg:hidden"
                            onClick={() => setMenuOpen(false)}
                        >
                            <X size={17} />
                        </button>
                    </div>
                </div>

                <div className="nav-menu mt-6 space-y-5 px-1">
                    {[
                        { label: 'Workspace', items: visibleNavigation.filter((item) => item.href === '/') },
                        { label: 'Operations', items: visibleNavigation.filter((item) => ['/sales', '/purchases', '/products', '/inventory'].includes(item.href)) },
                        { label: 'People', items: visibleNavigation.filter((item) => ['/customers', '/suppliers'].includes(item.href)) },
                        { label: 'Insights', items: visibleNavigation.filter((item) => ['/reports', '/activity', '/expenses'].includes(item.href)) },
                    ].filter((group) => group.items.length > 0).map((group) => (
                        <section key={group.label} className="py-1.5">
                            <h2 className="nav-section-title mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                {group.label}
                            </h2>
                            <nav aria-label={group.label} className="space-y-0.5">
                                {group.items.map(({ label, href, icon }) => {
                                    const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
                                    return renderNavItem(href, label, icon, active);
                                })}
                            </nav>
                        </section>
                    ))}
                </div>

                <div className="mt-auto pt-4">
                    <div className="nav-footer p-1.5">
                        {visibleBottomNavigation.length > 0 && (
                            <nav aria-label="Workspace links" className="space-y-0.5">
                                <p className="nav-section-title px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                                    Settings &amp; help
                                </p>
                                {visibleBottomNavigation.map(({ label, href, icon }) => {
                                    const active =
                                        pathname === href || pathname.startsWith(`${href}/`);
                                    return renderNavItem(href, label, icon, active);
                                })}
                            </nav>
                        )}
                        <div className="nav-shop-card mx-1 mt-1 border-t border-shell-border px-1.5 pb-1.5 pt-3">
                            <div className="nav-shop-row flex items-center gap-2.5">
                                <span
                                    title={shopName}
                                    className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-primary to-teal-strong text-xs font-bold text-primary-foreground shadow-sm dark:shadow-none"
                                >
                                    {shopName.trim().charAt(0).toUpperCase() || 'S'}
                                </span>
                                <span className="nav-shop-meta min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-semibold text-foreground">
                                        {shopName}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        Self-hosted workspace
                                    </p>
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="nav-note px-2 pt-2.5 text-center text-[11px] leading-4 text-muted-foreground/80">
                        Your shop data stays on this server
                    </p>
                </div>
            </aside>

            <div className="app-shell-frame flex min-w-0 flex-1 flex-col bg-transparent">
                <header className="app-shell-header sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-shell-border/50 bg-transparent px-4 backdrop-blur-xl sm:px-7 xl:px-10">
                    <div className="flex items-center gap-3">
                        <button
                            aria-label="Open navigation"
                            type="button"
                            onClick={() => setMenuOpen(true)}
                            className="grid size-10 place-items-center rounded-[13px] border border-shell-border/80 bg-card/85 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary lg:hidden"
                        >
                            <Menu size={18} />
                        </button>
                        <button
                            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            aria-pressed={collapsed}
                            type="button"
                            onClick={() => setCollapsed((value) => !value)}
                            className="hidden size-10 place-items-center rounded-[13px] border border-shell-border/80 bg-card/85 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary lg:grid"
                        >
                            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                        </button>
                        <HeaderSearch currencyCode={currencyCode} locale={locale} />
                        <p className="text-sm font-semibold text-foreground sm:hidden">
                            {navigation.find((item) => item.href === pathname)?.label ??
                                'StockPilot'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <ThemeToggle />
                        <span className="hidden h-8 w-px bg-line sm:block" />
                        <div className="relative">
                            <button
                                onClick={() => setProfileOpen((open) => !open)}
                                className="flex items-center gap-2 rounded-[15px] border border-shell-border/70 bg-card/80 py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:border-primary/25 hover:bg-card"
                                aria-expanded={profileOpen}
                                aria-label="Open profile menu"
                                type="button"
                            >
                                <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                    {initials}
                                </span>
                                <span className="hidden max-w-36 sm:block">
                                    <span className="block truncate text-xs font-semibold leading-4 text-foreground">
                                        {user.fullName}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground">
                                        {roleLabels[user.role] ?? user.role}
                                    </span>
                                </span>
                                <ChevronDown
                                    size={14}
                                    className="hidden text-muted-foreground sm:block"
                                />
                            </button>
                            {profileOpen && (
                                <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-line bg-card p-2 shadow-2xl">
                                    <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                                        {user.email}
                                    </p>
                                    <Link
                                        href="/settings?tab=team"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                                    >
                                        <Settings2 size={15} /> Account settings
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setProfileOpen(false);
                                            setLogoutError("");
                                            setLogoutOpen(true);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10"
                                        type="button"
                                    >
                                        <LogOut size={15} /> Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main
                    className={cn(
                        'mx-auto w-full px-4 py-6 sm:px-7 sm:py-8 xl:px-10',
                        !collapsed && 'max-w-[1440px]',
                    )}
                >
                    <ShopProvider
                        userId={user.id}
                        countryCode={countryCode}
                        currencyCode={currencyCode}
                        locale={locale}
                        timezone={timezone}
                        permissions={permissions}
                    >
                        {children}
                    </ShopProvider>
                </main>
            </div>

            {logoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
                    <button
                        type="button"
                        aria-label="Cancel sign out"
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
                        onClick={() => { if (!loggingOut) setLogoutOpen(false); }}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="logout-title"
                        aria-describedby="logout-description"
                        aria-busy={loggingOut}
                        className="relative isolate w-full max-w-[360px] overflow-hidden rounded-[22px] border border-line bg-card p-5 shadow-2xl shadow-slate-950/20 dark:shadow-none"
                    >
                        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 z-0 size-64 rounded-full bg-primary-soft/65 blur-3xl dark:bg-primary-soft/30" />
                        <div className="relative z-10">
                        <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
                                <span className="grid size-9 place-items-center rounded-[12px] bg-danger/10"><LogOut size={17} strokeWidth={1.9} /></span>
                                End session
                            </span>
                            <button
                                type="button"
                                aria-label="Close sign out dialog"
                                disabled={loggingOut}
                                onClick={() => setLogoutOpen(false)}
                                className="grid size-8 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            >
                                <X size={17} />
                            </button>
                        </div>
                        <h2 id="logout-title" className="mt-4 text-[19px] font-semibold tracking-tight text-foreground">
                            Sign out?
                        </h2>
                        <p id="logout-description" className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                            You’ll need your email and password to sign in again.
                        </p>
                        {logoutError && (
                            <p role="alert" className="mt-3 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                                {logoutError}
                            </p>
                        )}
                        <div className="mt-4 flex items-center gap-2.5 rounded-[13px] border border-line bg-background/70 px-3 py-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-xs font-semibold text-primary">
                                {shopName.trim().charAt(0).toUpperCase() || 'S'}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                                    Workspace
                                </span>
                                <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                                    {shopName}
                                </span>
                            </span>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button
                                variant="outline"
                                className="h-10 flex-1 px-3 text-[13px]"
                                onClick={() => setLogoutOpen(false)}
                                disabled={loggingOut}
                            >
                                Stay signed in
                            </Button>
                            <button
                                type="button"
                                onClick={() => void logout()}
                                disabled={loggingOut}
                                className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-danger px-3 text-[13px] font-semibold text-white transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
                            >
                                <LogOut size={15} />
                                {loggingOut ? 'Signing out…' : 'Sign out'}
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
