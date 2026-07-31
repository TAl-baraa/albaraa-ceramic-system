import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, createApiClient } from "../src/api/apiClient.ts";

test("API client returns JSON and adds query parameters", async () => {
    let requestedUrl = "";
    const mockFetch: typeof fetch = async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    };
    const result = await createApiClient("https://example.test/api/", mockFetch).get<{ ok: boolean }>(
        "/products",
        { query: { page: 2, include: true, ignored: undefined } },
    );
    assert.deepEqual(result, { ok: true });
    assert.match(requestedUrl, /page=2/);
    assert.match(requestedUrl, /include=true/);
});

test("API client handles HTTP 204 without parsing JSON", async () => {
    const mockFetch: typeof fetch = async () => new Response(null, { status: 204 });
    assert.equal(await createApiClient("https://example.test", mockFetch).delete("/products/1"), undefined);
});

test("API client parses structured validation and conflict errors", async () => {
    const mockFetch: typeof fetch = async () =>
        new Response(
            JSON.stringify({
                error: { code: "duplicate_product_code", message: "Duplicate", details: { field: "code" } },
            }),
            { status: 409 },
        );
    await assert.rejects(
        createApiClient("https://example.test", mockFetch).post("/products", { body: {} }),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.status, 409);
            assert.equal(error.kind, "conflict");
            assert.equal(error.code, "duplicate_product_code");
            assert.deepEqual(error.details, { field: "code" });
            return true;
        },
    );
});

test("API client hides unstructured server bodies", async () => {
    const mockFetch: typeof fetch = async () => new Response("<html>stack trace</html>", { status: 500 });
    await assert.rejects(
        createApiClient("https://example.test", mockFetch).get("/products"),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.kind, "server");
            assert.equal(error.message.includes("stack trace"), false);
            return true;
        },
    );
});

test("API client distinguishes network and timeout errors", async () => {
    const networkFetch: typeof fetch = async () => {
        throw new TypeError("offline");
    };
    await assert.rejects(
        createApiClient("https://example.test", networkFetch).get("/health"),
        (error: unknown) => error instanceof ApiError && error.kind === "network",
    );

    const hangingFetch: typeof fetch = (_input, init) =>
        new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
    await assert.rejects(
        createApiClient("https://example.test", hangingFetch).get("/health", { timeoutMs: 5 }),
        (error: unknown) => error instanceof ApiError && error.kind === "timeout",
    );
});

test("API client forwards caller cancellation", async () => {
    const hangingFetch: typeof fetch = (_input, init) =>
        new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
    const controller = new AbortController();
    const request = createApiClient("https://example.test", hangingFetch).get("/products", {
        signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(request, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});
