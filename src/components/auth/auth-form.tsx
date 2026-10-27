"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readResponsePayload } from "@/lib/client-api";

type AuthFormProps = { mode: "login" | "setup"; showBrand?: boolean };

export function AuthForm({ mode, showBrand = true }: AuthFormProps) {
  const isSetup = mode === "setup";
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    try {
      if (isSetup) {
        const setupResponse = await fetch("/api/setup/owner", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: form.get("fullName"), email, password }),
        });
        const setupData = await readResponsePayload(setupResponse);
        if (!setupResponse.ok) throw new Error(setupData.error?.message ?? "Could not create your owner account.");
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await readResponsePayload(loginResponse);
      if (!loginResponse.ok) throw new Error(loginData.error?.message ?? "Could not sign in.");
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {showBrand && (
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><ShoppingBag size={21} /></span>
          <span><span className="block font-display text-2xl leading-none tracking-[0.06em]">StockPilot</span><span className="text-xs text-muted-foreground">Grocery shop management</span></span>
        </div>
      )}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{isSetup ? "First-time setup" : "Welcome back"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[0.02em]">{isSetup ? "Create your owner account" : "Sign in to your shop"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{isSetup ? "Create the main account for the person responsible for this shop. The owner can manage products, purchases, sales, settings and staff access." : "Use the account set up by your shop owner."}</p>
        {isSetup && <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><p className="font-semibold text-foreground">What happens next?</p><p>After creating this account, you will enter StockPilot. Set the shop country and currency in Settings, add categories and product details, then record your first supplier purchase to add stock and prices.</p><p className="mt-2">Use an email address you can access and a password with at least 12 characters. Do not share the owner password with staff.</p></div>}
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {isSetup && <label className="block"><span className="mb-1.5 block text-sm font-medium">Full name</span><input name="fullName" required minLength={2} maxLength={120} autoComplete="name" className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10" placeholder="Your name" /></label>}
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Email address</span><input name="email" type="email" required autoComplete="email" className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10" placeholder="you@example.com" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Password</span><input name="password" type="password" required minLength={isSetup ? 12 : 1} maxLength={200} autoComplete={isSetup ? "new-password" : "current-password"} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10" placeholder={isSetup ? "At least 12 characters" : "Your password"} /></label>
          {error && <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          <Button className="mt-1 w-full" type="submit" disabled={busy} icon={busy ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={16} />}>
            {busy ? (isSetup ? "Setting up..." : "Signing in...") : (isSetup ? "Create account & continue" : "Sign in")}
          </Button>
        </form>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">{isSetup ? "Your shop owner account is protected by your password." : "Your shop data is protected by your account access."}</p>
      {isSetup ? <p className="mt-3 text-center text-sm text-muted-foreground">Already set up? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p> : null}
    </div>
  );
}
