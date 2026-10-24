import { redirect } from "next/navigation";
import {
  Boxes, ChartNoAxesCombined, Check, MapPin, Printer, ShieldCheck, ShoppingCart, ShoppingBag,
  Store, Truck, UsersRound, X,
} from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { getViewerUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { connection } from "next/server";

// Force dynamic rendering - this page depends on session state and DB
export const instant = false;

const promises = ["80 mm slip and A4 invoice", "Bengali and English print correctly", "Role-based staff access", "Every change logged"];

const covers = [
  { icon: ShoppingCart, title: "Sales & POS", text: "Search by name, SKU or barcode, add lines, discount, cash or part payment, and put the rest on due. F2 search, F4 customer, F9 finishes the invoice." },
  { icon: Truck, title: "Purchases & batches", text: "Stock enters through a purchase: quantity, what you paid per unit and the selling price. Completing it moves stock into dated batches." },
  { icon: Boxes, title: "Products & labels", text: "Catalogue with units and pack conversions, categories, low-stock levels, automatic SKUs and A4 barcode sticker sheets for the shelves." },
  { icon: UsersRound, title: "Dues & collections", text: "Customer and supplier ledgers with outstanding balance, 0–30 / 31–60 / 60+ day ageing, and a payment slip that prints on the roll." },
  { icon: ChartNoAxesCombined, title: "Reports & profit", text: "Sales, purchases, profit & loss, stock valuation, expenses and dues — each one saving as a bank-style statement PDF." },
  { icon: ShieldCheck, title: "Staff & audit", text: "Owner, manager, cashier and stock clerk, each ticked with the actions they may take, plus an activity log of who changed what." },
  { icon: Printer, title: "Paper", text: "80 mm thermal slips, A4 invoices, payment receipts and shelf stickers. The preview on screen is what the printer gives you." },
  { icon: MapPin, title: "Your shop, your formats", text: "The country you choose sets currency, date, number format and time zone. Invoice prefixes and payment methods stay yours." },
];

const outsideScope = [
  "No online shop — customers cannot browse or order; everything is billed at your counter.",
  "No accounting books — no VAT or tax return, journal, balance sheet or e-invoice filing.",
  "No payroll — staff salary, attendance and advances are kept outside this app.",
  "No messaging — no SMS or app alerts to customers or suppliers.",
  "No multi-branch — one installation runs one shop; a second shop needs its own install.",
  "No offline billing — the counter has to reach this shop's own server.",
];

const firstWeek = [
  { title: "Name the shop", text: "Settings → Shop & invoice settings: shop name, address, phone and country. Currency, dates and time zone follow the country." },
  { title: "Build the catalogue", text: "Products: categories, units, pack sizes, selling price and the low-stock level for each item." },
  { title: "Bring in opening stock", text: "Purchases: raise an Opening Stock purchase with cost and selling price per unit, then complete it to move stock." },
  { title: "Start billing", text: "Sales: press F2, find the item, print the slip. Then add staff accounts and tick what each role may do." },
];

export default async function LoginPage() {
  // Force dynamic by accessing connection
  await connection();

  await connectDB();
  const user = await getViewerUser();
  if (user) redirect("/");

  const userCount = await User.countDocuments({});
  if (userCount === 0) redirect("/setup");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-6 pr-16 sm:px-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><ShoppingBag size={21} /></span>
        <span>
          <span className="block text-lg font-bold tracking-tight">StockPilot</span>
          <span className="text-xs text-muted-foreground">Grocery shop management</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Built for one shop, on your own server</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">The counter, the store-room and the dues — in one system.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              StockPilot keeps a grocery shop straight: bill fast at the counter, watch stock fall as it sells, know exactly
              who owes what, and hand out paper your customers expect. Every staff member sees only the screens their role allows.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {promises.map((promise) => (
                <li key={promise} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
                  <Check size={13} className="text-primary" aria-hidden />{promise}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-xl text-[13px] leading-6 text-muted-foreground">
              The counter runs on the keyboard: F2 finds a product, F4 opens the customer, F8 allows a due and F9 finishes the
              invoice — so a queue moves without anyone reaching for the mouse.
            </p>
          </div>
          <AuthForm mode="login" showBrand={false} />
        </section>

        <section className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">What it handles</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {covers.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-border bg-card p-4">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><feature.icon size={17} aria-hidden /></span>
                <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">First week in the shop</h2>
            <ol className="mt-4 space-y-3.5">
              {firstWeek.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground tabular-nums">{index + 1}</span>
                  <span className="text-[13px] leading-5"><span className="font-semibold">{step.title}.</span> <span className="text-muted-foreground">{step.text}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What it does not do</h2>
            <ul className="mt-4 space-y-2.5">
              {outsideScope.map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-5 text-muted-foreground">
                  <X size={15} className="mt-0.5 shrink-0" aria-hidden /><span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p className="flex items-center gap-2"><Store size={14} className="text-primary" aria-hidden />Your shop&apos;s data lives on your own server. Nothing is shared outside your staff accounts.</p>
          <p>
            Developed by{" "}
            <a href="https://bymaza.me" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Mazaharul</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
