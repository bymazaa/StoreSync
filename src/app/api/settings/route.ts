import { NextResponse } from "next/server";
import { Permission } from "@/types";
import { authorized } from "@/lib/auth/api-guard";
import connectDB from "@/lib/db";
import { Settings, AuditLog } from "@/models";
import { invalidBody } from "@/lib/http/api-response";
import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { settingsSchema } from "@/lib/validation/api";
import { currencyForCountry, localeForCountry, timeZoneForCountry } from "@/lib/country-options";

export async function GET() {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  
  const settings = await Settings.findById("shop").lean();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  await connectDB();
  const guard = await authorized(Permission.MANAGE_SETTINGS);
  if ("response" in guard) return guard.response;
  
  let body: unknown;
  try { body = await request.json(); } catch { return invalidBody(); }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return invalidBody(parsed.error.issues);
  if (Object.keys(parsed.data).length === 0) return invalidBody();
  
  const previous = await Settings.findById("shop").lean();
  const selectedCountry = parsed.data.countryCode ?? previous?.countryCode ?? "US";
  const phoneCountry: CountryCode = isSupportedCountry(selectedCountry) ? selectedCountry : "US";
  const countryCurrency = currencyForCountry(phoneCountry);
  if (!countryCurrency) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "A default currency is not configured for this country." } }, { status: 400 });
  
  parsed.data.countryCode = phoneCountry;
  parsed.data.currencyCode = countryCurrency;
  parsed.data.timezone = timeZoneForCountry(phoneCountry);
  parsed.data.locale = localeForCountry(phoneCountry);
  
  if (parsed.data.phone) {
    const phone = parsePhoneNumberFromString(parsed.data.phone, phoneCountry as CountryCode);
    if (!phone?.isValid()) return NextResponse.json({ error: { code: "BAD_REQUEST", message: `Enter a valid shop phone number for ${phoneCountry}.` } }, { status: 400 });
    parsed.data.phone = phone.number;
  }
  
  const changedFields: string[] = [];
  if (previous) {
    for (const [key, val] of Object.entries(parsed.data)) {
      const prevVal = (previous as Record<string, unknown>)[key];
      const strVal = val === null || val === undefined ? '' : String(val).trim();
      const strPrev = prevVal === null || prevVal === undefined ? '' : String(prevVal).trim();
      if (strVal !== strPrev) {
        changedFields.push(key);
      }
    }
  } else {
    changedFields.push(...Object.keys(parsed.data));
  }

  const updated = await Settings.findByIdAndUpdate(
    "shop",
    parsed.data,
    { returnDocument: "after", runValidators: true }
  ).lean();
  
  if (changedFields.length > 0) {
    await AuditLog.create({
      _id: crypto.randomUUID(),
      actorId: guard.user.id,
      action: "settings.updated",
      entityType: "settings",
      entityId: "shop",
      metadata: { before: previous, changedFields },
    });
  }
  
  return NextResponse.json({ settings: updated });
}
