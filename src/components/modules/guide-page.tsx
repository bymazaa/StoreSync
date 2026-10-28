"use client";

import Link from "next/link";
import {
  Activity, ArrowDownToLine, BadgeCheck, BookOpen, Boxes, ChartNoAxesCombined, CircleAlert, CircleDollarSign,
  CircleHelp, FileText, History, Hourglass, KeyRound, LayoutDashboard, ListChecks, MapPin, MousePointerClick,
  PackageSearch, Printer, RotateCcw, Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Truck, UsersRound,
} from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/page";
import { useShopPermissions } from "@/components/app/shop-context";

const features = [
  { icon: LayoutDashboard, title: "Dashboard", where: "Sidebar → Dashboard", text: "Today's net sales, net purchases, estimated profit, active products, items that need restocking, and the last few invoices — all on one screen.", href: "/", requires: ["VIEW_REPORTS"] },
  { icon: ShoppingCart, title: "Sales & POS", where: "Sidebar → Sales & POS", text: "Build an invoice by searching name, SKU or barcode, take payment, sell on credit with Allow due, then print an A4 invoice or an 80 mm receipt.", href: "/sales", requires: ["CREATE_SALES"] },
  { icon: ShoppingBag, title: "Purchases", where: "Sidebar → Purchases", text: "This is where stock enters the shop. Enter quantity, what you paid per unit and the selling price per unit; completing the purchase moves stock.", href: "/purchases", requires: ["CREATE_PURCHASES"] },
  { icon: Boxes, title: "Products", where: "Sidebar → Products", text: "The catalogue: product name, category, stock unit, low-stock alert level, brand, barcode and automatic SKU. Also categories, units, and a Barcode stickers panel that prints the product SKU as a barcode with the selling price on A4 sheets (12 large stickers per page).", href: "/products", requires: ["MANAGE_PRODUCTS", "CREATE_SALES", "CREATE_PURCHASES"] },
  { icon: Activity, title: "Inventory", where: "Sidebar → Inventory", text: "Current stock with Low stock flags, a manual Adjust stock form (stock in / stock out with a reason), and the full movement history.", href: "/inventory", requires: ["ADJUST_STOCK", "VIEW_REPORTS", "MANAGE_PRODUCTS"] },
  { icon: UsersRound, title: "Customers", where: "Sidebar → Customers", text: "Contacts, their invoices, outstanding balance, and a Collect payment form per unpaid invoice. After a payment is saved, print an 80 mm payment receipt for the customer.", href: "/customers", requires: ["CREATE_SALES"] },
  { icon: Truck, title: "Suppliers", where: "Sidebar → Suppliers", text: "Supplier details, purchase history, what you still owe them, and payment recording with a printable proof-of-payment slip.", href: "/suppliers", requires: ["CREATE_PURCHASES"] },
  { icon: FileText, title: "Reports", where: "Sidebar → Reports", text: "Sales, purchases, product performance, profit & loss, stock valuation, dues and expenses. The period opens on the last 30 days and the dropdown has Last 3 / 7 / 15 / 30 days, All time or a custom date range. Every report prints as a bank-style statement with the shop header, entry numbers and amount totals — choose “Save as PDF” in the print dialog to keep it as a file. The Customer & supplier due report lists every unpaid customer and supplier with 0–30 / 31–60 / 60+ day columns.", href: "/reports", requires: ["VIEW_REPORTS"] },
  { icon: History, title: "Activity log", where: "Sidebar → Activity log", text: "Who did what and when: every product change, sale, return, stock adjustment, expense, payment and settings change, with the reason and the sign-in IP address. Filter by staff member, area, action, date or invoice number. Owners and managers only.", href: "/activity", requires: ["MANAGE_SETTINGS", "MANAGE_USERS"] },
  { icon: CircleDollarSign, title: "Expenses", where: "Sidebar → Expenses", text: "Shop costs (rent, labour, utilities) with date, amount, category and payment method. Wrong entries are voided, never erased.", href: "/expenses", requires: ["MANAGE_EXPENSES", "VIEW_REPORTS"] },
  { icon: Settings2, title: "Settings", where: "Sidebar → Settings", text: "Shop identity, country and currency, invoice prefixes, costing method, payment methods, staff accounts and role permissions.", href: "/settings", requires: ["MANAGE_SETTINGS", "MANAGE_USERS"] },
];

const roles = [
  { icon: BadgeCheck, name: "Shop owner", tag: "OWNER", text: "The account created at setup. Only an owner can create staff accounts and decide what each role is allowed to do. This role cannot be assigned to a new account from the staff form." },
  { icon: UsersRound, name: "Manager", tag: "MANAGER", text: "Runs the shop day to day. Normally everything: buys stock, sells, adjusts stock, reads reports, records expenses — you decide by ticking the permission boxes." },
  { icon: ShoppingCart, name: "Cashier", tag: "CASHIER", text: "Front counter. Creates sales, adds customers, collects payments. Usually no purchases, no stock adjustments and no settings." },
  { icon: Boxes, name: "Stock clerk", tag: "STOCK_CLERK", text: "Warehouse side. Receives purchases, keeps the catalogue and stock counts correct. Usually no sales at the counter." },
];

const setupSteps = [
  {
    title: "Name the shop and pick its country",
    where: "Sidebar → Settings → panel “Shop & invoice settings”",
    actions: [
      "Fill Shop name, Shop address and Shop phone (optional), and a Logo URL if you want the logo on invoices.",
      "Choose Country — StockPilot then sets Currency (automatic), date, number and time-zone formats for you; the currency box is read-only on purpose.",
      "Set Sale invoice prefix (default SP) and Purchase invoice prefix (default PO) so invoice numbers match how you already write bills.",
      "Choose How profit cost is calculated: Weighted average is the safe default for a general store; FIFO suits goods whose cost changes per batch.",
      "Press Save shop settings and wait for the “Shop settings saved.” message.",
    ],
    next: "Next, stay on the same page and open the “Payment methods” panel — see step 2.",
  },
  {
    title: "Turn on the payment methods you actually take",
    where: "Sidebar → Settings → panel “Payment methods”",
    actions: [
      "Cash, Card, Bank transfer and Mobile payment already exist. Use the Enabled / Disabled button to switch one off — methods are not deleted, so old invoices keep their history.",
      "To add one, type a Unique code such as mobile-money (lowercase letters, numbers and hyphens only), a Display name, pick the kind, then Add method.",
    ],
    next: "Then go to Products and prepare the catalogue — steps 3 and 4.",
  },
  {
    title: "Create categories and stock units",
    where: "Sidebar → Products → panels “Categories” and “Units”",
    actions: [
      "Under Categories type a Category name such as Drinks or Household and press Add category. Description is optional.",
      "Under Units add the way you count stock: Unit name (Kilogram), Symbol (kg), Unique code (kg) → Add unit. Every product must pick one of these as its stock unit.",
      "Units are for loose counting; pack sizes are handled per product later (Package conversions).",
    ],
    next: "Then add your products — step 4.",
  },
  {
    title: "Add products (stock is still zero at this point)",
    where: "Sidebar → Products → button “Add product”",
    actions: [
      "Product name is the only required field. Pick a Category (default Uncategorized) and a Stock unit, then set a Low stock alert level so the dashboard warns you in time.",
      "SKU shows as Auto generated (RIC-###) — do not invent one. It comes from the category name and counts up, so Rice gets RIC-001, RIC-002, RIC-003. Brand and Barcode are optional; add the manufacturer barcode here if the packet already has one.",
      "Press Create product. The new row appears with stock 0 and no prices.",
    ],
    next: "Important: a product is only a catalogue entry. Stock and both prices arrive with the first purchase — step 5.",
  },
  {
    title: "Receive the first purchase — this is what puts stock in the shop",
    where: "Sidebar → Purchases → New purchase",
    actions: [
      "Panel “Add products”: search by name/SKU or scan into “Search or scan barcode”. A scanner presses Enter by itself, so a unique match lands on the invoice immediately; when several products match, click the right one.",
      "Panel “Invoice items”: enter Qty, the Cost you paid per stock unit, and the required Selling price / stock unit (what a customer pays). Selling price entered here is what the counter later charges.",
      "Tick Track batches for this product / Track expiry for this product only for goods that need it (medicines, perishables) and fill Batch number or expiry date. Leave them off for ordinary goods.",
      "Panel “Supplier”: choose an existing supplier or type a new supplier name (a supplier is required). Add Supplier invoice number (optional) to match the paper bill, and Additional landed cost for freight or loading.",
      "Panel “Discount and payment”: enter Paid amount, or tick Allow due if you owe part of it; choose the Payment method. Then press Complete purchase.",
    ],
    next: "Stock and cost update together the moment the purchase completes. Confirm it on Sidebar → Inventory → Current stock, then continue to step 6.",
  },
  {
    title: "Add staff and decide what each role may do",
    where: "Sidebar → Settings → panel “Staff accounts”",
    actions: [
      "Enter Full name, Email and a Temporary password of at least 12 characters, choose Role (manager, cashier or stock clerk) and press Create account.",
      "Open the “Role permissions” panel below: each role has its own checklist of 12 actions in three groups — Counter (New sale / POS, Payments and due collection, Returns and invoice cancel, Discount on invoice), Stock (Products, units, batches, Raise a purchase, Receive purchase stock, Stock adjustments) and Shop (Expenses and void expense, Reports and statements, Shop settings, Staff accounts and roles). Tick what that role needs, or use Select all / Clear, then press Save role permissions — it stays disabled until something actually changes.",
      "Hand over the password. On first login the staff member opens their own Settings → Change password panel and sets a private one (12+ characters; this signs out their other sessions).",
      "To stop someone keeping the shop, press Disable in the Access column of their row — that is the normal way to retire a staff account, because their sales, purchases and adjustments keep a traceable author. Delete removes the login entirely and is offered only for an account that never recorded anything (a mistake or a test account); if it already traded, the app refuses and tells you to disable it instead.",
    ],
    next: "Now the counter is ready — sell your first invoice (step 7).",
  },
  {
    title: "Make the first sale and print the bill",
    where: "Sidebar → Sales & POS → New sale",
    actions: [
      "Add products: the search box is already focused when the page opens, so scan or type straight away (Enter adds a unique match), or search and click a result for each line, then adjust Qty.",
      "The price on a sale line comes from the product's selling price and is read-only at the counter — change it permanently from the purchase/product record, not during a sale.",
      "Panel “Customer”: search by phone, name or email, or type new details. Leave it empty for a walk-in sale.",
      "Panel “Discount and payment”: apply a Percentage or Fixed amount discount if your role has the apply discounts permission; enter Paid amount, or tick Allow due to sell on credit and see the Due: preview (a credit sale needs a customer with a phone number); choose the Payment method.",
      "Press Complete sale. The success screen confirms the invoice and stock moved together, and offers Open printable invoice or Create another.",
      "On the invoice: Print invoice (one A4 page) or Print 80 mm receipt for a thermal printer.",
    ],
    next: "End of day: check Sidebar → Dashboard, and export statements from Sidebar → Reports.",
  },
];

const scenarios = [
  { icon: RotateCcw, when: "A customer brings goods back", where: "Open that invoice (Sidebar → Sales → the invoice number)", steps: "In the “Process customer return” panel enter Return quantity per line, pick a Return batch/expiry if tracked, add a Return reason, choose a Refund method if money goes back, then press Complete return. Stock and the balance correct themselves." },
  { icon: CircleDollarSign, when: "A credit customer pays part of their due", where: "Sidebar → Customers → that customer's History", steps: "Read Outstanding balance, then on the unpaid invoice type Amount to collect, pick the method (Reference is optional) and press Record payment. The same form exists for suppliers under Sidebar → Suppliers." },
  { icon: Activity, when: "The physical count does not match the app", where: "Sidebar → Inventory → panel “Adjust stock”", steps: "Pick the product, choose Stock in or Stock out, enter Quantity, and fill the required Reason note (broken, theft, count correction). Press Save adjustment — it appears in Movement history with your name." },
  { icon: CircleAlert, when: "A sale was entered by mistake and nothing was paid", where: "Open that invoice", steps: "Use the “Cancel unpaid invoice” panel and press Cancel invoice; you are asked to confirm because it reverses the stock movement. Once any payment is recorded, cancellation is not allowed — process a return instead." },
  { icon: CircleDollarSign, when: "A shop cost was recorded wrongly", where: "Sidebar → Expenses", steps: "Press Void on the row, write the required reason and press Confirm Void. The expense is excluded from profit but kept in history — that is deliberate." },
  { icon: ShoppingBag, when: "More stock arrives from the same supplier", where: "Sidebar → Purchases → New purchase", steps: "Repeat step 5. Costing is recalculated from the new cost, so always enter the real per-unit cost — it drives the profit figure." },
  { icon: Printer, when: "You need paperwork for the owner or an audit", where: "Sidebar → Reports", steps: "Pick the report type, set From and To dates, press Refresh, then Print / Save PDF. Choose “Save as PDF” as the destination; Bengali and English text both save correctly because it prints the page itself." },
  { icon: Hourglass, when: "An item shows as out of stock during a sale", where: "The blocked sale screen", steps: "Press Create a purchase to receive stock from a supplier, complete it, then come back and finish the sale. Selling below zero is not allowed." },
  { icon: KeyRound, when: "A staff member forgets their password", where: "Sidebar → Settings → panel “Staff accounts”", steps: "Press Reset password in their row, type a new temporary password of at least 12 characters and press Set password. Hand it over in person: it works on their next sign-in and every session they were signed in from is signed out. Only an owner or manager with the staff-accounts permission sees this. The owner’s own account cannot be reset here — use option 4 of the Start StockPilot.bat server menu instead." },
];

const words = [
  { icon: PackageSearch, title: "SKU", text: "The short internal code StockPilot gives each product: the category initial letters plus a running number (RIC-001, RIC-002 for rice). It is shown on the product row, on every printed sticker and on invoices, so staff can remember it, type it at the counter or scan it." },
  { icon: Boxes, title: "Stock unit and package conversion", text: "The unit stock is counted in, such as piece or kilogram. In a product's Package conversions, Add unit links a bigger pack to that unit — one carton = 24 pieces." },
  { icon: CircleDollarSign, title: "Cost price and selling price", text: "Cost is what the shop pays the supplier; selling price is what the customer pays. Both are entered per stock unit on the purchase line." },
  { icon: Truck, title: "Additional landed cost", text: "Freight, loading or any extra charge to bring stock into the shop. It is added to the purchase value, so profit is not overstated." },
  { icon: Activity, title: "Batch and expiry", text: "A batch groups goods received together; expiry is the last date they should be sold. Turn tracking on while purchasing the product — from then on that product keeps tracking." },
  { icon: CircleDollarSign, title: "Paid and due", text: "Paid is money that moved now. Due is the unpaid balance on that invoice — a customer due is money coming to you, a supplier due is money you owe." },
  { icon: UsersRound, title: "Walk-in customer", text: "A sale with no customer attached. It counts in sales and stock, but it cannot carry a due: a credit sale is rejected unless the customer has a phone number." },
  { icon: LayoutDashboard, title: "Low stock alert / reorder level", text: "The quantity you set per product. When stock on hand reaches it, the item appears in the dashboard's Needs restock list." },
  { icon: ShieldCheck, title: "Void vs cancel", text: "Cancel reverses a whole unpaid invoice and puts stock back. Void marks one record (an expense) as invalid while keeping it visible. Neither deletes history." },
  { icon: ChartNoAxesCombined, title: "Costing method", text: "Weighted average values stock using the running average cost; FIFO assumes the oldest units sell first. Choose it before trading — switching later silently changes valuation of existing stock." },
  { icon: ListChecks, title: "Movement history", text: "Every stock change with when, product, reason, quantity and the running balance — purchases, sales, returns, cancellations and manual adjustments." },
  { icon: Hourglass, title: "Due aging (0–30 / 31–60 / 60+)", text: "How long each unpaid invoice has been outstanding, counted from its invoice date in Reports → Customer & supplier due. Older money is the one to chase first; the due table keeps it in separate columns with the customer’s phone and address." },
  { icon: History, title: "Activity log", text: "The shop's own record of every change: staff name, time, what was done and the reason. It is written by the app, cannot be edited from any screen, and is the place to look when stock, dues or an invoice looks wrong." },
];

const rules = [
  { icon: KeyRound, title: "Passwords are 12 characters or more", text: "The staff form, the Reset password row action and the Change password panel all enforce it, and either change signs that person out of their other sessions." },
  { icon: ShieldCheck, title: "Permissions are checked on the server", text: "A page being hidden is not the only protection — every save re-checks the logged-in staff member's role permissions." },
  { icon: Printer, title: "Nothing is deleted after completion", text: "Completed invoices are corrected with returns or cancellation, and expenses with void, so the audit trail always explains the numbers." },
  { icon: BookOpen, title: "Money is exact", text: "Amounts are stored as exact decimals, so totals, dues and profit do not drift with rounding." },
  { icon: MousePointerClick, title: "Your data stays on your own server", text: "StockPilot runs against your own database; there is no external account or third-party copy of shop records." },
];

const serverMenu = [
  { key: "1", name: "Start StockPilot and open the browser", text: "Switches the server on and opens the shop. If it asks you to wait, the first start can take a couple of minutes." },
  { key: "2", name: "Stop StockPilot", text: "Switches the server off cleanly. All shop data stays safe on the disk — nothing is lost." },
  { key: "3", name: "Show staff list", text: "Prints every staff account with name, email and role, straight from the database." },
  { key: "4", name: "Reset a password (admin or staff)", text: "Type the account's email and it gives a new password. This is the only way to reset the owner's own password — the app cannot do it." },
  { key: "5", name: "Change an account email", text: "Moves an account from its old email to a new one — useful when a staff member's address changes." },
  { key: "6", name: "Add a staff member", text: "Creates an account from the menu: full name, email and role (OWNER, MANAGER, CASHIER or STOCK_CLERK)." },
  { key: "7", name: "Remove a staff member", text: "Deletes an account by email." },
  { key: "8", name: "Backup all data to a file", text: "Writes every table and every record into one file inside the backups folder, named stockpilot-date-time.gz. Take one before any big change, and keep copies somewhere outside the shop computer from time to time." },
  { key: "9", name: "Restore data from a backup", text: "Shows the backups as a numbered list — type the number of the file you want. It asks twice (YES, then the word RESTORE) and automatically saves a safety copy of the current data first. Everything recorded after that backup was made is replaced." },
  { key: "0", name: "Exit", text: "Closes the menu." },
];

export function GuidePage() {
  const permissions = useShopPermissions();
  const visibleFeatures = features.filter((feature) => feature.requires.some((permission) => permissions.includes(permission)));

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="StockPilot handbook" title="Guide & first-time setup" description="Plain-language instructions for running a shop in StockPilot: what to click, in what order, and what happens next." />

      <Panel title="What StockPilot does for your shop" description="Six jobs it handles so the counter and the godown agree.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Mini icon={ShoppingCart} title="Bills customers and takes payment" text="Cash, card, bank or mobile payment in one screen, with a printable A4 invoice or 80 mm thermal receipt." />
          <Mini icon={Boxes} title="Keeps one live stock count" text="Purchases add stock, sales remove it, returns and adjustments are recorded with a reason — no second notebook." />
          <Mini icon={CircleDollarSign} title="Tracks who owes what" text="Sell on credit with Allow due, then collect part or full payments and watch each balance shrink." />
          <Mini icon={ChartNoAxesCombined} title="Shows estimated profit" text="Net sales minus cost of goods and recorded expenses, for today or any date range in Reports." />
          <Mini icon={UsersRound} title="Limits what staff can see" text="Create cashier, manager or stock-clerk accounts and tick exactly the actions each role may perform." />
          <Mini icon={FileText} title="Produces the paperwork" text="Sales, purchases, product performance, stock valuation, dues, expenses and profit & loss — filterable and printable." />
        </div>
      </Panel>

      <Panel title="Who uses it — the four roles" description="What each account type normally does. The exact allowed actions are yours to choose.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{roles.map((role) => <Mini key={role.tag} icon={role.icon} title={`${role.name} · ${role.tag}`} text={role.text} />)}</div>
        <Callout icon={Settings2} title="Where you decide this" text="Sidebar → Settings → panel “Role permissions”. One checklist per role and a Save role permissions button next to each. Un-ticked actions disappear for that staff member, and the server rejects them too." />
      </Panel>

      <Panel title="Where everything lives" description="The left sidebar is the whole app. Your role decides which rows you see.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-2.5">Sidebar item</th><th className="px-3 py-2.5">Open it to</th><th className="px-3 py-2.5">Who normally uses it</th></tr></thead>
            <tbody className="divide-y divide-border">
              <PlaceRow href="/" label="Dashboard" use="See today at a glance and jump to any problem area" who="Owner, manager" />
              <PlaceRow href="/sales" label="Sales & POS" use="Ring up a sale, print a bill, start a return, cancel an unpaid invoice" who="Cashier, manager" />
              <PlaceRow href="/purchases" label="Purchases" use="Receive stock from a supplier and set its cost and selling price" who="Stock clerk, manager" />
              <PlaceRow href="/products" label="Products" use="Add products, categories and units; edit names and alert levels" who="Stock clerk, manager" />
              <PlaceRow href="/inventory" label="Inventory" use="Check stock levels, adjust counts, read movement history" who="Stock clerk, manager" />
              <PlaceRow href="/customers" label="Customers" use="Save contacts, see dues, collect payment, raise a customer return" who="Cashier, manager" />
              <PlaceRow href="/suppliers" label="Suppliers" use="Supplier bills, what you owe, record supplier payments" who="Stock clerk, manager" />
              <PlaceRow href="/expenses" label="Expenses" use="Record rent, labour, utilities; void a wrong entry" who="Owner, manager" />
              <PlaceRow href="/reports" label="Reports" use="Any period's sales, purchases, profit & loss, valuation, dues — print or save as PDF" who="Owner, manager" />
              <PlaceRow href="/settings" label="Settings" use="Shop identity, country and currency, invoice prefixes, costing, payment methods, staff, permissions, password" who="Owner only, usually" />
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Set up your shop in this order" description="Do these seven steps once, top to bottom. Each one says where to go, what to press, and what to do next.">
        <ol className="space-y-4">{setupSteps.map((step, index) => <Step key={step.title} number={index + 1} {...step} />)}</ol>
      </Panel>

      <Panel title="Day to day: what to do when…" description="The situations that come up at the counter or in the godown, with the exact place to fix them.">
        <div className="grid gap-3 lg:grid-cols-2">{scenarios.map((scenario) => (
          <div key={scenario.when} className="rounded-2xl border border-border bg-background p-4">
            <p className="flex items-start gap-2 text-sm font-semibold text-foreground"><scenario.icon size={16} className="mt-0.5 shrink-0 text-primary" />{scenario.when}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary"><MapPin size={12} className="mt-0.5 shrink-0" />{scenario.where}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{scenario.steps}</p>
          </div>
        ))}</div>
      </Panel>

      <Panel title="Your modules" description="Every part of the app, where it is, and what it is for. Rows you cannot see are blocked for your role.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleFeatures.map(({ icon: Icon, title, text, where, href }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={17} /></span>
              <h2 className="mt-3 text-sm font-semibold group-hover:text-primary">{title}</h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary/80"><MapPin size={12} className="mt-0.5 shrink-0" />{where}</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p>
            </Link>
          ))}
        </div>
        <Callout icon={ArrowDownToLine} title="The one rule people miss" text="Adding a product does not put stock in the shop. Stock appears only after a purchase is completed — that is what keeps the stock count, the supplier bill and the cost price tied together. For the same reason, Inventory → Adjust stock refuses “Stock in” for a product that has no selling price yet; use a purchase for opening stock and keep adjustments for count corrections." />
      </Panel>

      <Panel title="Server menu (Start StockPilot.bat)" description="On the shop's own computer there is a file named Start StockPilot.bat. Double-click it to open a small menu — the owner uses it for the jobs that cannot be done from inside the app, straight on the database. Pick a number and answer the questions it asks.">
        <ol className="space-y-2.5 border-l border-border pl-4">
          {serverMenu.map((item) => (
            <li key={item.key} className="relative text-sm leading-6 text-muted-foreground">
              <span className="absolute -left-[21px] top-1.5 grid size-3.5 place-items-center rounded-full bg-muted text-[8px] font-bold text-foreground tabular-nums">{item.key}</span>
              <span className="font-semibold text-foreground">{item.name}</span> — {item.text}
            </li>
          ))}
        </ol>
        <Callout icon={ShieldCheck} title="This menu belongs to the owner" text="It works directly on the database, so it ignores the role permissions of the app. Keep it away from the counter staff." />
      </Panel>

      <Panel title="Words made simple" description="Short meanings for the terms you see on screens and invoices.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{words.map((word) => <Mini key={word.title} icon={word.icon} title={word.title} text={word.text} />)}</div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Worked example: rice</p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Create “Miniket rice” with stock unit kilogram and a low-stock alert of 10 kg. Nothing is in stock yet. When 50 kg arrives, record a purchase: quantity 50 kg, cost 62 per kg, selling price 75 per kg, supplier “Alhaj Traders”, paid 30,000 with Allow due on the rest. Complete the purchase — stock becomes 50 kg and the supplier due is 1000. A customer then buys 2 kg for cash: the sale line is 2 × 75 = 150, stock drops to 48 kg, and profit uses the average cost of that rice. Later you pay 500 of the supplier due from Sidebar → Suppliers.</p>
        </div>
      </Panel>

      <Panel title="Rules worth knowing before anything goes wrong" description="Behaviour that is intentional — understanding these saves confusing arguments about numbers.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rules.map((rule) => <Mini key={rule.title} icon={rule.icon} title={rule.title} text={rule.text} />)}</div>
        <Callout icon={CircleHelp} title="If something still does not add up" text="Read the exact error message on the screen — it names the missing field or the permission you lack. Stock mysteries are solved in Sidebar → Inventory → Movement history: every change shows who made it, when, and the reason given." />
      </Panel>
    </div>
  );
}

function Step({ number, title, where, actions, next }: { number: number; title: string; where: string; actions: string[]; next: string }) {
  return (
    <li className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground tabular-nums">{number}</span>
        <h3 className="text-sm font-semibold text-foreground sm:text-[15px]">{title}</h3>
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary"><MapPin size={12} className="mt-0.5 shrink-0" />{where}</p>
      <ol className="mt-3 space-y-2 border-l border-border pl-4">
        {actions.map((action, index) => <li key={action} className="relative text-sm leading-6 text-muted-foreground"><span className="absolute -left-[21px] top-1.5 grid size-3.5 place-items-center rounded-full bg-muted text-[8px] font-bold text-foreground tabular-nums">{index + 1}</span>{action}</li>)}
      </ol>
      <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-foreground"><span className="font-semibold text-primary">Then →</span> {next}</p>
    </li>
  );
}

function PlaceRow({ href, label, use, who }: { href: string; label: string; use: string; who: string }) {
  return (
    <tr>
      <td className="px-3 py-3 align-top"><Link href={href} className="text-sm font-semibold text-foreground hover:text-primary">{label}</Link></td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">{use}</td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">{who}</td>
    </tr>
  );
}

function Callout({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon size={16} /></span>
      <div><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
    </div>
  );
}

function Mini({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="rounded-2xl border border-border bg-background p-4"><Icon size={16} className="text-primary" /><h3 className="mt-2 text-xs font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}
