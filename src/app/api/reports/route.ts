import { NextResponse } from "next/server";
import { CostingMethod, Permission, PurchaseStatus, SaleStatus, UserRole } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import Sale from "@/models/Sale";
import SaleItem from "@/models/SaleItem";
import SaleReturn from "@/models/SaleReturn";
import SaleReturnItem from "@/models/SaleReturnItem";
import Purchase from "@/models/Purchase";
import PurchaseReturn from "@/models/PurchaseReturn";
import Expense from "@/models/Expense";
import Product from "@/models/Product";
import Unit from "@/models/Unit";
import Category from "@/models/Category";
import InventoryBatch from "@/models/InventoryBatch";
import Customer from "@/models/Customer";
import Supplier from "@/models/Supplier";
import PaymentMethod from "@/models/PaymentMethod";
import User from "@/models/User";
import Settings from "@/models/Settings";
import { apiError } from "@/lib/http/api-response";
import { reportDateRange } from "@/lib/date-time";

// Helper to convert Decimal128/string to number
const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
};

export async function GET(request: Request) {
  const guard = await authorized(Permission.VIEW_REPORTS);
  if ("response" in guard) return guard.response;
  await connectDB();

  const canViewProfit = guard.user.role === UserRole.OWNER || guard.user.role === UserRole.MANAGER;
  
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "sales";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const settings = await Settings.findById("shop").select("currencyCode costingMethod timezone shopName address phone").lean();
  const shop = { name: settings?.shopName ?? "StockPilot", address: settings?.address ?? null, phone: settings?.phone ?? null };
  
  let dateRange;
  try { dateRange = reportDateRange(from, to, settings?.timezone ?? "America/New_York"); }
  catch (error) { return apiError(400, "BAD_REQUEST", error instanceof Error ? error.message : "Invalid date range."); }
  
  const dateFilter = dateRange ? { soldAt: dateRange } : {};
  const purchaseDateFilter = dateRange ? { purchasedAt: dateRange } : {};
  const saleStatuses = { $in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED, SaleStatus.RETURNED] };

  if (type === "sales") {
    const sales = await Sale.find({ status: saleStatuses, ...dateFilter })
      .sort({ soldAt: -1 })
      .limit(5000)
      .lean();
    
    const saleIds = sales.map(s => s._id);
    const [items, returns, customers] = await Promise.all([
      SaleItem.find({ saleId: { $in: saleIds } }).lean(),
      SaleReturn.find({ saleId: { $in: saleIds }, status: "COMPLETED" }).lean(),
      Customer.find({ _id: { $in: sales.map(s => s.customerId).filter(Boolean) } }).lean(),
    ]);
    
    const customerMap = new Map(customers.map(c => [c._id, c]));
    const salesWithCustomer = sales.map(sale => ({
      ...sale,
      id: sale._id,
      customer: sale.customerId ? (customerMap.get(sale.customerId) || null) : null,
    }));
    
    const grossSales = sales.reduce((sum, sale) => sum + sale.subtotal - sale.discountAmount, 0);
    const returnedSales = returns.reduce((sum, entry) => sum + entry.total, 0);
    const revenue = grossSales - returnedSales;
    
    const summary: Record<string, string | number> = { 
      invoiceCount: sales.length, 
      grossSales: grossSales.toFixed(2), 
      returns: returnedSales.toFixed(2), 
      revenue: revenue.toFixed(2), 
    };

    if (canViewProfit) {
      const soldCost = items.reduce((sum, item) => sum + (item.baseQuantity * item.costPerBaseUnit), 0);
      let returnedCost = 0;
      for (const ret of returns) {
        const retItems = await SaleReturnItem.find({ returnId: ret._id }).lean();
        for (const item of retItems) {
          const saleItem = await SaleItem.findById(item.saleItemId).lean();
          if (saleItem) {
            returnedCost += item.baseQuantity * saleItem.costPerBaseUnit;
          }
        }
      }
      const cogs = soldCost - returnedCost;
      summary.costOfGoods = cogs.toFixed(2);
      summary.grossProfit = (revenue - cogs).toFixed(2);
    }
    
    return NextResponse.json({ 
      type, shop, currencyCode: settings?.currencyCode ?? "USD", 
      sales: salesWithCustomer, 
      summary, 
      productItems: items 
    });
  }

  if (type === "profit-loss") {
    if (!canViewProfit) {
      return apiError(403, "FORBIDDEN", "Only shop owners and managers can view profit and loss reports.");
    }

    const sales = await Sale.find({ status: saleStatuses, ...dateFilter })
      .select("_id invoiceNumber soldAt subtotal discountAmount")
      .sort({ soldAt: -1 })
      .limit(5000)
      .lean();
    
    const saleIds = sales.map(s => s._id);
    const [items, returns, expenses] = await Promise.all([
      SaleItem.find({ saleId: { $in: saleIds } }).select("baseQuantity costPerBaseUnit").lean(),
      SaleReturn.find({ saleId: { $in: saleIds }, status: "COMPLETED" }).lean(),
      Expense.aggregate([
        { $match: { voidedAt: null, ...(dateRange ? { expenseDate: dateRange } : {}) } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
      ])
    ]);
    
    const grossSales = sales.reduce((sum, sale) => sum + sale.subtotal - sale.discountAmount, 0);
    const returnedSales = returns.reduce((sum, entry) => sum + entry.total, 0);
    const revenue = grossSales - returnedSales;
    const soldCost = items.reduce((sum, item) => sum + (item.baseQuantity * item.costPerBaseUnit), 0);
    
    let returnedCost = 0;
    for (const ret of returns) {
      const retItems = await SaleReturnItem.find({ returnId: ret._id }).lean();
      for (const item of retItems) {
        const saleItem = await SaleItem.findById(item.saleItemId).lean();
        if (saleItem) {
          returnedCost += item.baseQuantity * saleItem.costPerBaseUnit;
        }
      }
    }
    
    const costOfGoods = soldCost - returnedCost;
    const expenseTotal = expenses[0]?.totalAmount || 0;
    const expenseCount = expenses[0]?.count || 0;
    const grossProfit = revenue - costOfGoods;
    
    return NextResponse.json({
      type, currencyCode: settings?.currencyCode ?? "USD", sales, summary: {
        invoiceCount: sales.length, grossSales: grossSales.toFixed(2), returns: returnedSales.toFixed(2), revenue: revenue.toFixed(2), costOfGoods: costOfGoods.toFixed(2),
        grossProfit: grossProfit.toFixed(2), expenseCount, expenses: expenseTotal.toFixed(2),
        netProfit: (grossProfit - expenseTotal).toFixed(2),
      },
    });
  }

  if (type === "expenses") {
    const expenses = await Expense.find({ voidedAt: null, ...(dateRange ? { expenseDate: dateRange } : {}) })
      .sort({ expenseDate: -1 })
      .limit(5000)
      .lean();
    
    const userIds = [...new Set(expenses.map(e => e.createdById))];
    const methodIds = [...new Set(expenses.map(e => e.methodId).filter(Boolean))];
    const [users, methods] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("_id fullName").lean(),
      PaymentMethod.find({ _id: { $in: methodIds } }).lean(),
    ]);
    const userMap = new Map(users.map(u => [u._id, u]));
    const methodMap = new Map(methods.map(m => [m._id, m]));
    
    const expensesWithUser = expenses.map(expense => ({
      ...expense,
      id: expense._id,
      createdBy: userMap.get(expense.createdById) || null,
      method: expense.methodId ? (methodMap.get(expense.methodId) || null) : null,
    }));
    
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    return NextResponse.json({ type, shop, currencyCode: settings?.currencyCode ?? "USD", expenses: expensesWithUser, summary: { count: expenses.length, total: total.toFixed(2) } });
  }

  if (type === "product-sales") {
    const items = await SaleItem.aggregate([
      { $lookup: { from: "sales", localField: "saleId", foreignField: "_id", as: "sale" } },
      { $unwind: "$sale" },
      { $match: { "sale.status": { $in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED, SaleStatus.RETURNED] }, ...(dateRange ? { "sale.soldAt": dateRange } : {}) } },
      { $project: { productId: 1, productName: 1, baseQuantity: 1, lineTotal: 1, costPerBaseUnit: 1, sale: 1 } }
    ]);
    
    const totals = new Map<string, any>();
    for (const item of items) {
      // Get returns for this item
      const returns = await SaleReturnItem.find({ saleItemId: item._id }).lean();
      const returnedQuantity = returns.reduce((sum, r) => sum + r.baseQuantity, 0);
      const returnedRevenue = returns.reduce((sum, r) => sum + r.lineTotal, 0);
      
      const invoiceDiscountShare = item.sale.subtotal > 0
        ? item.sale.discountAmount * item.lineTotal / item.sale.subtotal
        : 0;
      
      const existing = totals.get(item.productId) ?? {
        productId: item.productId, productName: item.productName, unit: "", quantity: 0, revenue: 0, costOfGoods: 0,
      };
      
      existing.quantity += Math.max(item.baseQuantity - returnedQuantity, 0);
      existing.revenue += Math.max(item.lineTotal - invoiceDiscountShare - returnedRevenue, 0);
      existing.costOfGoods += Math.max(item.baseQuantity - returnedQuantity, 0) * item.costPerBaseUnit;
      totals.set(item.productId, existing);
    }
    
    // Get units for products
    const productIds = [...totals.keys()];
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const unitIds = [...new Set(products.map(p => p.baseUnitId))];
    const units = await Unit.find({ _id: { $in: unitIds } }).lean();
    const unitMap = new Map(units.map(u => [u._id, u]));
    const productMap = new Map(products.map(p => [p._id, { ...p, baseUnit: unitMap.get(p.baseUnitId) || null }]));
    
    const productList = [...totals.values()].map(item => {
      const product = productMap.get(item.productId);
      const row: Record<string, any> = {
        ...item,
        id: item.productId,
        unit: product?.baseUnit?.symbol || "",
        quantity: item.quantity.toString(),
        revenue: item.revenue.toFixed(2),
      };
      if (canViewProfit) {
        row.costOfGoods = item.costOfGoods.toFixed(2);
        row.grossProfit = (item.revenue - item.costOfGoods).toFixed(2);
      } else {
        delete row.costOfGoods;
      }
      return row;
    }).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
    
    return NextResponse.json({ type, shop, currencyCode: settings?.currencyCode ?? "USD", products: productList });
  }

  if (type === "purchases") {
    const purchases = await Purchase.find({ 
      status: { $in: [PurchaseStatus.COMPLETED, PurchaseStatus.PARTIALLY_RETURNED, PurchaseStatus.RETURNED] }, 
      ...purchaseDateFilter 
    })
    .sort({ purchasedAt: -1 })
    .limit(5000)
    .lean();
    
    const purchaseIds = purchases.map(p => p._id);
    const supplierIds = [...new Set(purchases.map(p => p.supplierId))];
    const [returns, suppliers] = await Promise.all([
      PurchaseReturn.aggregate([
        { $match: { purchaseId: { $in: purchaseIds }, status: "COMPLETED" } },
        { $group: { _id: null, totalReturns: { $sum: "$total" }, count: { $sum: 1 } } }
      ]),
      Supplier.find({ _id: { $in: supplierIds } }).lean(),
    ]);
    
    const supplierMap = new Map(suppliers.map(s => [s._id, s]));
    const purchasesWithSupplier = purchases.map(p => ({
      ...p,
      id: p._id,
      supplier: supplierMap.get(p.supplierId) || null,
    }));
    
    const grossPurchases = purchases.reduce((sum, purchase) => 
      sum + purchase.subtotal - purchase.discountAmount + purchase.additionalCost, 0);
    const returnedPurchases = returns[0]?.totalReturns || 0;
    const total = grossPurchases - returnedPurchases;
    
    return NextResponse.json({ 
      type, shop, currencyCode: settings?.currencyCode ?? "USD", 
      purchases: purchasesWithSupplier, 
      summary: { 
        invoiceCount: purchases.length, 
        grossPurchases: grossPurchases.toFixed(2), 
        returns: returnedPurchases.toFixed(2), 
        returnCount: returns[0]?.count || 0, 
        total: total.toFixed(2) 
      } 
    });
  }

  if (type === "stock") {
    const [products, expiringBatches, stockBatches] = await Promise.all([
      Product.find({ $or: [{ isActive: true }, { stockOnHand: { $gt: 0 } }] })
        .sort({ name: 1 })
        .limit(10000)
        .lean(),
      InventoryBatch.find({ availableQuantity: { $gt: 0 }, expiresAt: { $ne: null, $lte: new Date(Date.now() + 30 * 86400000) } })
        .sort({ expiresAt: 1 })
        .limit(1000)
        .lean(),
      InventoryBatch.find({ availableQuantity: { $gt: 0 } })
        .select("availableQuantity costPerBaseUnit")
        .lean(),
    ]);
    
    const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))];
    const unitIds = [...new Set(products.map(p => p.baseUnitId))];
    const batchProductIds = [...new Set(expiringBatches.map(b => b.productId))];
    const [categories, units, batchProducts] = await Promise.all([
      Category.find({ _id: { $in: categoryIds } }).lean(),
      Unit.find({ _id: { $in: unitIds } }).lean(),
      Product.find({ _id: { $in: batchProductIds } }).lean(),
    ]);
    const categoryMap = new Map(categories.map(c => [c._id, c]));
    const unitMap = new Map(units.map(u => [u._id, u]));
    const batchProductMap = new Map(batchProducts.map(p => [p._id, p]));
    
    const productsWithRefs = products.map(product => ({
      ...product,
      id: product._id,
      category: product.categoryId ? (categoryMap.get(product.categoryId) || null) : null,
      baseUnit: unitMap.get(product.baseUnitId) || null,
    }));
    const expiringBatchesWithProduct = expiringBatches.map(batch => ({
      ...batch,
      id: batch._id,
      product: batchProductMap.get(batch.productId) || null,
    }));
    
    const lowStock = productsWithRefs.filter((product) => product.isActive && product.stockOnHand <= product.lowStockThreshold);
    const valuation = settings?.costingMethod === CostingMethod.FIFO
      ? stockBatches.reduce((sum, batch) => sum + (batch.availableQuantity * batch.costPerBaseUnit), 0)
      : products.reduce((sum, product) => sum + (product.stockOnHand * product.purchasePrice), 0);
    
    return NextResponse.json({ 
      type, shop, currencyCode: settings?.currencyCode ?? "USD", 
      valuation: valuation.toFixed(2), 
      products: productsWithRefs, 
      lowStock, 
      expiringBatches: expiringBatchesWithProduct 
    });
  }

  // Report tables read column names from the first row's keys, so the money column must come first.
  const daysOverdue = (date: Date | string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));

  const dueRow = (
    contact: { _id: string; name: string; phoneE164?: string | null; email?: string | null; address?: string | null },
    invoices: { invoiceNumber: string; dueAmount: number; invoiceDate: Date }[],
  ) => {
    const due = invoices.reduce((sum, invoice) => sum + invoice.dueAmount, 0);
    let due0to30 = 0; let due31to60 = 0; let dueOver60 = 0; let oldestDays = 0;
    for (const invoice of invoices) {
      const age = daysOverdue(invoice.invoiceDate);
      oldestDays = Math.max(oldestDays, age);
      if (age <= 30) due0to30 += invoice.dueAmount;
      else if (age <= 60) due31to60 += invoice.dueAmount;
      else dueOver60 += invoice.dueAmount;
    }
    return {
      // Identity first: the due table and CSV cut off after ten columns, so the collector details must not fall off the end.
      name: contact.name,
      phone: contact.phoneE164 ?? "",
      address: contact.address ?? "",
      email: contact.email ?? "",
      dueAmount: due.toFixed(2),
      due0to30: due0to30.toFixed(2),
      due31to60: due31to60.toFixed(2),
      dueOver60: dueOver60.toFixed(2),
      oldestDueDays: oldestDays,
      invoices: invoices.length,
      invoiceNumbers: invoices.map((invoice) => invoice.invoiceNumber).join(", "),
      id: contact._id,
    };
  };

  if (type === "due") {
    const [customers, suppliers, openSales, openPurchases] = await Promise.all([
      Customer.find({}).lean(),
      Supplier.find({}).lean(),
      Sale.find({ dueAmount: { $gt: 0 }, status: { $in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED] } })
        .select("customerId invoiceNumber dueAmount soldAt").lean(),
      Purchase.find({ dueAmount: { $gt: 0 }, status: { $in: [PurchaseStatus.COMPLETED, PurchaseStatus.PARTIALLY_RETURNED] } })
        .select("supplierId invoiceNumber dueAmount purchasedAt").lean(),
    ]);

    const groupByContact = <T extends Record<string, any>>(rows: T[], key: string) => {
      const grouped = new Map<string, T[]>();
      for (const row of rows) {
        const contactId = row[key];
        if (!contactId) continue;
        const bucket = grouped.get(contactId);
        if (bucket) bucket.push(row); else grouped.set(contactId, [row]);
      }
      return grouped;
    };
    const salesByCustomer = groupByContact(openSales as Record<string, any>[], "customerId");
    const purchasesBySupplier = groupByContact(openPurchases as Record<string, any>[], "supplierId");

    const customersWithDue = customers
      .map((customer) => dueRow(customer, (salesByCustomer.get(customer._id) ?? []).map((sale) => ({
        invoiceNumber: sale.invoiceNumber, dueAmount: toNumber(sale.dueAmount), invoiceDate: sale.soldAt,
      }))))
      .filter((row) => Number(row.dueAmount) > 0)
      .sort((a, b) => Number(b.dueAmount) - Number(a.dueAmount));

    const suppliersWithDue = suppliers
      .map((supplier) => dueRow(supplier, (purchasesBySupplier.get(supplier._id) ?? []).map((purchase) => ({
        invoiceNumber: purchase.invoiceNumber, dueAmount: toNumber(purchase.dueAmount), invoiceDate: purchase.purchasedAt,
      }))))
      .filter((row) => Number(row.dueAmount) > 0)
      .sort((a, b) => Number(b.dueAmount) - Number(a.dueAmount));

    const customerDue = customersWithDue.reduce((sum: number, row) => sum + toNumber(row.dueAmount), 0);
    const supplierDue = suppliersWithDue.reduce((sum: number, row) => sum + toNumber(row.dueAmount), 0);

    return NextResponse.json({
      type, shop, currencyCode: settings?.currencyCode ?? "USD",
      customers: customersWithDue,
      suppliers: suppliersWithDue,
      summary: {
        customerDue: customerDue.toFixed(2),
        supplierDue: supplierDue.toFixed(2),
        customersOwed: customersWithDue.length,
        suppliersOwed: suppliersWithDue.length,
      },
    });
  }

  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Choose sales, purchases, product-sales, profit-loss, expenses, stock, or due." } }, { status: 400 });
}
