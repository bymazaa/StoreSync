import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[16px] border border-line bg-card shadow-2xl dark:shadow-none shadow-gray-100", className)} {...props} />;
}
