/**
 * Browser access to the ESN Frankfurt API (the Cloudflare Worker in
 * /backend). When `NEXT_PUBLIC_API_BASE_URL` is empty, the app runs in demo
 * mode and keeps all team data in the browser instead.
 */
export const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
  /** Send `undefined` fields as `null` (= "clear this field" for PATCH). */
  nullForUndefined?: boolean;
}

/**
 * JSON request with the session cookie. Error responses carry a readable
 * `{ "error": "…" }` message from the API, which is surfaced to the UI.
 */
export async function apiRequest(
  baseUrl: string,
  path: string,
  { method = "GET", body, fetchImpl = fetch, nullForUndefined }: ApiRequestOptions = {},
): Promise<unknown> {
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : JSON.stringify(
            body,
            nullForUndefined ? (_k, v) => (v === undefined ? null : v) : undefined,
          ),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === "string" && data.error) message = data.error;
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
