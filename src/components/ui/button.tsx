import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  icon?: ReactNode;
};

const variants = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

export function Button({ className, variant = "primary", icon, children, ...props }: ButtonProps) {
  return (
    <button className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", variants[variant], className)} {...props}>
      {icon}{children}
    </button>
  );
}
