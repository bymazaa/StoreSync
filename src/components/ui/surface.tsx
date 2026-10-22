import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-card", className)} {...props} />;
}
