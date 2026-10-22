import { NextResponse } from "next/server";
import { Permission, PurchaseStatus, SaleStatus } from "@/types";
import { requirePermission } from "@/lib/auth/session";
import connectDB from "@/lib/db";
import Sale from "@/models/Sale";
import SaleReturn from "@/models/SaleReturn";
import SaleItem from "@/models/SaleItem";
import PurchaseReturn from "@/models/PurchaseReturn";
import Purchase from "@/models/Purchase";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import Expense from "@/models/Expense";
import Unit from "@/models/Unit";
import Settings from "@/models/Settings";
import { addDateKeyDays, localDateKey, zonedDayStartUtc } from "@/lib/date-time";
import { apiError } from "@/lib/http/api-response";

// Helper to convert Decimal128/string to number
const toNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
};

const activeSaleStatuses = [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED, SaleStatus.RETURNED];
const activePurchaseStatuses = [PurchaseStatus.COMPLETED, PurchaseStatus.PARTIALLY_RETURNED, PurchaseStatus.RETURNED];

export async function GET() {
  const session = await requirePermission(Permission.VIEW_REPORTS);
  if ("response" in session) return session.response;

  try {
    await connectDB();
    
    const settings = await Settings.findById("shop").lean();
    const timeZone = settings?.timezone ?? "America/New_York";
    const todayKey = localDateKey(new Date(), timeZone);
    const weekStartKey = addDateKeyDays(todayKey, -6);
    const tomorrowKey = addDateKeyDays(todayKey, 1);
    const start = zonedDayStartUtc(todayKey, timeZone);
    const end = zonedDayStartUtc(tomorrowKey, timeZone);
    const weekStart = zonedDayStartUtc(weekStartKey, timeZone);

    // Fetch all data in parallel
    const [
      sales,
      saleReturns,
      saleItems,
      purchaseReturns,
      purchases,
      productCount,
      lowStockProducts,
      todayExpenses,
      recentSales,
    ] = await Promise.all([
      Sale.find({ status: { $in: activeSaleStatuses }, soldAt: { $gte: weekStart, $lt: end } })
        .select("_id invoiceNumber soldAt subtotal discountAmount")
        .sort({ soldAt: 1 })
        .lean(),
      SaleReturn.find({ status: "COMPLETED", returnedAt: { $gte: weekStart, $lt: end } })
        .select("returnedAt total items")
        .sort({ returnedAt: 1 })
        .lean(),
      SaleItem.aggregate([
        { $lookup: { from: "sales", localField: "saleId", foreignField: "_id", as: "sale" } },
        { $unwind: "$sale" },
        { $match: { "sale.status": { $in: activeSaleStatuses }, "sale.soldAt": { $gte: start, $lt: end } } },
        { $project: { baseQuantity: 1, costPerBaseUnit: 1 } }
      ]),
      PurchaseReturn.find({ status: "COMPLETED", returnedAt: { $gte: start, $lt: end } })
        .select("total")
        .lean(),
      Purchase.find({ status: { $in: activePurchaseStatuses }, purchasedAt: { $gte: start, $lt: end } })
        .select("subtotal discountAmount additionalCost")
        .lean(),
      Product.countDocuments({ isActive: true }),
      Product.find({ isActive: true, $expr: { $lte: ["$stockOnHand", "$lowStockThreshold"] } })
        .select("_id name sku stockOnHand lowStockThreshold baseUnitId")
        .sort({ stockOnHand: 1 })
        .limit(8)
        .lean(),
      Expense.aggregate([
        { $match: { voidedAt: null, expenseDate: { $gte: start, $lt: end } } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
      ]),
      Sale.find({ status: { $in: activeSaleStatuses } })
        .select("_id invoiceNumber total soldAt status customerId")
        .sort({ soldAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const recentSaleCustomerIds = [...new Set(recentSales.map(s => s.customerId).filter(Boolean))];
    const recentCustomers = recentSaleCustomerIds.length > 0
      ? await Customer.find({ _id: { $in: recentSaleCustomerIds } }).select("_id name").lean()
      : [];
    const recentCustomerMap = new Map(recentCustomers.map(c => [c._id, c]));
    const recentSalesWithCustomer = recentSales.map(sale => ({
      ...sale,
      id: sale._id,
      customer: sale.customerId ? (recentCustomerMap.get(sale.customerId) || null) : null,
    }));

    // Calculate chart data
    const chartByDay = new Map<string, number>();
    for (let day = 0; day < 7; day++) chartByDay.set(addDateKeyDays(weekStartKey, day), 0);
    
    let grossSalesToday = 0;
    for (const sale of sales) {
      const key = localDateKey(sale.soldAt, timeZone);
      const netBeforeReturns = sale.subtotal - sale.discountAmount;
      chartByDay.set(key, (chartByDay.get(key) ?? 0) + netBeforeReturns);
      if (key === todayKey) grossSalesToday += netBeforeReturns;
    }
    
    let returnsToday = 0;
    let returnedCostToday = 0;
    for (const saleReturn of saleReturns) {
      const key = localDateKey(saleReturn.returnedAt, timeZone);
      chartByDay.set(key, (chartByDay.get(key) ?? 0) - saleReturn.total);
      if (key === todayKey) {
        returnsToday += saleReturn.total;
        // Calculate returned cost from items
        const itemCosts = (saleReturn.items || []).reduce((sum: number, item: any) => {
          return sum + (toNumber(item.baseQuantity) * toNumber(item.saleItem?.costPerBaseUnit || 0));
        }, 0);
        returnedCostToday += itemCosts;
      }
    }

    const netSalesToday = grossSalesToday - returnsToday;
    const purchasesToday = purchases.reduce((sum, purchase) => 
      sum + purchase.subtotal - purchase.discountAmount + purchase.additionalCost, 0);
    const netPurchasesToday = purchasesToday - purchaseReturns.reduce((sum, item) => sum + item.total, 0);
    const soldCostToday = saleItems.reduce((sum, item) => sum + (item.baseQuantity * item.costPerBaseUnit), 0);
    const costOfGoodsToday = soldCostToday - returnedCostToday;
    const expenseTotal = todayExpenses[0]?.totalAmount || 0;
    const estimatedProfit = netSalesToday - costOfGoodsToday - expenseTotal;

    // Get unit symbols for low stock products
    const baseUnitIds = [...new Set(lowStockProducts.map(p => p.baseUnitId))];
    const units = await Unit.find({ _id: { $in: baseUnitIds } }).select("_id symbol").lean();
    const unitMap = new Map(units.map(u => [u._id, u.symbol]));
    
    const lowStock = lowStockProducts.map(p => ({
      ...p,
      unit: unitMap.get(p.baseUnitId) || ""
    }));

    return NextResponse.json({
      currencyCode: settings?.currencyCode ?? "USD",
      today: {
        sales: netSalesToday.toFixed(2),
        purchases: netPurchasesToday.toFixed(2),
        profitEstimate: estimatedProfit.toFixed(2),
        activeProducts: productCount,
        lowStockCount: lowStockProducts.length,
      },
      salesChart: [...chartByDay].map(([date, total]) => ({ date, total: total.toFixed(2) })),
      lowStock,
      recentSales: recentSalesWithCustomer,
    });
  } catch (error) {
    console.error("Dashboard data request failed.", error);
    return apiError(500, "INTERNAL_ERROR", "Dashboard data could not be loaded. Check the server and database status.");
  }
}
