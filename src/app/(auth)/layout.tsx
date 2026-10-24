import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

// The auth pages own their own vertical rhythm: setup is a centred card, login is a full landing page.
export const instant = false;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="relative min-h-screen bg-background text-foreground"><div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6"><ThemeToggle /></div>{children}</div>;
}
