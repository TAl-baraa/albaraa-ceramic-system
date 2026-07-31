import { createApiClient } from "../api/apiClient.ts";
import { appConfig, type AppConfig } from "../config/appConfig.ts";
import { ApiCustomerRepository } from "./ApiCustomerRepository.ts";
import { LocalStorageCustomerRepository } from "./LocalStorageCustomerRepository.ts";
import type { CustomerRepository } from "./CustomerRepository";
import type { CustomerStorage } from "./localCustomerRepositorySupport";

export function createCustomerRepository(
    config: AppConfig = appConfig,
    storage?: CustomerStorage,
): CustomerRepository {
    return config.dataSource === "api"
        ? new ApiCustomerRepository(createApiClient(config.apiBaseUrl))
        : new LocalStorageCustomerRepository(storage);
}
