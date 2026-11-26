/*
  Typed client for the Cendol Satay API (/api/v1).
  Every error comes back as ApiError with a plain-language `message` that can go straight into a toast.
*/

export * from "./types";
export * from "./directory";
export * from "./civic";
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.errors = body.errors ?? {};
  }

  /** First message for a form field, if the server rejected it. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

export type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type Query = Record<string, QueryValue>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called when the server says the sign-in is no longer valid. */
  onUnauthenticated?: () => void;
}

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

/** Turns { filter: {...} } style keys into filter[q]=... the way the Laravel API expects. */
export function toSearchParams(query: Query = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

export function createApiClient(options: ApiClientOptions) {
  const offlineError = new ApiError(0, {
    message: "We can't reach the server. Please check your connection and try again.",
    code: "NETWORK_ERROR",
  });

  async function request<T>(method: string, path: string, { query, body, signal }: RequestOptions = {}): Promise<T> {
    const search = toSearchParams(query).toString();
    const url = `${options.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}${search ? `?${search}` : ""}`;
    const token = options.getToken();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        signal,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw offlineError;
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) options.onUnauthenticated?.();
      throw new ApiError(
        response.status,
        data && typeof data.message === "string"
          ? data
          : { message: "Something went wrong on our side. Please try again in a moment.", code: "SERVER_ERROR" },
      );
    }

    return data as T;
  }

  function buildUrl(path: string, query?: Query): string {
    const search = toSearchParams(query).toString();
    return `${options.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}${search ? `?${search}` : ""}`;
  }

  function authHeaders(): Record<string, string> {
    const token = options.getToken();
    return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function failure(response: Response): Promise<never> {
    const data = await response.json().catch(() => null);
    if (response.status === 401) options.onUnauthenticated?.();
    throw new ApiError(
      response.status,
      data && typeof data.message === "string"
        ? data
        : { message: "Something went wrong on our side. Please try again in a moment.", code: "SERVER_ERROR" },
    );
  }

  /** Sends a form with files (multipart). Values that are null or undefined are left out. */
  async function upload<T>(path: string, fields: Record<string, string | number | boolean | Blob | null | undefined>): Promise<T> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value === null || value === undefined) continue;
      form.append(key, value instanceof Blob ? value : typeof value === "boolean" ? (value ? "1" : "0") : String(value));
    }
    let response: Response;
    try {
      response = await fetch(buildUrl(path), { method: "POST", headers: authHeaders(), body: form });
    } catch {
      throw offlineError;
    }
    if (!response.ok) return failure(response);
    return (await response.json()) as T;
  }

  /** Fetches a file (PDF, CSV) with the sign-in token and returns it with the name the server gave it. */
  async function download(path: string, query?: Query): Promise<{ blob: Blob; filename: string }> {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, query), { headers: authHeaders() });
    } catch {
      throw offlineError;
    }
    if (!response.ok) return failure(response);
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: await response.blob(), filename: match ? decodeURIComponent(match[1]) : "download" };
  }

  return {
    request,
    upload,
    download,
    get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
    delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
