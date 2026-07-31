export type ApiErrorKind =
    | "network"
    | "timeout"
    | "validation"
    | "conflict"
    | "not_found"
    | "server"
    | "http";

export class ApiError extends Error {
    readonly status: number | null;
    readonly code: string;
    readonly details: unknown;
    readonly kind: ApiErrorKind;

    constructor(options: {
        status?: number | null;
        code: string;
        message: string;
        details?: unknown;
        kind: ApiErrorKind;
    }) {
        super(options.message);
        this.name = "ApiError";
        this.status = options.status ?? null;
        this.code = options.code;
        this.details = options.details;
        this.kind = options.kind;
    }
}

export type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
    body?: unknown;
    query?: Record<string, QueryValue>;
    signal?: AbortSignal;
    timeoutMs?: number;
};

export type ApiClient = {
    get<T>(path: string, options?: ApiRequestOptions): Promise<T>;
    post<T>(path: string, options?: ApiRequestOptions): Promise<T>;
    patch<T>(path: string, options?: ApiRequestOptions): Promise<T>;
    delete(path: string, options?: ApiRequestOptions): Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 15_000;
let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
export function setApiCsrfToken(token: string | null): void { csrfToken = token; }
export function setApiUnauthorizedHandler(handler: (() => void) | null): void { unauthorizedHandler = handler; }

function errorKind(status: number): ApiErrorKind {
    if (status === 404) return "not_found";
    if (status === 409) return "conflict";
    if (status === 400 || status === 422) return "validation";
    if (status >= 500) return "server";
    return "http";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseErrorPayload(value: unknown): {
    code?: string;
    message?: string;
    details?: unknown;
} {
    if (!isRecord(value) || !isRecord(value.error)) return {};
    return {
        code: typeof value.error.code === "string" ? value.error.code : undefined,
        message:
            typeof value.error.message === "string" ? value.error.message : undefined,
        details: value.error.details,
    };
}

function createUrl(
    baseUrl: string,
    path: string,
    query?: Record<string, QueryValue>,
): string {
    const joined = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    const url = new URL(joined, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    });
    return /^https?:\/\//.test(baseUrl) ? url.toString() : `${url.pathname}${url.search}`;
}

export function createApiClient(
    baseUrl: string,
    fetchImplementation: typeof fetch = fetch,
): ApiClient {
    async function request<T>(
        method: "GET" | "POST" | "PATCH" | "DELETE",
        path: string,
        options: ApiRequestOptions = {},
    ): Promise<T> {
        const controller = new AbortController();
        let timedOut = false;
        const onAbort = () => controller.abort(options.signal?.reason);
        options.signal?.addEventListener("abort", onAbort, { once: true });
        if (options.signal?.aborted) onAbort();
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        try {
            const hasBody = options.body !== undefined;
            const response = await fetchImplementation(
                createUrl(baseUrl.replace(/\/+$/, ""), path, options.query),
                {
                    method,
                    credentials: "include",
                    signal: controller.signal,
                    headers: {
                        ...(hasBody ? { "Content-Type": "application/json" } : {}),
                        ...(["POST", "PATCH", "DELETE"].includes(method) && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
                    },
                    body: hasBody ? JSON.stringify(options.body) : undefined,
                },
            );
            if (response.status === 204) return undefined as T;

            const rawBody = await response.text();
            let parsed: unknown;
            if (rawBody) {
                try {
                    parsed = JSON.parse(rawBody);
                } catch {
                    parsed = undefined;
                }
            }
            if (!response.ok) {
                if (response.status === 401) unauthorizedHandler?.();
                const structured = parseErrorPayload(parsed);
                throw new ApiError({
                    status: response.status,
                    code: structured.code ?? `http_${response.status}`,
                    message: structured.message ?? "The server could not process the request.",
                    details: structured.details,
                    kind: errorKind(response.status),
                });
            }
            if (!rawBody) return undefined as T;
            if (parsed === undefined) {
                throw new ApiError({
                    status: response.status,
                    code: "invalid_json_response",
                    message: "The server returned an invalid response.",
                    kind: "server",
                });
            }
            return parsed as T;
        } catch (error: unknown) {
            if (error instanceof ApiError) throw error;
            if (timedOut) {
                throw new ApiError({
                    code: "request_timeout",
                    message: "The request timed out.",
                    kind: "timeout",
                });
            }
            if (options.signal?.aborted) throw error;
            throw new ApiError({
                code: "network_error",
                message: "The server could not be reached.",
                kind: "network",
            });
        } finally {
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", onAbort);
        }
    }

    return {
        get: <T>(path: string, options?: ApiRequestOptions) =>
            request<T>("GET", path, options),
        post: <T>(path: string, options?: ApiRequestOptions) =>
            request<T>("POST", path, options),
        patch: <T>(path: string, options?: ApiRequestOptions) =>
            request<T>("PATCH", path, options),
        delete: (path: string, options?: ApiRequestOptions) =>
            request<void>("DELETE", path, options),
    };
}
