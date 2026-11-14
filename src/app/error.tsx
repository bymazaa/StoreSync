'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, ChevronUp, Home, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import LogoMark from '@/components/brand/logo-mark';
import { APP_META } from '@/lib/constants/app';

export default function ErrorBoundary({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('App error caught by ErrorBoundary:', error);
  }, [error]);

  const handleRetry = () => {
    if (typeof reset === 'function') {
      reset();
    } else if (typeof retry === 'function') {
      retry();
    } else {
      window.location.reload();
    }
  };

  const msg = (error?.message || '').toLowerCase();
  const isDbOrNetwork =
    msg.includes('mongo') ||
    msg.includes('connection') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('failed to fetch');

  const isPermission =
    msg.includes('forbidden') ||
    msg.includes('permission') ||
    msg.includes('unauthorized') ||
    msg.includes('unauthenticated');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-lg text-center">
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="size-9 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            {APP_META.name}
          </span>
        </div>

        {/* Error Card */}
        <div className="rounded-3xl border border-border bg-card p-7 sm:p-9 shadow-xl">
          {/* Tone icon */}
          <div
            className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl ${
              isDbOrNetwork
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : isPermission
                  ? 'bg-violet-soft text-violet-strong'
                  : 'bg-danger/10 text-danger'
            }`}
          >
            {isDbOrNetwork ? (
              <WifiOff size={32} />
            ) : isPermission ? (
              <ShieldAlert size={32} />
            ) : (
              <AlertTriangle size={32} />
            )}
          </div>

          <span
            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              isDbOrNetwork
                ? 'bg-amber-soft text-amber-strong'
                : isPermission
                  ? 'bg-violet-soft text-violet-strong'
                  : 'bg-danger/10 text-danger'
            }`}
          >
            {isDbOrNetwork
              ? 'Connection Issue'
              : isPermission
                ? 'Access Restricted'
                : 'Application Error'}
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isDbOrNetwork
              ? 'Database or Connection Failure'
              : isPermission
                ? 'Permission Required'
                : 'Something went wrong'}
          </h1>

          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            {isDbOrNetwork
              ? 'StockPilot could not reach the database or network server. Please check your internet connection or verify that the database service is running.'
              : isPermission
                ? 'You do not have sufficient permissions to view or perform this action, or your session may have expired.'
                : (error?.message || 'An unexpected runtime error occurred while processing this request.')}
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <RefreshCw size={16} />
              Try again
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Home size={16} />
              Go to Dashboard
            </Link>
          </div>

          {/* Technical Details Toggle */}
          {(error?.message || error?.digest) && (
            <div className="mt-6 border-t border-border/70 pt-4 text-left">
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>Technical details</span>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showDetails && (
                <div className="mt-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs">
                  {error.digest && (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Error Digest:</span>{' '}
                      {error.digest}
                    </p>
                  )}
                  {error.message && (
                    <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                      <span className="font-semibold text-foreground">Message:</span>{' '}
                      {error.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
