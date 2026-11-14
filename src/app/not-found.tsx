'use client';

import Link from 'next/link';
import { ArrowLeft, Boxes, FileQuestion, Home, Receipt, ShoppingBag } from 'lucide-react';
import LogoMark from '@/components/brand/logo-mark';
import { APP_META } from '@/lib/constants/app';

export default function NotFound() {
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

        {/* 404 Card */}
        <div className="rounded-3xl  bg-card p-7 sm:p-9 shadow-2xl shadow-gray-50">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <FileQuestion size={32} strokeWidth={2} />
          </div>

          <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-strong">
            Error 404 · Page Not Found
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            We couldn't find that page
          </h1>

          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
            The page, product, or record you are looking for doesn't exist, has been removed, or the link might be incorrect.
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Home size={16} />
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>

          {/* Quick Links */}
          <div className="mt-8 border-t border-border/70 pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quick shortcuts
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Link
                href="/sales"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-primary"
              >
                <Receipt size={16} className="text-muted-foreground" />
                <span className="font-medium">Sales</span>
              </Link>
              <Link
                href="/products"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-primary"
              >
                <Boxes size={16} className="text-muted-foreground" />
                <span className="font-medium">Products</span>
              </Link>
              <Link
                href="/purchases"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-primary"
              >
                <ShoppingBag size={16} className="text-muted-foreground" />
                <span className="font-medium">Purchases</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
