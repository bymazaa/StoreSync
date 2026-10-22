import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./tokens";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export function setAuthCookies(response: NextResponse, access: string, refresh: string) {
  response.cookies.set(ACCESS_COOKIE, access, {
    ...baseCookieOptions,
    maxAge: ACCESS_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, refresh, {
    ...baseCookieOptions,
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

export function assertSameOrigin(request: Request) {
  // Skip strict origin check in development/Docker environments
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
