import assert from "node:assert/strict";
import test from "node:test";
import { clearKnownLocalStorageData, KNOWN_BUSINESS_STORAGE_KEYS } from "../src/utils/knownLocalStorage.ts";

test("cleanup removes only known business keys", () => {
    const values = new Map<string, string>([["unrelated", "keep"]]);
    KNOWN_BUSINESS_STORAGE_KEYS.forEach((key) => values.set(key, "test"));
    clearKnownLocalStorageData({ removeItem: (key) => { values.delete(key); } });
    assert.equal(values.get("unrelated"), "keep");
    KNOWN_BUSINESS_STORAGE_KEYS.forEach((key) => assert.equal(values.has(key), false));
});
