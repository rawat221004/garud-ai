/** Typed API client. All calls go through the Vite proxy (/api -> backend:8000). */

export class ApiError extends Error {
  status: number;
  detail: any;

  constructor(message: string, status: number, detail: any) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (err: any) {
    throw new ApiError("Cannot reach the GARUD backend. Is it running on port 8000?", 0, null);
  }

  if (!resp.ok) {
    let detail: any = null;
    let message = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      detail = body?.detail ?? body;
      if (typeof detail === "string") message = detail;
      else if (detail?.message) message = detail.message;
      else if (detail?.[0]?.msg) message = `Validation: ${detail[0].msg}`;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, resp.status, detail);
  }
  return resp.json() as Promise<T>;
}

export function apiGet<T>(path: string, params?: Record<string, string | number | undefined | null>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return request<T>(url.toString());
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}
