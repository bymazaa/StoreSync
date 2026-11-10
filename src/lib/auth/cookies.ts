import { NextResponse } from "next/server";
import { hasMatchingRequestOrigin } from "./request-origin";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./tokens";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
};

function isSecureRequest(request?: Request) {
  if (!request) return process.env.NODE_ENV === "production";
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  return protocol === "https";
}

export function setAuthCookies(response: NextResponse, access: string, refresh: string, request?: Request) {
  const secure = isSecureRequest(request);
  response.cookies.set(ACCESS_COOKIE, access, {
    ...baseCookieOptions,
    secure,
    maxAge: ACCESS_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, refresh, {
    ...baseCookieOptions,
    secure,
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse, request?: Request) {
  const secure = isSecureRequest(request);
  response.cookies.set(ACCESS_COOKIE, "", { ...baseCookieOptions, secure, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...baseCookieOptions, secure, maxAge: 0 });
}

export function assertSameOrigin(request: Request) {
  // Skip strict origin check in development/Docker environments
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return hasMatchingRequestOrigin(request.headers, request.url);
}
