/** Compare a browser Origin with the host used to reach the app. */
export function hasMatchingRequestOrigin(headers: Headers, fallbackUrl: string) {
  const origin = headers.get("origin");
  if (!origin) return false;

  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || headers.get("host") || new URL(fallbackUrl).host;

  try {
    return new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}
