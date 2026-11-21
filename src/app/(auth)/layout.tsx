import type { ReactNode } from "react";

// The auth pages own their own vertical rhythm: setup is a centred card, login is a full landing page.
export const instant = false;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="relative min-h-screen bg-background text-foreground">{children}</div>;
}
