import LogoMark from '@/components/brand/logo-mark';
import { APP_META } from '@/lib/constants/app';

export default function RootLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground"
      role="status"
      aria-live="polite"
      aria-label="Loading workspace"
    >
      <div className="flex flex-col items-center text-center">
        {/* Animated Brand Pulse */}
        <div className="relative mb-5 flex size-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 opacity-75" />
          <div className="relative grid size-16 place-items-center rounded-2xl border border-border bg-card shadow-lg ring-1 ring-primary/20">
            <LogoMark className="size-8 text-primary animate-pulse" />
          </div>
        </div>

        {/* Text */}
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Loading {APP_META.name}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Preparing your shop workspace...
        </p>

        {/* Loading Spinner */}
        <div className="mt-5 flex items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    </div>
  );
}
