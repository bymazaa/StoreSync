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
  if (user) redirect("/");

  const userCount = await User.countDocuments({});
  if (userCount === 0) redirect("/setup");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#f4f7f6] dark:bg-[#16181a]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-52 size-[540px] rounded-full bg-[#d8f0eb] blur-3xl dark:bg-[#19332f]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -left-48 size-[580px] rounded-full bg-[#e6f2ef] blur-3xl dark:bg-[#1a2927]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <a href="/login" className="flex items-center gap-3" aria-label="StockPilot home">
          <span className="grid size-11 place-items-center rounded-[15px] bg-primary text-white shadow-[0_8px_20px_rgba(10,159,148,0.22)]">
            <LogoMark className="size-7" />
          </span>
          <span>
            <span className="font-brand block text-[20px] leading-none tracking-[0.025em] text-[#172523] dark:text-foreground">STOCK PILOT</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#75827e]">Shop management</span>
          </span>
        </a>
        <span className="hidden items-center gap-2 rounded-full border border-[#dce7e3] bg-white/80 px-3.5 py-2 text-xs font-medium text-[#64736f] dark:border-border dark:bg-card/80 dark:text-muted-foreground sm:inline-flex">
          <ShieldCheck size={15} className="text-primary" /> Private to your shop
        </span>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 px-5 pb-10 pt-3 sm:px-8 lg:min-h-[calc(100vh-104px)] lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:px-12 lg:pb-16 lg:pt-0">
        <section className="order-2 py-2 lg:order-1 lg:py-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cfe5df] bg-white/75 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#087f76] dark:border-[#2a4943] dark:bg-card/75 dark:text-teal-strong">
              <span className="size-1.5 rounded-full bg-primary" /> Made for your shop
            </span>
              <h1 className="mt-5 max-w-[620px] text-[clamp(2.5rem,5vw,4.45rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#172523] dark:text-foreground">
              Your whole shop, <span className="text-primary">in sync.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#62716d] dark:text-muted-foreground sm:text-base">
              Make every sale, stock movement and customer balance easier to follow. Sign in to pick up right where your team left off.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {highlights.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe9e5] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[#334541] shadow-[0_2px_8px_rgba(26,50,44,0.035)] dark:border-border dark:bg-card/80 dark:text-foreground dark:shadow-none">
                  <Icon size={15} className="text-primary" /> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mt-9 max-w-[590px] overflow-hidden rounded-[26px] border border-[#dfe9e5] bg-white/90 p-5 text-[#243632] shadow-[0_18px_50px_rgba(30,60,54,0.08)] dark:border-border dark:bg-card dark:text-foreground dark:shadow-none sm:p-7">
            <div aria-hidden="true" className="absolute -right-14 -top-20 size-64 rounded-full border border-primary/10" />
            <div aria-hidden="true" className="absolute -right-1 top-2 size-44 rounded-full border border-primary/[0.07]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">A clearer view of today</p>
                <p className="mt-2 text-sm text-[#71807c] dark:text-muted-foreground">Your counter at a glance</p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-primary/10 text-primary"><Store size={19} /></span>
            </div>
            <div className="relative mt-7 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs text-[#71807c] dark:text-muted-foreground">Sales move with your stock</p>
                <p className="mt-1 text-[28px] font-semibold tracking-tight">One simple flow</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                <ArrowDownRight size={15} /> Every item accounted for
              </div>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-2 border-t border-[#e4ece9] pt-4 dark:border-border">
              {["Sales", "Purchases", "Balances"].map((label) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-[#657570] dark:text-muted-foreground"><Check size={13} className="text-primary" />{label}</div>
              ))}
            </div>
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs text-[#73817d] dark:text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" /> Your shop data stays on your own server.
          </p>
        </section>

        <section className="order-1 lg:order-2">
          <AuthForm mode="login" showBrand={false} />
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 pb-6 text-[11px] text-[#82908c] dark:text-muted-foreground sm:flex-row sm:justify-between sm:px-8 lg:px-12">
        <span>Secure sign-in for your shop team</span>
        <span>StockPilot · Shop management</span>
        <span>Designed &amp; built by <a href="https://bymaza.me" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary transition-colors hover:underline">Mazaharul</a></span>
      </footer>
    </div>
  );
}
