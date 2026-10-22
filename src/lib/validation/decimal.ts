import { z } from "zod";

// Decimal inputs stay as strings through validation and reach Prisma Decimal fields
// without a JavaScript floating-point conversion.
export const decimalInput = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,8})?$/);
export const nonNegativeDecimalInput = decimalInput;
export const positiveDecimalInput = decimalInput.refine((value) => /[1-9]/.test(value), {
  message: "Value must be greater than zero.",
});
