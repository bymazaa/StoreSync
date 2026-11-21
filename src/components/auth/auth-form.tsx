'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LogoMark from '@/components/brand/logo-mark';
import { readResponsePayload } from '@/lib/client-api';

type AuthFormProps = { mode: 'login' | 'setup'; showBrand?: boolean };

export function AuthForm({ mode, showBrand = true }: AuthFormProps) {
    const isSetup = mode === 'setup';
    const router = useRouter();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setBusy(true);
        const form = new FormData(event.currentTarget);
        const emailVal = String(form.get('email') ?? email)
            .trim()
            .toLowerCase();
        const passwordVal = String(form.get('password') ?? password);
        try {
            if (isSetup) {
                const setupResponse = await fetch('/api/setup/owner', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullName: form.get('fullName'),
                        email: emailVal,
                        password: passwordVal,
                    }),
                });
                const setupData = await readResponsePayload(setupResponse);
                if (!setupResponse.ok)
                    throw new Error(
                        setupData.error?.message ?? 'Could not create your owner account.',
                    );
            }

            const loginResponse = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailVal, password: passwordVal }),
            });
            const loginData = await readResponsePayload(loginResponse);
            if (!loginResponse.ok)
                throw new Error(loginData.error?.message ?? 'Could not sign in.');
            router.replace('/dashboard');
            router.refresh();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'Something went wrong. Please try again.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto w-full max-w-md">
            {showBrand && (
                <div className="mb-8 flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                        <LogoMark className="size-6.5" />
                    </span>
                    <div>
                        <span className="font-brand block text-2xl font-bold tracking-tight text-foreground">
                            STOCK <span className="text-primary">PILOT</span>
                        </span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Smart POS &amp; Inventory
                        </span>
                    </div>
                </div>
            )}
            <div
                className={
                    isSetup
                        ? 'rounded-[32px] border border-border bg-card p-6 shadow-2xl shadow-gray-100 sm:p-8 dark:shadow-none'
                        : 'rounded-[32px] border border-border bg-card p-6 shadow-2xl shadow-gray-100 sm:p-9 dark:shadow-none'
                }
            >
                <div className="mb-4 flex items-center justify-between">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        ← ব্যাক টু হোম পেজ
                    </Link>
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider">StockPilot</span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {isSetup ? 'First-time setup' : 'Welcome back'}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[0.02em]">
                    {isSetup ? 'Create your owner account' : 'Sign in to your shop'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {isSetup
                        ? 'Create the main account for the person responsible for this shop. The owner can manage products, purchases, sales, settings and staff access.'
                        : 'Use the account set up by your shop owner.'}
                </p>
                {isSetup && (
                    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                        <p className="font-semibold text-foreground">What happens next?</p>
                        <p>
                            After creating this account, you will enter StockPilot. Set the shop
                            country and currency in Settings, add categories and product details,
                            then record your first supplier purchase to add stock and prices.
                        </p>
                        <p className="mt-2">
                            Use an email address you can access and a password with at least 12
                            characters. Do not share the owner password with staff.
                        </p>
                    </div>
                )}
                <form className="mt-7 space-y-4" onSubmit={submit}>
                    {isSetup && (
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium">Full name</span>
                            <input
                                name="fullName"
                                required
                                minLength={2}
                                maxLength={120}
                                autoComplete="name"
                                className="h-11 w-full rounded-[12px] border border-border bg-input px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                                placeholder="Your name"
                            />
                        </label>
                    )}
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium">Email address</span>
                        <input
                            name="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            className="h-11 w-full rounded-[12px] border border-border bg-input px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                            placeholder="you@example.com"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium">Password</span>
                        <input
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={isSetup ? 12 : 1}
                            maxLength={200}
                            autoComplete={isSetup ? 'new-password' : 'current-password'}
                            className="h-11 w-full rounded-[12px] border border-border bg-input px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                            placeholder={isSetup ? 'At least 12 characters' : 'Your password'}
                        />
                    </label>
                    {error && (
                        <p
                            role="alert"
                            className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger"
                        >
                            {error}
                        </p>
                    )}
                    <Button
                        className="mt-1 w-full"
                        type="submit"
                        disabled={busy}
                        icon={
                            busy ? (
                                <LoaderCircle className="animate-spin" size={16} />
                            ) : (
                                <ArrowRight size={16} />
                            )
                        }
                    >
                        {busy
                            ? isSetup
                                ? 'Setting up...'
                                : 'Signing in...'
                            : isSetup
                              ? 'Create account & continue'
                              : 'Sign in'}
                    </Button>
                </form>

                {!isSetup && (
                    <div className="mt-5 space-y-2.5 pt-3 border-t border-border/80">
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                                <Sparkles size={13} className="text-primary" /> ডেমো একাউন্ট (Demo Logins)
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground">
                                টেস্ট করতে অটো-ফিল করুন
                            </span>
                        </div>

                        {/* Owner Login Card */}
                        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs transition-colors hover:bg-primary/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-primary" />
                                    <span className="font-bold text-foreground">মালিক / Owner Access</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail('owner@stockpilot.local');
                                        setPassword('Admin@123456');
                                    }}
                                    className="cursor-pointer rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary-strong active:scale-95"
                                >
                                    Auto Fill
                                </button>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] text-muted-foreground">
                                <span>Email: <strong className="text-foreground">owner@stockpilot.local</strong></span>
                                <span>Pass: <strong className="text-foreground">Admin@123456</strong></span>
                            </div>
                        </div>

                        {/* Staff Login Card */}
                        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-3 text-xs transition-colors hover:bg-teal-500/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-teal-500" />
                                    <span className="font-bold text-foreground">ক্যাশিয়ার / Staff Access</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail('staff@stockpilot.local');
                                        setPassword('Staff@123456');
                                    }}
                                    className="cursor-pointer rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-teal-700 active:scale-95 dark:bg-teal-500 dark:hover:bg-teal-600"
                                >
                                    Auto Fill
                                </button>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] text-muted-foreground">
                                <span>Email: <strong className="text-foreground">staff@stockpilot.local</strong></span>
                                <span>Pass: <strong className="text-foreground">Staff@123456</strong></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
                {isSetup
                    ? 'Your shop owner account is protected by your password.'
                    : 'Your shop data is protected by your account access.'}
            </p>
            {isSetup ? (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                    Already set up?{' '}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        Sign in
                    </Link>
                </p>
            ) : null}
        </div>
    );
}
