import { createApiClient } from "../api/apiClient.ts";
import { appConfig, type AppConfig } from "../config/appConfig.ts";
import { ApiSalesRepository } from "./ApiSalesRepository.ts";
import { LocalStorageSalesRepository } from "./LocalStorageSalesRepository.ts";
import type { SalesRepository } from "./SalesRepository";

export function createSalesRepository(
    config: AppConfig = appConfig,
    storage?: Pick<Storage, "getItem" | "setItem">,
): SalesRepository {
    return config.dataSource === "api"
        ? new ApiSalesRepository(createApiClient(config.apiBaseUrl))
        : new LocalStorageSalesRepository(storage);
}
