'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LogoMark from '@/components/brand/logo-mark';
import {
    ArrowRight,
    BadgeCheck,
    Boxes,
    Building2,
    Check,
    CheckCircle2,
    CircleSlash,
    Copy,
    CreditCard,
    Globe,
    Layers,
    LogIn,
    Mail,
    MapPin,
    Menu,
    MessageCircle,
    Package,
    Phone,
    PhoneCall,
    Printer,
    ScanBarcode,
    Send,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    Store,
    TrendingUp,
    Users,
    X,
    Zap,
} from 'lucide-react';

export function LandingPage() {
    // Default language is English as requested ("home page defult english rakho")
    const [lang, setLang] = useState<'en' | 'bn'>('en');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const PHONE_NUMBER = '01912056163';
    const EMAIL_ADDRESS = 'devmazaharul@gmail.com';
    const WHATSAPP_LINK = 'https://wa.me/8801912056163?text=Hi%20StockPilot,%20I%20am%20interested%20in%20your%20POS%20system.';

    useEffect(() => {
        try {
            const saved = localStorage.getItem('stockpilot_lang');
            if (saved === 'en' || saved === 'bn') {
                setLang(saved);
            }
        } catch {
            // fallback to default 'en'
        }
    }, []);

    function toggleLang(newLang: 'en' | 'bn') {
        setLang(newLang);
        try {
            localStorage.setItem('stockpilot_lang', newLang);
        } catch {}
    }

    function copyToClipboard(text: string, field: string) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        }
    }

    const isEn = lang === 'en';

    return (
        <div className="relative min-h-screen bg-canvas text-foreground antialiased selection:bg-primary/20 selection:text-primary">
            {/* Ambient Background Glows */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed -top-40 right-0 size-[550px] rounded-full bg-primary/10 blur-[130px] dark:bg-primary/15"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none fixed top-1/2 -left-48 size-[600px] rounded-full bg-teal-500/10 blur-[140px] dark:bg-teal-500/10"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none fixed -bottom-40 right-1/4 size-[500px] rounded-full bg-emerald-500/10 blur-[140px]"
            />

            {/* ── TOP NAVBAR ── */}
            <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Brand Logo matching sidebar */}
                    <Link href="/" className="flex items-center gap-3 group" aria-label="StockPilot Home">
                        <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-200 group-hover:scale-105">
                            <LogoMark className="size-6.5" />
                        </span>
                        <div>
                            <span className="font-brand block text-xl font-bold tracking-tight text-foreground leading-none">
                                STOCK <span className="text-primary">PILOT</span>
                            </span>
                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Smart POS &amp; Inventory
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav Links */}
                    <nav className="hidden items-center gap-7 lg:flex">
                        <a
                            href="#features"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {isEn ? 'Features' : 'সুবিধাসমূহ'}
                        </a>
                        <a
                            href="#what-we-do"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {isEn ? 'What We Do' : 'কী করে ও করে না'}
                        </a>
                        <a
                            href="#who-its-for"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {isEn ? "Who It's For" : 'কারা ব্যবহার করবে'}
                        </a>
                        <a
                            href="#services"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {isEn ? 'Modules' : 'মডিউল'}
                        </a>
                        <a
                            href="#contact"
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {isEn ? 'Contact' : 'যোগাযোগ'}
                        </a>
                    </nav>

                    {/* Top Right Actions (Language Switcher, Phone, Login) */}
                    <div className="hidden items-center gap-3 sm:flex">
                        {/* Language Switcher Pill */}
                        <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 text-xs font-semibold shadow-xs">
                            <Globe size={13} className="ml-1.5 mr-1 text-muted-foreground" />
                            <button
                                type="button"
                                onClick={() => toggleLang('en')}
                                className={`rounded-lg px-2.5 py-1 transition-all ${
                                    isEn
                                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                aria-label="Switch to English"
                            >
                                English
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleLang('bn')}
                                className={`rounded-lg px-2.5 py-1 transition-all ${
                                    !isEn
                                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                aria-label="বাংলা ভাষায় পরিবর্তন করুন"
                            >
                                বাংলা
                            </button>
                        </div>

                        <a
                            href={`tel:${PHONE_NUMBER}`}
                            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-card px-3.5 text-xs font-semibold text-muted-foreground shadow-2xl shadow-gray-100 transition-colors hover:bg-muted hover:text-foreground dark:shadow-none"
                        >
                            <Phone size={14} className="text-primary" />
                            <span>{PHONE_NUMBER}</span>
                        </a>

                        <Link
                            href="/login"
                            className="inline-flex h-10.5 items-center gap-2 rounded-2xl bg-primary px-5.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all duration-200 hover:bg-primary-strong active:scale-95"
                        >
                            <LogIn size={15} />
                            <span>{isEn ? 'Sign In' : 'লগইন করুন'}</span>
                        </Link>
                    </div>

                    {/* Mobile Controls */}
                    <div className="flex items-center gap-2 lg:hidden">
                        {/* Mobile Language Switcher */}
                        <button
                            type="button"
                            onClick={() => toggleLang(isEn ? 'bn' : 'en')}
                            className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-foreground"
                            title="Toggle English / বাংলা"
                        >
                            <Globe size={13} className="text-primary" />
                            <span>{isEn ? 'বাংলা' : 'EN'}</span>
                        </button>

                        <Link
                            href="/login"
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-md shadow-primary/25"
                        >
                            <LogIn size={14} />
                            {isEn ? 'Sign In' : 'লগইন'}
                        </Link>

                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="grid size-9 place-items-center rounded-xl border border-border text-foreground hover:bg-muted"
                            aria-label="Toggle navigation"
                        >
                            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                    <div className="border-b border-border bg-card px-6 py-5 lg:hidden">
                        <nav className="flex flex-col gap-3.5">
                            <a
                                href="#features"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                {isEn ? 'Features' : 'সুবিধাসমূহ'}
                            </a>
                            <a
                                href="#what-we-do"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                {isEn ? 'What We Do' : 'কী করে ও করে না'}
                            </a>
                            <a
                                href="#who-its-for"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                {isEn ? "Who It's For" : 'কারা ব্যবহার করবে'}
                            </a>
                            <a
                                href="#services"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                {isEn ? 'Modules' : 'মডিউল'}
                            </a>
                            <a
                                href="#contact"
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                {isEn ? 'Contact' : 'যোগাযোগ'}
                            </a>
                            <div className="pt-2 flex flex-col gap-2">
                                <Link
                                    href="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25"
                                >
                                    <LogIn size={16} /> {isEn ? 'Sign In to Workspace' : 'লগইন পেজে যান'}
                                </Link>
                            </div>
                        </nav>
                    </div>
                )}
            </header>

            {/* ── HERO SECTION ── */}
            <section id="features" className="relative overflow-hidden pt-12 pb-18 lg:pt-20 lg:pb-28">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
                        {/* Hero Text */}
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                                <Sparkles size={14} />
                                <span>
                                    {isEn
                                        ? 'Next-Gen Retail POS & Inventory Engine'
                                        : 'আধুনিক রিটেইল ও শপ ম্যানেজমেন্ট সলিউশন'}
                                </span>
                            </div>

                            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
                                {isEn ? (
                                    <>
                                        Business Accounting, Stock &amp; Sales —{' '}
                                        <span className="bg-gradient-to-r from-primary via-teal-500 to-emerald-400 bg-clip-text text-transparent">
                                            Unified in Real-Time
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        ব্যবসার হিসাব, স্টক ও বিক্রি — এখন{' '}
                                        <span className="bg-gradient-to-r from-primary via-teal-500 to-emerald-400 bg-clip-text text-transparent">
                                            এক প্ল্যাটফর্মে নিমিষেই
                                        </span>
                                    </>
                                )}
                            </h1>

                            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                                {isEn
                                    ? 'StockPilot is an ultra-fast POS and inventory management platform. Barcode scanning, real-time stock sync, customer ledger khata, and accurate profit/loss reports. Zero bloat, zero recurring commission.'
                                    : 'স্টকপাইলট (StockPilot) একটি সুপারফাস্ট POS ও ইনভেন্টরি সফটওয়্যার। বারকোড স্ক্যানিং, লাইভ স্টক আপডেট, বাকি খাতা ও নির্ভুল লাভ-ক্ষতির হিসাব রাখুন চোখের পলকে। কোনো জটিলতা নেই, নেই কোনো মাসিক হিডেন চার্জ।'}
                            </p>

                            {/* Call to Actions */}
                            <div className="mt-8 flex flex-wrap items-center gap-3.5">
                                <Link
                                    href="/login"
                                    className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-7 text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:bg-primary-strong active:scale-95"
                                >
                                    <span>{isEn ? 'Sign In to Workspace' : 'সরাসরি লগইন করুন'}</span>
                                    <ArrowRight size={16} />
                                </Link>
                                <a
                                    href={`tel:${PHONE_NUMBER}`}
                                    className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-2xl shadow-gray-100 transition-colors hover:bg-muted dark:shadow-none"
                                >
                                    <PhoneCall size={16} className="text-primary" />
                                    <span>{PHONE_NUMBER}</span>
                                </a>
                                <a
                                    href="#demo"
                                    className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <Sparkles size={15} className="text-primary" />
                                    <span>{isEn ? 'View Live Demo' : 'ফ্রি ডেমো দেখুন'}</span>
                                </a>
                            </div>

                            {/* Trust Metrics Badge Row */}
                            <div className="mt-10 grid grid-cols-2 gap-3 border-t border-border/80 pt-6 sm:grid-cols-4">
                                <div className="space-y-1">
                                    <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">0ms</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn ? 'Lightning POS Billing' : 'সুপারফাস্ট POS বিলিং'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xl font-bold tracking-tight text-primary sm:text-2xl">100%</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn ? 'Accurate Stock Sync' : 'নির্ভুল স্টক ট্র্যাকিং'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">80mm + A4</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn ? 'Thermal & Invoice Print' : 'থার্মাল ও ইনভয়েস প্রিন্ট'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Offline</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn ? 'Local & Cloud Backup' : 'লোকাল বা ক্লাউড ব্যাকআপ'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Hero Interactive Visual Card */}
                        <div className="relative">
                            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card/95 p-6 shadow-2xl shadow-gray-100 dark:shadow-none sm:p-8">
                                {/* Visual POS Header */}
                                <div className="flex items-center justify-between border-b border-border/70 pb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-3 rounded-full bg-rose-500/80" />
                                        <div className="size-3 rounded-full bg-amber-500/80" />
                                        <div className="size-3 rounded-full bg-emerald-500/80" />
                                        <span className="ml-2 font-mono text-xs font-semibold text-muted-foreground">
                                            POS Terminal · Live Counter
                                        </span>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Online
                                    </span>
                                </div>

                                {/* Mock POS Quick Lines */}
                                <div className="mt-5 space-y-2.5">
                                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/40 p-3.5 text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                                                <Package size={15} />
                                            </span>
                                            <div>
                                                <p className="font-semibold text-foreground">Miniket Rice Premium</p>
                                                <p className="text-[11px] text-muted-foreground">SKU: RICE-001 · 25 kg Bag</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-foreground">৳ 1,850.00</p>
                                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-medium">Qty: 1</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/40 p-3.5 text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className="grid size-8 place-items-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                                <Package size={15} />
                                            </span>
                                            <div>
                                                <p className="font-semibold text-foreground">Mustard Oil 1L</p>
                                                <p className="text-[11px] text-muted-foreground">SKU: OIL-012 · 3 Bottles</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-foreground">৳ 720.00</p>
                                            <span className="rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] text-teal-600 dark:text-teal-400 font-medium">Qty: 3</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/40 p-3.5 text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className="grid size-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                <Package size={15} />
                                            </span>
                                            <div>
                                                <p className="font-semibold text-foreground">Full Cream Milk 500ml</p>
                                                <p className="text-[11px] text-muted-foreground">SKU: DAIRY-004 · 2 Pcs</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-foreground">৳ 90.00</p>
                                            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">Qty: 2</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bill Total Bar */}
                                <div className="mt-5 rounded-2xl bg-primary/10 border border-primary/20 p-4">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{isEn ? 'Subtotal (3 items)' : 'সাবটোটাল (৩ আইটেম)'}</span>
                                        <span className="font-medium text-foreground">৳ 2,660.00</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{isEn ? 'Discount' : 'ডিসকাউন্ট'}</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">− ৳ 60.00</span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between border-t border-primary/20 pt-2.5">
                                        <span className="text-sm font-bold text-foreground">{isEn ? 'Grand Total' : 'মোট বিল'}</span>
                                        <span className="text-xl font-extrabold text-primary">৳ 2,600.00</span>
                                    </div>
                                </div>

                                {/* Quick Shortcuts Footer */}
                                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">F2</kbd>
                                        {isEn ? 'Barcode Scan' : 'বারকোড স্ক্যান'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">F4</kbd>
                                        {isEn ? 'Cash Tender' : 'ক্যাশ বিলিং'}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                        <BadgeCheck size={14} /> {isEn ? '80mm Receipt Ready' : '৮০mm রিসিট প্রিন্ট'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION: WHAT WE DO & WHAT WE DO NOT DO ── */}
            <section id="what-we-do" className="border-t border-border/80 bg-muted/20 py-18 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                            <ShieldCheck size={14} />
                            {isEn ? 'Transparency & Reliability' : 'স্বচ্ছতা ও নির্ভরতা'}
                        </span>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {isEn ? (
                                <>
                                    What StockPilot <span className="text-primary">Does</span> &amp; What It{' '}
                                    <span className="text-rose-500">Does NOT Do</span>
                                </>
                            ) : (
                                <>
                                    StockPilot <span className="text-primary">কী করে</span> এবং{' '}
                                    <span className="text-rose-500">কী করে না</span>
                                </>
                            )}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {isEn
                                ? 'No confusing jargon or hidden conditions. Designed strictly for what counters actually need.'
                                : 'আমরা জটিল শব্দ বা মিথ্যা প্রতিশ্রুতির বদলে দোকানে বাস্তব কাজে যা প্রয়োজন তা নিশ্চিত করি।'}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-8 lg:grid-cols-2">
                        {/* What StockPilot DOES */}
                        <div className="rounded-[32px] border border-emerald-500/30 bg-card p-6 shadow-2xl shadow-gray-100 dark:shadow-none sm:p-8">
                            <div className="flex items-center gap-3">
                                <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={24} />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground sm:text-xl">
                                        {isEn ? 'What StockPilot Does' : 'StockPilot কী করে (What It Does)'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn
                                            ? 'Essential features included for day-to-day shop management'
                                            : 'আপনার দোকান পরিচালনায় যেসব সুবিধা পাবেন'}
                                    </p>
                                </div>
                            </div>

                            <ul className="mt-6 space-y-4">
                                {(isEn
                                    ? [
                                          {
                                              title: 'Ultra-Fast POS Billing & Barcode Scanning',
                                              desc: 'Press F2 to scan or type immediately. Supports Cash, Card, and Mobile payments smoothly.',
                                          },
                                          {
                                              title: 'Multi-Unit & Real-time Stock Sync',
                                              desc: 'Automatic conversions (sack-kg, box-piece, strip-tablet). Instant low-stock alerts before items run out.',
                                          },
                                          {
                                              title: 'Batch Number & Expiry Date Tracking',
                                              desc: 'Crucial for pharmacies and grocery items. Pre-warns about expiring batches to avoid losses.',
                                          },
                                          {
                                              title: '80mm Thermal Receipt & A4 Invoices',
                                              desc: 'Instant branded receipts with shop logo. Clean item, qty, and rate format with subtotal and due summary.',
                                          },
                                          {
                                              title: 'Customer & Supplier Khata Ledger',
                                              desc: 'Track outstanding customer balances with aging breakdown (0-30, 31-60, 60+ days) and payment receipts.',
                                          },
                                          {
                                              title: 'Daily Profit/Loss & Expense Tracking (P&L)',
                                              desc: 'Log shop rent, electricity, and staff wages to calculate your true net business profit.',
                                          },
                                          {
                                              title: 'Staff Accounts & Fine-Grained Audit Trail',
                                              desc: 'Detailed log of who logged in, what fields were modified, and when—down to the exact second.',
                                          },
                                          {
                                              title: 'Offline LAN & Cloud Backup Protection',
                                              desc: 'Download one-click database backups to keep your business records 100% in your own possession.',
                                          },
                                      ]
                                    : [
                                          {
                                              title: 'বিদ্যুৎগতিতে POS বিলিং ও বারকোড স্ক্যানিং',
                                              desc: 'কীবোর্ডের F2 প্রেস করে সরাসরি স্ক্যানিং বা টাইপিং শুরু। ক্যাশ, বিকাশ ও কার্ড পেমেন্ট সাপোর্ট।',
                                          },
                                          {
                                              title: 'মাল্টি-ইউনিট ও লাইভ স্টক হিসাব',
                                              desc: 'একই পণ্যের বস্তা-কেজি বা কার্টুন-পিস অটোমেটিক কনভার্ট হয়। স্টক ফুরিয়ে যাওয়ার আগেই এলার্ট পাবেন।',
                                          },
                                          {
                                              title: 'ব্যাচ নম্বর ও মেয়াদ (Expiry) ট্র্যাকিং',
                                              desc: 'ফার্মেসি বা খাদ্যপণ্যের কোন লটের মেয়াদ কবে শেষ তা ইনভেন্টরিতে সর্বদা স্পষ্টভাবে মনিটর করা যায়।',
                                          },
                                          {
                                              title: '৮০mm থার্মাল রিসিট ও A4 ইনভয়েস প্রিন্ট',
                                              desc: 'দোকানের নাম ও লোগোসহ গ্রাহককে তাত্ক্ষণিক রিসিট প্রদান। রো-তে আইটেম, কোয়ান্টিটি ও রেটের পরিষ্কার বিন্যাস।',
                                          },
                                          {
                                              title: 'কাস্টমার ও সাপ্লায়ার বাকি খাতা (Ledger)',
                                              desc: 'কার কত বাকি, কতদিন যাবত বাকি (Due Aging 0-30, 31-60 দিন) সব এক ক্লিকে স্পষ্ট দেখা যায়।',
                                          },
                                          {
                                              title: 'দৈনিক লাভ-ক্ষতি ও ব্যয় হিসাব (P&L Reports)',
                                              desc: 'দোকান ভাড়া, কর্মচারীর বেতন ও অন্যান্য খরচের হিসাব রেখে আসল নিট লাভের সঠিক হিসাব।',
                                          },
                                          {
                                              title: 'স্টাফ একাউন্ট ও অডিট লগস (Audit Trail)',
                                              desc: 'ক্যাশিয়ার কোন ফিল্ড বা প্রাইস পরিবর্তন করেছে, কখন লগইন করেছে তার শতভাগ নির্ভুল হিস্ট্রি।',
                                          },
                                          {
                                              title: 'অফলাইন ও ক্লাউড ডাটা ব্যাকআপ',
                                              desc: 'এক ক্লিকে ফুল ডাটাবেস ব্যাকআপ ডাউনলোড করে পেনড্রাইভ বা ক্লাউডে নিজের কাছে সুরক্ষিত রাখার সুবিধা।',
                                          },
                                      ]
                                ).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm">
                                        <span className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            <Check size={13} strokeWidth={3} />
                                        </span>
                                        <div>
                                            <strong className="font-semibold text-foreground">{item.title}: </strong>
                                            <span className="text-muted-foreground">{item.desc}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* What StockPilot DOES NOT DO */}
                        <div className="rounded-[32px] border border-rose-500/30 bg-card p-6 shadow-2xl shadow-gray-100 dark:shadow-none sm:p-8">
                            <div className="flex items-center gap-3">
                                <span className="grid size-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
                                    <CircleSlash size={24} />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold text-foreground sm:text-xl">
                                        {isEn ? 'What StockPilot Does NOT Do' : 'StockPilot কী করে না (What It Does NOT Do)'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {isEn
                                            ? 'Zero hidden fees, commissions, or unnecessary complexity'
                                            : 'কোনো লুকানো শর্ত বা অপ্রয়োজনীয় জটিলতা নেই'}
                                    </p>
                                </div>
                            </div>

                            <ul className="mt-6 space-y-4">
                                {(isEn
                                    ? [
                                          {
                                              title: 'No Per-Sale Hidden Cuts or Transaction Fees',
                                              desc: '100% of your sales revenue and profit remains yours. No percentage is ever deducted from your bills.',
                                          },
                                          {
                                              title: 'No Sluggish or Heavy Software Bloat',
                                              desc: 'No lag or crashing. Runs lightning fast even on affordable laptops, tablets, or counter desktops.',
                                          },
                                          {
                                              title: 'No Mandatory Constant Internet Dependency',
                                              desc: 'Operates over your local counter network (LAN/Server). Your billing never halts if broadband goes down.',
                                          },
                                          {
                                              title: 'No Data Lock-In or Hostage Records',
                                              desc: 'Your customer, inventory, and sales history is 100% yours. Export or backup your database whenever you want.',
                                          },
                                          {
                                              title: 'No Unauthorized Staff Tampering',
                                              desc: 'Without owner authorization, staff cannot delete completed invoices, override locked rates, or alter stock.',
                                          },
                                          {
                                              title: 'No Annoying Advertisements or Popups',
                                              desc: 'Clean, distraction-free environment built exclusively for efficient business productivity.',
                                          },
                                      ]
                                    : [
                                          {
                                              title: 'কোনো প্রতি-বিক্রিতে হিডেন কমিশন বা পার্সেন্টেজ নেয় না',
                                              desc: 'আপনার দোকানের সমস্ত সেলস ও লাভ ১০০% আপনার। সফটওয়্যার থেকে কোনো অযাচিত চার্জ কাটা হয় না।',
                                          },
                                          {
                                              title: 'জটিল বা ধীরগতির কোনো ভারী সফটওয়্যার নয়',
                                              desc: 'কোনো হ্যাং হওয়ার ঝামেলা নেই। কম দামি সাধারণ ল্যাপটপ বা কম্পিউটারেও পলকে স্মুথভাবে লোড হয়।',
                                          },
                                          {
                                              title: 'বাধ্যতামূলক সার্বক্ষণিক ইন্টারনেটের ওপর নির্ভরশীল নয়',
                                              desc: 'দোকানের লোকাল নেটওয়ার্কে (LAN/Server) নিশ্চিন্তে কাউন্টারে সেলস চলে, ইন্টারনেট ড্রপ হলেও কাজ বন্ধ হয় না।',
                                          },
                                          {
                                              title: 'আপনার দোকানের ডাটা লক বা জিম্মি করে না',
                                              desc: 'আপনার কাস্টমার, স্টক ও বিক্রির সম্পূর্ণ ডেটা আপনার নিয়ন্ত্রণে। যেকোনো সময় এক্সপোর্ট বা ফুল ব্যাকআপ নিতে পারবেন।',
                                          },
                                          {
                                              title: 'স্টাফদের অননুমোদিত কারসাজির সুযোগ দেয় না',
                                              desc: 'মালিকের অনুমতি ছাড়া কোনো কর্মী ব্যাকডেটেড সেলস ডিলিট, পার্সেন্টেজ ডিসকাউন্ট বা স্টক গরমিল করতে পারে না।',
                                          },
                                          {
                                              title: 'কোনো অপ্রয়োজনীয় বিজ্ঞাপন বা পপআপ দেখায় না',
                                              desc: 'ক্লিন ও পেশাদার ইন্টারফেস। কাজের সময় কোনো অনাকাঙ্ক্ষিত অ্যাড বা প্রমোশন আসে না।',
                                          },
                                      ]
                                ).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm">
                                        <span className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-rose-500/10 text-rose-500">
                                            <X size={13} strokeWidth={3} />
                                        </span>
                                        <div>
                                            <strong className="font-semibold text-foreground">{item.title}: </strong>
                                            <span className="text-muted-foreground">{item.desc}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">
                                <p className="flex items-center gap-2 font-semibold text-foreground">
                                    <ShieldAlert size={16} className="text-primary" />
                                    {isEn ? 'Guaranteed Shop Data Confidentiality' : 'দোকানের শতভাগ নিরাপত্তা'}
                                </p>
                                <p className="mt-1 leading-relaxed">
                                    {isEn
                                        ? 'We believe business management tools should be honest, dependable, and completely transparent with your private accounting data.'
                                        : 'আমরা বিশ্বাস করি সফটওয়্যার হওয়া উচিত সহায়ক এবং সৎ। আপনার দোকানের গোপনীয় হিসাব সুরক্ষিত রাখাই আমাদের একমাত্র লক্ষ্য।'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION: WHO WILL USE IT ── */}
            <section id="who-its-for" className="py-18 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                            <Store size={14} />
                            {isEn ? 'Target Businesses' : 'উপযুক্ত ব্যবসাসমূহ'}
                        </span>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {isEn ? (
                                <>
                                    Who Is <span className="text-primary">StockPilot</span> Built For?
                                </>
                            ) : (
                                <>
                                    কারা ব্যবহার করবেন <span className="text-primary">StockPilot?</span>
                                </>
                            )}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {isEn
                                ? 'Tailored to support busy retail shops, supermarkets, pharmacies, and wholesale distribution.'
                                : 'যেকোনো রিটেইল, পাইকারি কিংবা ডিপার্টমেন্টাল ব্যবসার জন্য উপযুক্তভাবে ডিজাইন করা।'}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {(isEn
                            ? [
                                  {
                                      icon: ShoppingCart,
                                      title: 'Supermarkets & Grocery Stores',
                                      desc: 'Thousands of product SKUs, weight-scale conversions (kg/gram), fast barcode scanning, and peak-hour queue handling.',
                                      tags: ['Weight/Kg Sync', 'Fast Counter', 'Barcodes'],
                                  },
                                  {
                                      icon: Package,
                                      title: 'Pharmacies & Healthcare Stores',
                                      desc: 'Sell medicines by strip or box, track manufacturer batch numbers, and receive automated expiry warnings.',
                                      tags: ['Batch Tracking', 'Expiry Alerts', 'Strip/Box Units'],
                                  },
                                  {
                                      icon: Zap,
                                      title: 'Electronics & Mobile Gadget Shops',
                                      desc: 'Serial number tracking, accessories stock control, and customer warranty receipts with IMEI snapshots.',
                                      tags: ['Serial Numbers', 'Warranty Memo', 'Customer Ledger'],
                                  },
                                  {
                                      icon: ShoppingBag,
                                      title: 'Clothing, Boutiques & Footwear',
                                      desc: 'Organize size and color variants, print custom barcode stickers, and deliver crisp customer invoices.',
                                      tags: ['Variants', 'Barcode Labels', 'Receipts'],
                                  },
                                  {
                                      icon: Building2,
                                      title: 'Wholesale & Distributors',
                                      desc: 'Handle large bulk carton/sack sales, supplier payment khata, delivery challans, and bulk purchase records.',
                                      tags: ['Challan Billing', 'Supplier Khata', 'Bulk Inventory'],
                                  },
                                  {
                                      icon: Store,
                                      title: 'Bakeries, Departmental & Retail',
                                      desc: 'Daily cash register balance, shift handovers, and end-of-day revenue, profit, and expense summaries.',
                                      tags: ['Cash Register', 'Daily Profit', 'Expense Book'],
                                  },
                              ]
                            : [
                                  {
                                      icon: ShoppingCart,
                                      title: 'মুদি ও সুপারশপ (Supermarkets & Grocery)',
                                      desc: 'হাজার হাজার পণ্যের বারকোড স্ক্যানিং, প্যাকেট বা খোলা পণ্যের ওজন/কেজি হিসাব এবং পিক আওয়ারে দ্রুত কাউন্টার হ্যান্ডলিং।',
                                      tags: ['ওজন/কেজি কনভার্সন', 'ফাস্ট কাউন্টার', 'বারকোড'],
                                  },
                                  {
                                      icon: Package,
                                      title: 'ফার্মেসি ও ড্রাগ স্টোর (Pharmacies)',
                                      desc: 'পাতা বা বক্স হিসেবে ওষুধ বিক্রি, নির্দিষ্ট ব্যাচ নম্বর ও মেয়াদের সতর্কবার্তা যাতে কোনো মেয়াদোত্তীর্ণ পণ্য বিক্রি না হয়।',
                                      tags: ['ব্যাচ ট্র্যাকিং', 'মেয়াদ সতর্কতা', 'পাতা/বক্স ইউনিট'],
                                  },
                                  {
                                      icon: Zap,
                                      title: 'ইলেকট্রনিক্স ও মোবাইল শপ (Gadgets & Mobile)',
                                      desc: 'সিরিয়াল নম্বর ট্র্যাকিং, পার্টস/অ্যাক্সেসরিজ স্টক ম্যানেজমেন্ট এবং কাস্টমার ওয়ারেন্টি মেমো তৈরির পূর্ণ সুবিধা।',
                                      tags: ['সিরিয়াল নম্বর', 'ওয়ারেন্টি মেমো', 'কাস্টমার ডাটা'],
                                  },
                                  {
                                      icon: ShoppingBag,
                                      title: 'পোশাক ও ফ্যাশন শোরুম (Clothing & Boutiques)',
                                      desc: 'সাইজ ও কালার ভ্যারিয়েন্ট, নিজস্ব বারকোড লেবেল তৈরি এবং দ্রুত বিলিং সুবিধা।',
                                      tags: ['ভ্যারিয়েন্ট', 'বারকোড স্টিকার', 'ইনভয়েস'],
                                  },
                                  {
                                      icon: Building2,
                                      title: 'পাইকারি ও ডিস্ট্রিবিউশন (Wholesale & Distributors)',
                                      desc: 'কার্টুন/বস্তা হিসেবে বড় অঙ্কের ক্রয়-বিক্রয়, সাপ্লায়ার বাকি পরিশোধ ও চালান ভাউচার ব্যবস্থাপনা।',
                                      tags: ['চালান বিলিং', 'সাপ্লায়ার বাকি', 'বাল্ক স্টক'],
                                  },
                                  {
                                      icon: Store,
                                      title: 'ডিপার্টমেন্টাল, বেকারি ও রিটেইল (Bakeries & Retail)',
                                      desc: 'প্রতিদিনের নগদ ক্যাশ ও বাকির খাতা, স্টাফ শিফট এবং দিন শেষে মোট লাভ ও খরচের এক পলকের রিপোর্ট।',
                                      tags: ['ক্যাশ রেজিস্টার', 'ডেইলি প্রফিট', 'ব্যয় খাতা'],
                                  },
                              ]
                        ).map((card, idx) => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={idx}
                                    className="group rounded-[30px] border border-border bg-card p-6 shadow-2xl shadow-gray-100 transition-all duration-200 hover:border-primary/50 dark:shadow-none sm:p-7"
                                >
                                    <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                                        <Icon size={22} />
                                    </span>
                                    <h3 className="mt-5 text-lg font-bold text-foreground">{card.title}</h3>
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                                        {card.desc}
                                    </p>
                                    <div className="mt-5 flex flex-wrap gap-1.5">
                                        {card.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-xl bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── SECTION: CORE SERVICES & MODULES ── */}
            <section id="services" className="border-t border-border/80 bg-muted/15 py-18 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                            <Layers size={14} />
                            {isEn ? 'Complete Modules' : 'কমপ্লিট শপ মডিউল'}
                        </span>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {isEn ? (
                                <>
                                    Core Services &amp; <span className="text-primary">Business Modules</span>
                                </>
                            ) : (
                                <>
                                    দোকান পরিচালনার সব <span className="text-primary">সার্ভিস ও টুলস</span>
                                </>
                            )}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {isEn
                                ? 'Fully integrated operational tools built to run everyday business with total precision.'
                                : 'একটি আধুনিক বিজনেসের জন্য যা যা প্রয়োজন—সবই সুশৃঙ্খলভাবে সংযুক্ত রয়েছে।'}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {(isEn
                            ? [
                                  {
                                      icon: ScanBarcode,
                                      title: 'POS Counter Billing',
                                      desc: 'Keyboard shortcuts (F2/F4), barcode reader support, custom rates, and on-the-spot percentage or flat discounts.',
                                  },
                                  {
                                      icon: Boxes,
                                      title: 'Smart Inventory Control',
                                      desc: 'Stock automatically increases upon purchase receiving and deducts on sales, with full return adjustments.',
                                  },
                                  {
                                      icon: Printer,
                                      title: '80mm & A4 Invoicing',
                                      desc: 'Rapid printing on thermal receipt printers or full A4 corporate invoice formats with custom shop branding.',
                                  },
                                  {
                                      icon: CreditCard,
                                      title: 'Customer & Supplier Ledgers',
                                      desc: 'Dynamic ledger books, payment voucher receipts, due aging analysis, and outstanding debt reminders.',
                                  },
                                  {
                                      icon: TrendingUp,
                                      title: 'Expense & Profit/Loss Analytics',
                                      desc: 'Log store electricity, rent, logistics, and staff costs to compute your true net earnings and profit margins.',
                                  },
                                  {
                                      icon: Users,
                                      title: 'Staff Security & Roles',
                                      desc: 'Granular permissions for Cashier, Salesperson, and Store Manager. Sensitive profit reports remain restricted to owners.',
                                  },
                              ]
                            : [
                                  {
                                      icon: ScanBarcode,
                                      title: 'POS ও কাউন্টার বিলিং',
                                      desc: 'কীবোর্ড শর্টকাট (F2), বারকোড স্ক্যানিং, কাস্টম প্রাইস ও অন-দ্য-স্পট ডিসকাউন্ট দিয়ে মুহূর্তের মধ্যে বিল করুন।',
                                  },
                                  {
                                      icon: Boxes,
                                      title: 'স্মার্ট ইনভেন্টরি কন্ট্রোল',
                                      desc: 'ক্রয় করার সাথে সাথে স্বয়ংক্রিয় স্টক বৃদ্ধি, সেলস হলে স্বয়ংক্রিয় হ্রাস ও রিটার্ন সমন্বয়।',
                                  },
                                  {
                                      icon: Printer,
                                      title: '৮০mm ও A4 প্রিন্টিং',
                                      desc: 'যেকোনো থার্মাল পিওএস প্রিন্টারে দ্রুত পেপার রিসিট কিংবা কাস্টমারের জন্য ফুল A4 ইনভয়েস প্রিন্ট।',
                                  },
                                  {
                                      icon: CreditCard,
                                      title: 'কাস্টমার ও সাপ্লায়ার খাতা',
                                      desc: 'বাকির খাতা ডায়নামিক—পেমেন্ট রিসিট গ্রহণ, বাকির লেজার প্রিন্ট ও নির্দিষ্ট সময়ে বকেয়া আদায়ের তাগাদা।',
                                  },
                                  {
                                      icon: TrendingUp,
                                      title: 'আয়-ব্যয় ও লাভ-ক্ষতি রিপোর্ট',
                                      desc: 'দোকানের বিদ্যুৎ বিল, পরিবহন খরচ ও অন্যান্য ব্যয় যুক্ত করুন। সফটওয়্যার আপনাকে দেখাবে আসল নেট প্রফিট।',
                                  },
                                  {
                                      icon: Users,
                                      title: 'স্টাফ রোল ও নিরাপত্তা',
                                      desc: 'ক্যাশিয়ার, সেলসপার্সন ও ম্যানেজারের আলাদা একাউন্ট ও অনুমতি। মালিক ছাড়া কেউ গোপনীয় ডাটা দেখতে পারবে না।',
                                  },
                              ]
                        ).map((service, idx) => {
                            const Icon = service.icon;
                            return (
                                <div
                                    key={idx}
                                    className="rounded-[30px] border border-border/80 bg-card p-6 shadow-2xl shadow-gray-100 transition-all hover:border-primary/40 dark:shadow-none"
                                >
                                    <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                                        <Icon size={22} />
                                    </span>
                                    <h3 className="mt-4 text-base font-bold text-foreground sm:text-lg">{service.title}</h3>
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                                        {service.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── SECTION: LIVE DEMO CREDENTIALS ── */}
            <section id="demo" className="py-16">
                <div className="mx-auto max-w-4xl px-4 sm:px-6">
                    <div className="relative overflow-hidden rounded-[36px] border border-primary/30 bg-gradient-to-b from-card via-card to-primary/5 p-7 shadow-2xl shadow-gray-100 dark:shadow-none sm:p-10">
                        <div className="flex flex-col items-center text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                                <Sparkles size={14} /> {isEn ? 'Instant 1-Click Access' : 'ট্রাই করুন এক ক্লিকে'}
                            </span>
                            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                {isEn ? 'Test With Live Demo Credentials' : 'সরাসরি ডেমো একাউন্টে ঢুকে যাচাই করুন'}
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                                {isEn
                                    ? 'No initial setup required. Sign in immediately to test the counter POS and inventory features.'
                                    : 'আপনি কোনো সেটআপ ছাড়াই এখনই লগইন করে POS ও ইনভেন্টরি চালিয়ে পরখ করতে পারেন।'}
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            {/* Owner Credentials */}
                            <div className="rounded-[26px] border border-border bg-background/80 p-5 backdrop-blur-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                        {isEn ? 'Store Owner (Admin)' : 'মালিক / Owner Access'}
                                    </span>
                                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                        Full Control
                                    </span>
                                </div>
                                <div className="mt-4 space-y-2 text-xs">
                                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-mono font-medium text-foreground">owner@stockpilot.local</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard('owner@stockpilot.local', 'owner-email')}
                                            className="ml-2 text-muted-foreground hover:text-foreground"
                                            title="Copy email"
                                        >
                                            {copiedField === 'owner-email' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
                                        <span className="text-muted-foreground">Password:</span>
                                        <span className="font-mono font-medium text-foreground">Admin@123456</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard('Admin@123456', 'owner-pass')}
                                            className="ml-2 text-muted-foreground hover:text-foreground"
                                            title="Copy password"
                                        >
                                            {copiedField === 'owner-pass' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Staff Credentials */}
                            <div className="rounded-[26px] border border-border bg-background/80 p-5 backdrop-blur-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                        {isEn ? 'Cashier / Staff (Counter)' : 'ক্যাশিয়ার / Staff Access'}
                                    </span>
                                    <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                                        POS &amp; Sales
                                    </span>
                                </div>
                                <div className="mt-4 space-y-2 text-xs">
                                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="font-mono font-medium text-foreground">staff@stockpilot.local</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard('staff@stockpilot.local', 'staff-email')}
                                            className="ml-2 text-muted-foreground hover:text-foreground"
                                            title="Copy email"
                                        >
                                            {copiedField === 'staff-email' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
                                        <span className="text-muted-foreground">Password:</span>
                                        <span className="font-mono font-medium text-foreground">Staff@123456</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard('Staff@123456', 'staff-pass')}
                                            className="ml-2 text-muted-foreground hover:text-foreground"
                                            title="Copy password"
                                        >
                                            {copiedField === 'staff-pass' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Link
                                href="/login"
                                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-8 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:bg-primary-strong active:scale-95"
                            >
                                <LogIn size={16} />
                                <span>{isEn ? 'Go to Login Page' : 'লগইন পেজে যান'}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION: DIRECT CONTACT ── */}
            <section id="contact" className="border-t border-border/80 bg-muted/20 py-18 lg:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                            <PhoneCall size={14} />
                            {isEn ? 'Direct Contact' : 'সরাসরি যোগাযোগ'}
                        </span>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                            {isEn ? 'Speak Directly With Our Team' : 'যেকোনো তথ্যে সরাসরি কথা বলুন'}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {isEn
                                ? 'Need assistance with printer configuration, setup, or custom business features? Reach out anytime.'
                                : 'সফটওয়্যার সেটআপ, প্রিন্টার কনফিগারেশন কিংবা কাস্টমাইজেশন বিষয়ে আমরা সর্বদা প্রস্তুত।'}
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Phone & WhatsApp Card */}
                        <div className="rounded-[32px] border border-border bg-card p-7 shadow-2xl shadow-gray-100 dark:shadow-none flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <Phone size={22} />
                                    </span>
                                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        {isEn ? 'Call / WhatsApp' : 'সরাসরি কল / WhatsApp'}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-xl font-bold text-foreground">
                                    {isEn ? 'Phone & WhatsApp' : 'মোবাইল ও হোয়াটসঅ্যাপ'}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {isEn ? 'Active 9:00 AM – 10:00 PM daily' : 'সকাল ৯টা থেকে রাত ১০টা পর্যন্ত সক্রিয়'}
                                </p>
                                <p className="mt-4 font-mono text-2xl font-extrabold tracking-tight text-foreground">
                                    {PHONE_NUMBER}
                                </p>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2.5 pt-4 border-t border-border/70">
                                <a
                                    href={`tel:${PHONE_NUMBER}`}
                                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary-strong"
                                >
                                    <Phone size={14} /> {isEn ? 'Call Now' : 'কল করুন'}
                                </a>
                                <a
                                    href={WHATSAPP_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20"
                                >
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(PHONE_NUMBER, 'main-phone')}
                                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                                    title="Copy number"
                                >
                                    {copiedField === 'main-phone' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Email Card */}
                        <div className="rounded-[32px] border border-border bg-card p-7 shadow-2xl shadow-gray-100 dark:shadow-none flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                                        <Mail size={22} />
                                    </span>
                                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                                        {isEn ? 'Official Email' : 'অফিসিয়াল ইমেইল'}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-xl font-bold text-foreground">
                                    {isEn ? 'Email Support' : 'ইমেইল সহায়তা'}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {isEn ? 'Guaranteed response within 24 hours' : '২৪ ঘণ্টার মধ্যে রেসপন্স নিশ্চিত'}
                                </p>
                                <p className="mt-4 font-mono text-base font-bold text-foreground break-all">
                                    {EMAIL_ADDRESS}
                                </p>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2.5 pt-4 border-t border-border/70">
                                <a
                                    href={`mailto:${EMAIL_ADDRESS}?subject=Inquiry%20about%20StockPilot%20POS`}
                                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary-strong"
                                >
                                    <Send size={14} /> {isEn ? 'Send Email' : 'ইমেইল পাঠান'}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(EMAIL_ADDRESS, 'main-email')}
                                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                                    title="Copy email"
                                >
                                    {copiedField === 'main-email' ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Office & Support Card */}
                        <div className="rounded-[32px] border border-border bg-card p-7 shadow-2xl shadow-gray-100 dark:shadow-none sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="grid size-12 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                        <MapPin size={22} />
                                    </span>
                                    <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                                        {isEn ? 'Local Support' : 'লোকাল সাপোর্ট'}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-xl font-bold text-foreground">
                                    {isEn ? 'Office & Service' : 'অফিস ও সেবা'}
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">Dhaka, Bangladesh</p>
                                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                                    {isEn
                                        ? 'Onsite and remote printer setup, database configuration, and team training available via AnyDesk / TeamViewer.'
                                        : 'অনসাইট বা রিমোটলি AnyDesk/TeamViewer এর মাধ্যমে দ্রুত প্রিন্টার সেটআপ ও ট্রেনিং দেওয়া হয়।'}
                                </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-border/70">
                                <Link
                                    href="/login"
                                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                                >
                                    <LogIn size={14} /> {isEn ? 'Sign In to Workspace' : 'লগইন করুন'}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-border/80 bg-card py-10 text-xs text-muted-foreground">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                            <LogoMark className="size-5.5" />
                        </span>
                        <div>
                            <p className="font-brand text-sm font-bold tracking-tight text-foreground leading-none">
                                STOCK <span className="text-primary">PILOT</span>
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">Smart POS &amp; Inventory Management System</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                        <a href="#features" className="hover:text-foreground">
                            {isEn ? 'Features' : 'সুবিধাসমূহ'}
                        </a>
                        <a href="#what-we-do" className="hover:text-foreground">
                            {isEn ? 'What We Do' : 'কী করে ও করে না'}
                        </a>
                        <a href="#who-its-for" className="hover:text-foreground">
                            {isEn ? "Who It's For" : 'কারা ব্যবহার করবে'}
                        </a>
                        <a href="#contact" className="hover:text-foreground">
                            {isEn ? 'Contact' : 'যোগাযোগ'}
                        </a>
                        <Link href="/login" className="font-semibold text-primary hover:underline">
                            {isEn ? 'Login Page' : 'লগইন পেজ'}
                        </Link>

                        {/* Footer Language Switcher */}
                        <button
                            type="button"
                            onClick={() => toggleLang(isEn ? 'bn' : 'en')}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                        >
                            <Globe size={11} className="text-primary" />
                            <span>{isEn ? 'বাংলায় দেখুন' : 'View in English'}</span>
                        </button>
                    </div>

                    <div className="flex flex-col items-center gap-1 sm:items-end text-center sm:text-right">
                        <p>&copy; {new Date().getFullYear()} StockPilot · Phone: {PHONE_NUMBER}</p>
                        <p>
                            Designed &amp; built by{' '}
                            <a
                                href="https://bymaza.me/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-primary transition-colors hover:underline"
                            >
                                Mazaharul
                            </a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
