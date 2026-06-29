/**
 * The ONE HTTP client. Components and domain api files never call fetch directly
 * (Constitution §14.2). This is also the only place the response envelope is
 * unwrapped and turned into a thrown ApiError on failure (§16.1).
 */

export class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details: unknown } | null;
}

function commonHeaders(): Record<string, string> {
  // No auth in v1 (local-first, single operator). When auth lands, the JWT is
  // read only here (§17.5).
  return { "Content-Type": "application/json" };
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: commonHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError("Network request failed", { code: "NETWORK_ERROR" });
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || payload.success === false) {
    throw new ApiError(payload?.error?.message ?? `Request failed (${res.status})`, {
      code: payload?.error?.code,
      status: res.status,
    });
  }
  return payload.data as T;
}

export const apiGet = <T>(url: string) => request<T>("GET", url);
export const apiPost = <T>(url: string, body?: unknown) => request<T>("POST", url, body);
export const apiPut = <T>(url: string, body?: unknown) => request<T>("PUT", url, body);
export const apiPatch = <T>(url: string, body?: unknown) => request<T>("PATCH", url, body);
export const apiDelete = <T>(url: string) => request<T>("DELETE", url);
