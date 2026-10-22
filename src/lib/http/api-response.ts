import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function apiError(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function invalidBody(issues?: ZodIssue[]) {
  const first = issues?.[0];
  if (!first) return apiError(400, "BAD_REQUEST", "Please check the submitted information.");
  const field = first.path.join(".");
  const message = field ? `${field}: ${first.message}` : first.message;
  return apiError(400, "BAD_REQUEST", message);
}
