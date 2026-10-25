// A statement the shop can save: the same data the Reports screen shows, rendered by Chromium into a
// PDF file. Data comes from the reports handler itself, so a PDF can never use a looser filter than
// the screen, and permission is checked once, there.

import { SHOP_DEFAULTS } from "@/lib/constants/app";
import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import { apiError } from "@/lib/http/api-response";
import { localDateKey } from "@/lib/date-time";
import { htmlToPdf, PdfRenderError } from "@/lib/reports/chromium";
import { createStatementFormat, type ReportType } from "@/lib/reports/format";
import { renderStatementHtml, type ReportPayload } from "@/lib/reports/statement";
import { GET as readReport } from "../route";

const reportTypes = ["sales", "purchases", "product-sales", "profit-loss", "stock", "due", "expenses"] as const;
// A date key is the only shape allowed into the download filename — a header is not a place for free text.
const dateKey = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const data = await readReport(request);
  // The shared guard types a denied request as a possibly-absent response, so a statement is never built from one.
  if (!data) return apiError(500, "INTERNAL_ERROR", "This report could not be prepared.");
  if (!data.ok) return data;
  const payload = await data.json() as ReportPayload;

  const search = new URL(request.url).searchParams;
  const type = (reportTypes as readonly string[]).includes(search.get("type") ?? "") ? search.get("type") as ReportType : "sales";
  const from = dateKey.test(search.get("from") ?? "") ? search.get("from") : null;
  const to = dateKey.test(search.get("to") ?? "") ? search.get("to") : null;

  await connectDB();
  const settings = await Settings.findById("shop").select("locale timezone").lean();
  const timezone = settings?.timezone ?? SHOP_DEFAULTS.timezone;
  const format = createStatementFormat({ locale: settings?.locale ?? SHOP_DEFAULTS.locale, timezone, currencyCode: payload.currencyCode ?? SHOP_DEFAULTS.currency });
  const today = localDateKey(new Date(), timezone);
  const period = !from && !to ? "All time" : `${from ?? "Start"} → ${to ?? today}`;
  const generatedAt = format.dateTime(new Date());

  let pdf: ArrayBuffer;
  try {
    pdf = await htmlToPdf(renderStatementHtml({ type, payload, format, period, generatedAt }, process.cwd()));
  } catch (caught) {
    if (caught instanceof PdfRenderError) {
      // A connection refusal is not something shop staff can read; the reason is, and Print is the way out.
      const message = caught.reason === "render-failed" ? caught.message : "The PDF writer is offline on this server — use Print instead.";
      return Response.json({ error: { code: "PDF_UNAVAILABLE", message } }, { status: 503 });
    }
    throw caught;
  }

  const stem = `${type}-statement-${!from && !to ? "all-time" : `${from ?? "start"}-to-${to ?? today}`}`;
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
