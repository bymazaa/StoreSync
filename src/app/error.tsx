'use client';

import { useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error caught:', error);
  }, [error]);

  const msg = error.message ? error.message.toLowerCase() : '';
  const isDbOrNetwork =
    msg.includes('mongo') ||
    msg.includes('connection') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <WifiOff size={28} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          {isDbOrNetwork ? 'Database or Internet Connection Issue' : 'Unable to Load Page'}
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
          {isDbOrNetwork
            ? 'StockPilot uses a Cloud Database. Please verify that your internet is active and that the cloud database is reachable.'
            : (error.message || 'An unexpected error occurred while loading this page.')}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw size={15} />
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
