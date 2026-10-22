import { NextResponse, type NextRequest } from "next/server";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-origin API writes before route handlers read authentication cookies. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !READ_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Request origin is not allowed." } },
        { status: 403 },
      );
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
