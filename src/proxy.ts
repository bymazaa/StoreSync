import { NextResponse, type NextRequest } from "next/server";
import { hasMatchingRequestOrigin } from "@/lib/auth/request-origin";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-origin API writes before route handlers read authentication cookies. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !READ_METHODS.has(request.method)) {
    if (!hasMatchingRequestOrigin(request.headers, request.url)) {
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
