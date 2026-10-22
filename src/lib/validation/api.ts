import { CostingMethod, DiscountType, PaymentMethodKind, StockDirection, UserRole, Permission } from "@/types";
import { isSupportedCountry } from "libphonenumber-js";
import { nonNegativeDecimalInput, positiveDecimalInput } from "@/lib/validation/decimal";
import { productUnitsInput } from "@/lib/validation/product";
import { z } from "zod";

/** Title-case names without lowercasing the rest, so brands like "iPhone" and "MD Foods" stay intact. */
const capitalizeName = (value: string) => value.replace(/\s+/g, " ").trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** Shared request contracts keep route handlers focused on authorization and business rules. */
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(160).transform(capitalizeName), phone: z.string().trim().min(3).max(40).nullable().optional(),
  email: z.email().trim().toLowerCase().nullable().optional(), address: z.string().trim().max(500).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(),
});
export const customerUpdateSchema = customerSchema.partial().extend({ isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export const supplierSchema = customerSchema;
export const supplierUpdateSchema = customerUpdateSchema;
export const categorySchema = z.object({ name: z.string().trim().min(1).max(100).transform(capitalizeName), description: z.string().trim().max(500).nullable().optional(), parentId: z.uuid().nullable().optional() });
export const categoryUpdateSchema = categorySchema.partial().extend({ isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
export const productSchema = z.object({
  name: z.string().trim().min(1).max(160).transform(capitalizeName), barcode: z.string().trim().max(120).nullable().optional(), brand: z.string().trim().max(120).transform(capitalizeName).nullable().optional(),
  categoryId: z.uuid().nullable().optional(), baseUnitId: z.uuid(),
  lowStockThreshold: nonNegativeDecimalInput.default("0"), units: productUnitsInput.default([]),
}).superRefine((product, context) => {
  if (product.units.some((unit) => unit.unitId === product.baseUnitId)) context.addIssue({ code: "custom", path: ["units"], message: "Base unit is configured automatically; choose other units only." });
});
export const unitSchema = z.object({ code: z.string().trim().min(1).max(30).regex(/^[A-Z0-9_-]+$/), name: z.string().trim().min(1).max(80).transform(capitalizeName), symbol: z.string().trim().min(1).max(20) });
export const unitUpdateSchema = unitSchema.partial().extend({ isActive: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);
const saleLineSchema = z.object({ productId: z.uuid(), unitId: z.uuid(), quantity: positiveDecimalInput, unitPrice: nonNegativeDecimalInput.optional() });
export const saleSchema = z.object({
  clientRequestId: z.uuid(), customerId: z.uuid().nullable().optional(), discountType: z.enum([DiscountType.PERCENTAGE, DiscountType.FIXED_AMOUNT]).nullable().optional(),
  discountValue: positiveDecimalInput.optional(), paidAmount: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/).default("0"), paymentMethodId: z.uuid().nullable().optional(),
  paymentReference: z.string().trim().max(160).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), items: z.array(saleLineSchema).min(1).max(200),
});
export const purchaseSchema = z.object({
  clientRequestId: z.uuid(),
  supplierId: z.uuid(), supplierInvoiceNumber: z.string().trim().max(100).nullable().optional(), discountType: z.enum([DiscountType.PERCENTAGE, DiscountType.FIXED_AMOUNT]).nullable().optional(),
  discountValue: positiveDecimalInput.optional(), additionalCost: nonNegativeDecimalInput.default("0"), paidAmount: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/).default("0"),
  paymentMethodId: z.uuid().nullable().optional(), paymentReference: z.string().trim().max(160).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(z.object({ productId: z.uuid(), unitId: z.uuid(), quantity: positiveDecimalInput, unitCost: nonNegativeDecimalInput, sellingPrice: positiveDecimalInput, trackBatch: z.boolean().optional(), trackExpiry: z.boolean().optional(), batchNumber: z.string().trim().max(100).nullable().optional(), expiresAt: z.iso.datetime().nullable().optional() })).min(1).max(200),
});
export const saleReturnSchema = z.object({
  clientRequestId: z.uuid(),
  reason: z.string().trim().max(500).nullable().optional(), refundMethodId: z.uuid().nullable().optional(), items: z.array(z.object({ saleItemId: z.uuid(), quantity: positiveDecimalInput, batchNumber: z.string().trim().max(100).nullable().optional(), expiresAt: z.iso.datetime().nullable().optional() })).min(1).max(100),
}).superRefine((value, context) => { if (new Set(value.items.map((item) => item.saleItemId)).size !== value.items.length) context.addIssue({ code: "custom", message: "Each invoice line can appear once per return." }); });
export const purchaseReturnSchema = z.object({ clientRequestId: z.uuid(), reason: z.string().trim().max(500).nullable().optional(), refundMethodId: z.uuid().nullable().optional(), items: z.array(z.object({ purchaseItemId: z.uuid(), quantity: positiveDecimalInput })).min(1).max(100) }).superRefine((value, context) => { if (new Set(value.items.map((item) => item.purchaseItemId)).size !== value.items.length) context.addIssue({ code: "custom", message: "Each invoice line can appear once per return." }); });
export const adjustmentSchema = z.object({ clientRequestId: z.uuid(), productId: z.uuid(), direction: z.enum([StockDirection.IN, StockDirection.OUT]), quantity: positiveDecimalInput, batchNumber: z.string().trim().max(100).nullable().optional(), expiresAt: z.iso.datetime().nullable().optional(), note: z.string().trim().min(1).max(500) });
export const expenseSchema = z.object({ 
  clientRequestId: z.uuid(), 
  title: z.string().trim().min(1).max(160).transform(capitalizeName), 
  category: z.string().trim().max(100).nullable().optional(), 
  amount: positiveDecimalInput, 
  expenseDate: z.union([z.iso.date(), z.iso.datetime()]).optional(), 
  methodId: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    return val;
  }, z.uuid().nullable()), 
  notes: z.string().trim().max(2000).nullable().optional() 
});
export const expenseVoidSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const paymentCollectionSchema = z.object({ clientRequestId: z.uuid(), invoiceType: z.enum(["sale", "purchase"]), invoiceId: z.uuid(), amount: positiveDecimalInput, paymentMethodId: z.uuid(), reference: z.string().trim().max(160).nullable().optional(), notes: z.string().trim().max(500).nullable().optional() });
export const paymentMethodSchema = z.object({ code: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(1).max(80).transform(capitalizeName), kind: z.enum(Object.values(PaymentMethodKind) as [PaymentMethodKind, ...PaymentMethodKind[]]), isEnabled: z.boolean().default(true), sortOrder: z.number().int().min(0).max(999).default(0) });
export const paymentMethodUpdateSchema = z.object({ id: z.uuid(), ...paymentMethodSchema.partial().shape }).refine((value) => Object.keys(value).some((key) => key !== "id"));
export const settingsSchema = z.object({
  shopName: z.string().trim().min(1).max(160).transform(capitalizeName).optional(), logoUrl: z.url().nullable().optional(), address: z.string().trim().max(500).nullable().optional(), phone: z.string().trim().max(40).nullable().optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).refine(isSupportedCountry, "Choose a supported country code.").optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).refine((code) => { try { new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(0); return true; } catch { return false; } }, "Choose a supported currency code.").optional(),
  locale: z.string().trim().min(2).max(35).refine((locale) => { try { new Intl.DateTimeFormat(locale).format(); return true; } catch { return false; } }).optional(),
  timezone: z.string().trim().min(3).max(80).refine((timeZone) => { try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); return true; } catch { return false; } }).optional(),
  saleInvoicePrefix: z.string().trim().min(1).max(12).optional(), purchaseInvoicePrefix: z.string().trim().min(1).max(12).optional(), costingMethod: z.enum([CostingMethod.WEIGHTED_AVERAGE, CostingMethod.FIFO]).optional(),
});
export const productUpdateSchema = z.object({ name: z.string().trim().min(1).max(160).transform(capitalizeName).optional(), sku: z.string().trim().min(1).max(80).optional(), barcode: z.string().trim().max(120).nullable().optional(), brand: z.string().trim().max(120).transform(capitalizeName).nullable().optional(), categoryId: z.uuid().nullable().optional(), baseUnitId: z.uuid().optional(), purchasePrice: nonNegativeDecimalInput.optional(), sellingPrice: nonNegativeDecimalInput.optional(), lowStockThreshold: nonNegativeDecimalInput.optional(), tracksExpiry: z.boolean().optional(), tracksBatch: z.boolean().optional(), isActive: z.boolean().optional(), units: productUnitsInput.optional() }).refine((value) => Object.keys(value).length > 0);
export const userCreateSchema = z.object({ fullName: z.string().trim().min(2).max(120).transform(capitalizeName), email: z.email().trim().toLowerCase(), password: z.string().min(12).max(200), role: z.enum([UserRole.MANAGER, UserRole.CASHIER, UserRole.STOCK_CLERK]) });
export const userUpdateSchema = z.object({ role: z.enum([UserRole.MANAGER, UserRole.CASHIER, UserRole.STOCK_CLERK]).optional(), isActive: z.boolean().optional(), password: z.string().min(12).max(200).optional() }).refine((value) => Object.keys(value).length > 0);
export const rolePermissionsSchema = z.object({ role: z.enum([UserRole.MANAGER, UserRole.CASHIER, UserRole.STOCK_CLERK]), permissions: z.array(z.enum(Object.values(Permission) as [Permission, ...Permission[]])) });
export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) }).refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"], message: "Choose a new password that differs from the current password." });
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(200) });
export const ownerSetupSchema = z.object({ fullName: z.string().trim().min(2).max(120).transform(capitalizeName), email: z.email().trim().toLowerCase(), password: z.string().min(12).max(200) });
