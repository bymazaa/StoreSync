'use client';

import { useEffect, type ReactNode } from 'react';
import { isValidElement } from 'react';
import { notifyErrorToast } from '@/lib/client-notifications';

function textContent(value: ReactNode): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join(' ');
    if (isValidElement<{ children?: ReactNode }>(value)) return textContent(value.props.children);
    return '';
}

export function ErrorMessage({ children }: { children: ReactNode }) {
    const message = textContent(children).trim();
    useEffect(() => {
        if (message) notifyErrorToast(message);
    }, [message]);

    return (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            {children}
        </p>
    );
}