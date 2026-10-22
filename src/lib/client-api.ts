type ApiPayload = Record<string, unknown> & { error?: { message?: string } };
let refreshInFlight: Promise<boolean> | null = null;

export function refreshAuthSession() {
  if (!refreshInFlight) {
    const requestRefresh = async () => {
      const response = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
      return response.ok;
    };

    // Coordinate tabs as well as requests in this tab before rotating the shared cookie.
    const crossTabRefresh: Promise<boolean> = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request<Promise<boolean>>("stockpilot-auth-refresh", requestRefresh).then((result) => result)
      : requestRefresh();

    refreshInFlight = crossTabRefresh
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const send = () => fetch(path, { ...options, cache: "no-store", headers });
  let response = await send();
  const canRefresh = path !== "/api/auth/login" && path !== "/api/auth/refresh" && path !== "/api/setup/owner";
  if (response.status === 401 && canRefresh && await refreshAuthSession()) {
    // Retry once after the refresh cookie has rotated.
    response = await send();
  }
  let payload: ApiPayload;
  try {
    payload = await readResponsePayload(response);
  } catch (error) {
    // Preserve the HTTP status fallback for API errors with empty or non-JSON bodies.
    if (response.ok) throw error;
    payload = {};
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? `Request failed with status ${response.status}.`;
    const error = new Error(message) as Error & { payload?: unknown };
    error.payload = payload;
    if (response.status === 401 && canRefresh && typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.dispatchEvent(new Event("stockpilot:unauthorized"));
    }
    throw error;
  }
  return payload as T;
}

/** Parse API responses without exposing the browser's raw empty/invalid JSON error. */
export async function readResponsePayload(response: Response): Promise<ApiPayload> {
  const body = await response.text();
  if (!body.trim()) throw new Error("The server returned an empty response. Please try again.");
  try {
    const payload: unknown = JSON.parse(body);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return payload as ApiPayload;
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

export const jsonBody = (value: unknown): string => JSON.stringify(value);
