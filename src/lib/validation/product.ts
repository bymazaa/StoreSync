import { positiveDecimalInput } from "./decimal";
import { z } from "zod";

export const productUnitsInput = z.array(z.object({
  unitId: z.uuid(),
  conversionToBase: positiveDecimalInput,
  isDefaultPurchase: z.boolean().default(false),
  isDefaultSale: z.boolean().default(false),
})).max(20).superRefine((units, context) => {
  const ids = new Set<string>();
  let purchaseDefaultCount = 0;
  let saleDefaultCount = 0;
  for (const [index, unit] of units.entries()) {
    if (ids.has(unit.unitId)) context.addIssue({ code: "custom", path: [index, "unitId"], message: "A product unit may only be configured once." });
    ids.add(unit.unitId);
    if (unit.isDefaultPurchase && ++purchaseDefaultCount > 1) {
      context.addIssue({ code: "custom", path: [index, "isDefaultPurchase"], message: "Choose only one default purchase unit." });
    }
    if (unit.isDefaultSale && ++saleDefaultCount > 1) {
      context.addIssue({ code: "custom", path: [index, "isDefaultSale"], message: "Choose only one default sale unit." });
    }
  }
});
