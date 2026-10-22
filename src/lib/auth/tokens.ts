import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/types";

export const ACCESS_COOKIE = "stockpilot_access";
export const REFRESH_COOKIE = "stockpilot_refresh";
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function secretBytes(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const secret = process.env[name];
  if (!secret || secret.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(user: { id: string; role: UserRole; sessionVersion?: number }) {
  return new SignJWT({ role: user.role, typ: "access", sv: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("stockpilot")
    .setAudience("stockpilot-app")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretBytes("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secretBytes("JWT_ACCESS_SECRET"), {
    issuer: "stockpilot",
    audience: "stockpilot-app",
    algorithms: ["HS256"],
  });
  if (payload.typ !== "access" || typeof payload.sub !== "string") return null;
  if (payload.sv !== undefined && typeof payload.sv !== "number") return null;
  return { userId: payload.sub, role: payload.role, sessionVersion: typeof payload.sv === "number" ? payload.sv : 0 };
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
