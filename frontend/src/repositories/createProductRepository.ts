import { appConfig, type AppConfig } from "../config/appConfig.ts";
import { ApiProductRepository } from "./ApiProductRepository.ts";
import { LocalStorageProductRepository } from "./LocalStorageProductRepository.ts";
import type { ProductRepository } from "./ProductRepository";
import { createApiClient } from "../api/apiClient.ts";

export function createProductRepository(
    config: AppConfig = appConfig,
    storage?: Pick<Storage, "getItem" | "setItem">,
): ProductRepository {
    if (config.dataSource === "api") {
        return new ApiProductRepository(createApiClient(config.apiBaseUrl));
    }
    return new LocalStorageProductRepository(storage);
}
