import assert from "node:assert/strict";
import test from "node:test";

import { normalizeApiBaseUrl, resolveAppConfig } from "../src/config/appConfig.ts";

test("configuration defaults to the authoritative API", () => {
    assert.deepEqual(resolveAppConfig({}), {
        apiBaseUrl: "http://localhost:8000/api",
        dataSource: "api",
    });
});

test("configuration accepts API mode and normalizes its base URL", () => {
    assert.deepEqual(
        resolveAppConfig({
            VITE_DATA_SOURCE: "api",
            VITE_API_BASE_URL: " https://example.test/api/// ",
        }),
        { apiBaseUrl: "https://example.test/api", dataSource: "api" },
    );
    assert.equal(normalizeApiBaseUrl("http://localhost:8000/api/"), "http://localhost:8000/api");
});

test("unsupported data sources never silently enable localStorage", () => {
    assert.equal(resolveAppConfig({ VITE_DATA_SOURCE: "database" }).dataSource, "api");
});
