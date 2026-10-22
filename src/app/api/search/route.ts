import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { getCurrentUser } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import { Product, Customer, Supplier, Sale, Purchase } from "@/models";

type Suggestion = { type: string; id: string; title: string; subtitle: string; href: string; amount?: string };
type Group = { key: string; label: string; items: Suggestion[] };

const LIMIT = 5;

export async function GET(request: Request) {
  await connectDB();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (query.length < 2) return NextResponse.json({ groups: [] });

  const permissions = new Set(user.rolePermissions.map((entry) => entry.permission));
  const has = (...needed: Permission[]) => needed.some((permission) => permissions.has(permission));

  const productQuery: Promise<Suggestion[]> = has(
    Permission.MANAGE_PRODUCTS, Permission.CREATE_SALES, Permission.CREATE_PURCHASES, Permission.ADJUST_STOCK,
  )
    ? Product.find({ 
        isActive: true, 
        $or: [
          { name: { $regex: query, $options: 'i' } }, 
          { sku: { $regex: query, $options: 'i' } }, 
          { barcode: { $regex: query, $options: 'i' } }
        ] 
      })
      .sort({ name: 1 })
      .limit(LIMIT)
      .lean()
      .then(async (rows) => {
        // Fetch base units for each product
        const productsWithUnits = await Promise.all(
          rows.map(async (row) => {
            const product = await import('@/models').then(m => 
              m.Product.findById(row._id).populate('baseUnitId', 'symbol').lean()
            );
            return { row, unitSymbol: product?.baseUnitId?.symbol || '' };
          })
        );
        
        return productsWithUnits.map(({ row, unitSymbol }) => ({
          type: "product",
          id: row._id,
          title: row.name,
          subtitle: `${row.sku} · ${row.stockOnHand} ${unitSymbol} in stock`,
          href: `/products?q=${encodeURIComponent(row.sku)}`,
        }));
      })
    : Promise.resolve([]);

  const customerQuery: Promise<Suggestion[]> = has(Permission.CREATE_SALES)
    ? Customer.find({ 
        $or: [
          { name: { $regex: query, $options: 'i' } }, 
          { phoneE164: { $regex: query } }, 
          { email: { $regex: query, $options: 'i' } }
        ] 
      })
      .sort({ name: 1 })
      .limit(LIMIT)
      .lean()
      .then((rows) => rows.map((row) => ({
        type: "customer",
        id: row._id,
        title: row.name,
        subtitle: row.phoneE164 ?? row.email ?? "Customer",
        href: `/customers?q=${encodeURIComponent(row.name)}`,
      })))
    : Promise.resolve([]);

  const supplierQuery: Promise<Suggestion[]> = has(Permission.CREATE_PURCHASES)
    ? Supplier.find({ 
        $or: [
          { name: { $regex: query, $options: 'i' } }, 
          { phoneE164: { $regex: query } }, 
          { email: { $regex: query, $options: 'i' } }
        ] 
      })
      .sort({ name: 1 })
      .limit(LIMIT)
      .lean()
      .then((rows) => rows.map((row) => ({
        type: "supplier",
        id: row._id,
        title: row.name,
        subtitle: row.phoneE164 ?? row.email ?? "Supplier",
        href: `/suppliers?q=${encodeURIComponent(row.name)}`,
      })))
    : Promise.resolve([]);

  const saleQuery: Promise<Suggestion[]> = has(Permission.VIEW_REPORTS, Permission.CREATE_SALES)
    ? Sale.find({ 
        $or: [
          { invoiceNumber: { $regex: query, $options: 'i' } },
        ] 
      })
      .populate('customerId', 'name')
      .sort({ soldAt: -1 })
      .limit(LIMIT)
      .lean()
      .then((rows) => rows.map((row) => ({
        type: "sale",
        id: row._id,
        title: row.invoiceNumber,
        subtitle: (row.customerId as any)?.name ?? "Walk-in",
        amount: String(row.total),
        href: `/sales/${row._id}`,
      })))
    : Promise.resolve([]);

  const purchaseQuery: Promise<Suggestion[]> = has(Permission.VIEW_REPORTS, Permission.CREATE_PURCHASES)
    ? Purchase.find({ 
        $or: [
          { invoiceNumber: { $regex: query, $options: 'i' } },
        ] 
      })
      .populate('supplierId', 'name')
      .sort({ purchasedAt: -1 })
      .limit(LIMIT)
      .lean()
      .then((rows) => rows.map((row) => ({
        type: "purchase",
        id: row._id,
        title: row.invoiceNumber,
        subtitle: (row.supplierId as any)?.name ?? "Supplier",
        amount: String(row.total),
        href: `/purchases/${row._id}`,
      })))
    : Promise.resolve([]);

  const [products, customers, suppliers, sales, purchases] = await Promise.all([
    productQuery, customerQuery, supplierQuery, saleQuery, purchaseQuery,
  ]);

  const groups: Group[] = [
    { key: "products", label: "Products", items: products },
    { key: "customers", label: "Customers", items: customers },
    { key: "suppliers", label: "Suppliers", items: suppliers },
    { key: "sales", label: "Sales", items: sales },
    { key: "purchases", label: "Purchases", items: purchases },
  ].filter((group) => group.items.length > 0);

  return NextResponse.json({ groups });
}
