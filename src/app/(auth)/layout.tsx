import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

// Login and setup pages check the shop's current database and auth cookie.
export const instant = false;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground"><div className="absolute right-4 top-4 sm:right-6 sm:top-6"><ThemeToggle /></div>{children}</div>;
}
