# StockPilot

Self-hosted grocery shop management software. Each shop runs its own StockPilot server and MongoDB database; business data is not stored in a central StockPilot database.

## Stack

- Next.js App Router and TypeScript
- Tailwind CSS 4, Lucide React, Recharts, and next-themes
- MongoDB 7+, Mongoose ODM 9, Zod validation
- HTTP-only JWT access and rotating refresh cookies
- jsPDF and AutoTable for filtered PDF reports
- pnpm package manager

**Note:** This project has been migrated from PostgreSQL + Prisma to MongoDB + Mongoose. See `MIGRATION_GUIDE.md` for details.

## Development setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Make sure MongoDB is running locally or set `MONGODB_URI` in your `.env` file to point to your MongoDB instance.

## Vercel deployment

1. Import the Git repository into Vercel and keep the detected Next.js framework and default `pnpm build` command.
2. Create a managed PostgreSQL database and set `DATABASE_URL` to its connection string in Vercel. Use separate databases for Preview and Production deployments.
3. Set unique `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in each Vercel environment. Keep secrets server-only; do not use `NEXT_PUBLIC_` names.
4. Deploy. The build script generates Prisma Client for every build and applies committed migrations to the matching Preview or Production database before building the app.
5. Open the deployed app and create the first owner account from the First-time setup page.

Vercel hosts the Next.js app; it does not host the Compose database. Database URLs and secrets must be configured before the deployment build starts.


## Features

- Dashboard with today's sales, purchases, estimated profit, stock alerts, and chart
- Products, categories, product-specific units and package conversions; barcode, batch and expiry fields are optional
- Inventory levels, movement history, manual adjustments and reorder alerts
- POS and purchase invoices with percentage/fixed discounts, payment tracking and transactional stock updates
- Customer and supplier directories, invoice history, due balances and payment collection
- Returns, eligible unpaid invoice cancellation, expenses and audit history
- Shop settings for country, currency, locale, timezone, costing method, payment methods, invoice numbering and staff permissions
- Filtered sales, purchase, product, profit/loss, expenses, stock, expiry and due reports with jsPDF export
- Light, dark and system appearance preferences
- Protected workspace pages, HTTP-only JWT cookies, rotating refresh tokens and server-enforced permissions

Invoice details use print-friendly layouts. The application is online-only and requires a live server and PostgreSQL connection for business operations.

## Source layout

```text
src/app/                 App Router pages and API route handlers
src/components/          Dashboard, modules, shared UI and providers
src/lib/constants/       Shared defaults and app constants
src/lib/                 Database, authentication, validation and formatting
```

Bundled Inter and Noto Sans Bengali variable font files and OFL notices are in `public/fonts/` so builds do not depend on Google Fonts being reachable.
