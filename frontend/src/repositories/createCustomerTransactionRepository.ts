import { createApiClient } from "../api/apiClient.ts";
import { appConfig, type AppConfig } from "../config/appConfig.ts";
import { ApiCustomerTransactionRepository } from "./ApiCustomerTransactionRepository.ts";
import { LocalStorageCustomerTransactionRepository } from "./LocalStorageCustomerTransactionRepository.ts";
import type { CustomerTransactionRepository } from "./CustomerTransactionRepository";
import type { CustomerStorage } from "./localCustomerRepositorySupport";

export function createCustomerTransactionRepository(
    config: AppConfig = appConfig,
    storage?: CustomerStorage,
): CustomerTransactionRepository {
    return config.dataSource === "api"
        ? new ApiCustomerTransactionRepository(createApiClient(config.apiBaseUrl))
        : new LocalStorageCustomerTransactionRepository(storage);
}
