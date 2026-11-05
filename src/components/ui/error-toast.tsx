'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { ERROR_TOAST_EVENT } from '@/lib/client-notifications';

type Toast = { id: number; message: string; tone: 'error' | 'success' };

export function ErrorToastViewport() {
    const [toast, setToast] = useState<Toast | null>(null);
    const sequence = useRef(0);
    const timer = useRef<number | null>(null);
    const lastToast = useRef<{ message: string; time: number } | null>(null);

    useEffect(() => {
        const receive = (event: Event) => {
            const detail = (event as CustomEvent<{ message?: string; tone?: 'error' | 'success' }>).detail;
            const message = detail?.message?.trim();
            if (!message) return;
            const tone = detail?.tone === 'success' ? 'success' : 'error';
            const now = Date.now();
            if (lastToast.current?.message === message && now - lastToast.current.time < 250) return;
            lastToast.current = { message, time: now };
            sequence.current += 1;
            setToast({ id: sequence.current, message, tone });
            if (timer.current !== null) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setToast(null), 6000);
        };
        window.addEventListener(ERROR_TOAST_EVENT, receive);
        return () => {
            window.removeEventListener(ERROR_TOAST_EVENT, receive);
            if (timer.current !== null) window.clearTimeout(timer.current);
        };
    }, []);

    function dismiss() {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        setToast(null);
    }

    if (!toast) return null;
    const success = toast.tone === 'success';
    return (
        <div
            key={toast.id}
            role={success ? 'status' : 'alert'}
            aria-live={success ? 'polite' : 'assertive'}
            className={`fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border bg-card p-3.5 text-foreground shadow-2xl shadow-slate-950/15 ring-1 dark:shadow-none sm:right-6 sm:top-6 ${success ? 'border-success/25 ring-success/5' : 'border-danger/25 ring-danger/5'}`}
        >
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {success ? <CheckCircle2 size={18} strokeWidth={1.9} /> : <CircleAlert size={18} strokeWidth={1.9} />}
            </span>
            <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${success ? 'text-success' : 'text-danger'}`}>
                    {success ? 'Saved successfully' : 'Something went wrong'}
                </p>
                <p className="mt-1 break-words text-[13px] leading-5 text-foreground/85">{toast.message}</p>
            </div>
            <button
                type="button"
                aria-label="Dismiss message"
                onClick={dismiss}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <X size={15} />
            </button>
        </div>
    );
}