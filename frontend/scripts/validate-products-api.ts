import { createApiClient } from "../src/api/apiClient.ts";
import { getBackendHealth } from "../src/api/healthApi.ts";
import { normalizeApiBaseUrl } from "../src/config/appConfig.ts";
import { ApiProductRepository } from "../src/repositories/ApiProductRepository.ts";

const baseUrl = normalizeApiBaseUrl(
    process.env.VITE_API_BASE_URL ?? process.env.API_BASE_URL,
);
const client = createApiClient(baseUrl);
const repository = new ApiProductRepository(client);
let temporaryProductId: number | null = null;

try {
    const health = await getBackendHealth(undefined, client);
    console.log("Health:", health);
    console.log("Existing product count:", (await repository.listAll()).length);

    const code = `API-VALIDATION-${Date.now()}`;
    const created = await repository.create({
        code,
        name: "Temporary API validation product",
        size: "1x1",
        company: "Temporary validation",
        unit: "قطعة",
        quantity: 0,
        minimumQuantity: 0,
        sellPriceIqd: 1,
        purchasePriceUsd: 1,
    });
    temporaryProductId = created.id;
    const retrieved = await repository.getById(created.id);
    const updated = await repository.update(created.id, {
        name: "Temporary API validation product updated",
    });
    console.log("Created, retrieved, and updated:", {
        id: updated.id,
        code: retrieved.code,
        name: updated.name,
    });
} finally {
    if (temporaryProductId !== null) {
        await repository.remove(temporaryProductId);
        console.log("Temporary product deleted:", temporaryProductId);
    }
}
