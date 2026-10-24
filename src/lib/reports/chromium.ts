// Statements are rendered by a Chromium that is already running as a sidecar, so the shop gets a real
// PDF file — Bengali shaping, vector text and the print stylesheet included — without a browser dialog.
// Nothing here downloads a browser: puppeteer-core only speaks CDP to the endpoint in PDF_BROWSER_WS.

import { connect, type Browser } from "puppeteer-core";

export class PdfRenderError extends Error {
  constructor(message: string, readonly reason: "not-configured" | "unreachable" | "render-failed") {
    super(message);
    this.name = "PdfRenderError";
  }
}

// Next dev reloads modules freely; one live browser per Node process must survive that.
const held = globalThis as typeof globalThis & { __stockpilotPdfBrowser?: Browser };

async function webSocketEndpoint(url: string) {
  if (url.startsWith("ws")) return url;
  // A plain http://host:port is friendlier in compose files; CDP publishes the socket behind /json/version.
  const version = await fetch(new URL("/json/version", url).toString(), { signal: AbortSignal.timeout(5000) }).then((response) => response.json() as Promise<{ webSocketDebuggerUrl?: string }>);
  if (!version.webSocketDebuggerUrl) throw new PdfRenderError("The PDF browser published no debugger socket.", "unreachable");
  const socket = new URL(version.webSocketDebuggerUrl);
  const base = new URL(url);
  // Browsers report the address they bound themselves, which is loopback inside a sidecar container.
  // The configured host is the one this process can actually reach, so only the socket path is trusted.
  if (["127.0.0.1", "localhost", "[::1]"].includes(socket.hostname) && !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
    socket.hostname = base.hostname;
    if (base.port) socket.port = base.port;
  }
  return socket.toString();
}

async function browser(): Promise<Browser> {
  const endpoint = process.env.PDF_BROWSER_WS;
  if (!endpoint) throw new PdfRenderError("No PDF browser is configured (PDF_BROWSER_WS).", "not-configured");
  if (held.__stockpilotPdfBrowser?.connected) return held.__stockpilotPdfBrowser;
  let active: Browser;
  try {
    active = await connect({ browserWSEndpoint: await webSocketEndpoint(endpoint) });
  } catch (caught) {
    throw new PdfRenderError(caught instanceof Error ? caught.message : "The PDF browser could not be reached.", "unreachable");
  }
  // A crash or restart leaves the old handle behind; drop it so the next request reconnects.
  active.once("disconnected", () => { if (held.__stockpilotPdfBrowser === active) held.__stockpilotPdfBrowser = undefined; });
  held.__stockpilotPdfBrowser = active;
  return active;
}

// The caller owns the returned bytes; Chromium only ever sees the HTML string it is given.
export async function htmlToPdf(html: string): Promise<ArrayBuffer> {
  const connection = await browser();
  const page = await connection.newPage();
  try {
    page.setDefaultTimeout(15000);
    await page.setContent(html, { waitUntil: "load" });
    // The embedded statement face must be resolved before pagination, or the first page reflows to the fallback.
    await page.evaluateHandle(() => document.fonts.ready);
    const paper = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    // A detached copy: Chromium's buffer is pooled, and a Body must not carry the pool with it.
    return paper.slice().buffer;
  } catch (caught) {
    throw new PdfRenderError(caught instanceof Error ? caught.message : "The statement could not be rendered.", "render-failed");
  } finally {
    await page.close().catch(() => {});
  }
}
