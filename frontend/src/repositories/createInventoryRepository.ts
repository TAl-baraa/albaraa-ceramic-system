import { createApiClient } from "../api/apiClient.ts";
import { appConfig, type AppConfig } from "../config/appConfig.ts";
import { ApiInventoryRepository } from "./ApiInventoryRepository.ts";
import type { InventoryRepository } from "./InventoryRepository";
import { LocalStorageInventoryRepository } from "./LocalStorageInventoryRepository.ts";

export function createInventoryRepository(
    config: AppConfig = appConfig,
    storage?: Pick<Storage, "getItem" | "setItem">,
): InventoryRepository {
    return config.dataSource === "api"
        ? new ApiInventoryRepository(createApiClient(config.apiBaseUrl))
        : new LocalStorageInventoryRepository(storage);
}
