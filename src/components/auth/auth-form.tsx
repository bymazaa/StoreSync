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
            router.replace('/');
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
                    <span className="grid size-11 place-items-center rounded-2xl border border-border bg-card shadow-2xl">
                        <LogoMark className="size-7" />
                    </span>
                    <span>
                        <span className="block font-logo text-2xl font-semibold leading-none tracking-[0.06em]">
                            STOCK-PILOT
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Grocery shop management
                        </span>
                    </span>
                </div>
            )}
            <div
                className={
                    isSetup
                        ? 'rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8'
                        : 'rounded-[26px] border border-border bg-card p-6 shadow-2xl shadow-gray-200 sm:p-9 dark:shadow-black/20'
                }
            >
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
                    <div className="mt-5 rounded-2xl border border-primary/20 bg-primary-soft/40 p-3.5 text-xs dark:bg-primary-soft/20">
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                                <Sparkles size={13} /> Demo Login Details
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmail('test@stockpilot.com');
                                    setPassword('password@stockpilot');
                                }}
                                className="cursor-pointer rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary transition-all hover:bg-primary/25 active:scale-95"
                            >
                                Auto Fill
                            </button>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-foreground/90">
                            <span className="flex items-center gap-1">
                                <span className="font-sans font-medium text-muted-foreground">
                                    Email:
                                </span>
                                <span className="select-all rounded bg-background/60 px-1 py-0.5">
                                    test@stockpilot.com
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="font-sans font-medium text-muted-foreground">
                                    Pass:
                                </span>
                                <span className="select-all rounded bg-background/60 px-1 py-0.5">
                                    password@stockpilot
                                </span>
                            </span>
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
