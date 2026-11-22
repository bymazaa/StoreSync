import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ShieldCheck,
  ShoppingCart,
  Store,
} from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import LogoMark from "@/components/brand/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { getViewerUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { connection } from "next/server";

export const instant = false;

const highlights = [
  { icon: ShoppingCart, label: "Fast counter sales" },
  { icon: Boxes, label: "Live stock levels" },
  { icon: ChartNoAxesCombined, label: "Clear shop reports" },
];

export default async function LoginPage() {
  await connection();
  await connectDB();
  const user = await getViewerUser();
  if (user) redirect("/dashboard");

  const userCount = await User.countDocuments({});
  if (userCount === 0) redirect("/setup");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-canvas text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-52 size-[540px] rounded-full bg-primary-soft/80 blur-3xl dark:bg-primary-soft/30" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -left-48 size-[580px] rounded-full bg-primary-soft/50 blur-3xl dark:bg-primary-soft/20" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8 sm:py-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0" aria-label="StockPilot home">
          <span className="grid size-9.5 sm:size-11 place-items-center rounded-xl sm:rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-200 group-hover:scale-105">
            <LogoMark className="size-5.5 sm:size-6.5" />
          </span>
          <div>
            <span className="font-brand block text-lg sm:text-xl font-bold tracking-tight text-foreground leading-none">
              STOCK <span className="text-primary">PILOT</span>
            </span>
            <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Smart POS &amp; Inventory
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pb-10 pt-3 sm:px-8 lg:min-h-[calc(100vh-104px)] lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:px-12 lg:pb-16 lg:pt-0">
        <section className="order-2 py-2 lg:order-1 lg:py-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> Made for your shop
            </span>
              <h1 className="mt-5 max-w-[620px] text-[clamp(2.5rem,5vw,4.45rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-foreground">
              Your whole shop, <span className="text-primary">in sync.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-base">
              Make every sale, stock movement and customer balance easier to follow. Sign in to pick up right where your team left off.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {highlights.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2.5 text-xs font-semibold text-foreground shadow-2xl shadow-gray-100 dark:shadow-none">
                  <Icon size={15} className="text-primary" /> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mt-9 max-w-[590px] overflow-hidden rounded-[32px] border border-border bg-card/90 p-6 text-foreground shadow-2xl shadow-gray-100 dark:shadow-none sm:p-8">
            <div aria-hidden="true" className="absolute -right-14 -top-20 size-64 rounded-full border border-primary/10" />
            <div aria-hidden="true" className="absolute -right-1 top-2 size-44 rounded-full border border-primary/[0.07]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">A clearer view of today</p>
                <p className="mt-2 text-sm text-muted-foreground">Your counter at a glance</p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Store size={19} /></span>
            </div>
            <div className="relative mt-7 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs text-muted-foreground">Sales move with your stock</p>
                <p className="mt-1 text-[28px] font-semibold tracking-tight">One simple flow</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                <ArrowDownRight size={15} /> Every item accounted for
              </div>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4">
              {["Sales", "Purchases", "Balances"].map((label) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Check size={13} className="text-primary" />{label}</div>
              ))}
            </div>
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" /> Your shop data stays on your own server.
          </p>
        </section>

        <section className="order-1 lg:order-2">
          <AuthForm mode="login" showBrand={false} />
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 pb-6 text-[11px] text-muted-foreground sm:flex-row sm:justify-between sm:px-8 lg:px-12">
        <span>Secure sign-in for your shop team</span>
        <span>StockPilot · Shop management</span>
      </footer>
    </div>
  );
}
