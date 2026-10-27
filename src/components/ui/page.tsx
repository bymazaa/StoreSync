import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}<h1 className="mt-1 text-2xl font-semibold tracking-[0.03em] sm:text-[28px]">{title}</h1>{description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}</div>{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}</div>;
}

export function Panel({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6 ${className}`}><>{(title || description || action) && <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div>{title && <h2 className="text-lg font-semibold">{title}</h2>}{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{action}</div>}{children}</></section>;
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{children}</p>;
}

export function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "warning" }) {
  return <p role="status" className={`rounded-xl border px-3.5 py-3 text-sm ${tone === "success" ? "border-success/20 bg-success/10 text-success" : "border-amber-strong/20 bg-amber-soft text-amber-strong"}`}>{children}</p>;
}

export function TableEmpty({ children = "No records found." }: { children?: ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

export const inputClass = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10";
export const selectClass = inputClass;
export const textareaClass = "min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10";
