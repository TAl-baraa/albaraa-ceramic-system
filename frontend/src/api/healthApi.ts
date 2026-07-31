import { appConfig } from "../config/appConfig.ts";
import { createApiClient, type ApiClient } from "./apiClient.ts";

export type BackendHealth = {
    status: "healthy";
    database: "connected";
};

export function getBackendHealth(
    signal?: AbortSignal,
    client: ApiClient = createApiClient(appConfig.apiBaseUrl),
): Promise<BackendHealth> {
    return client.get<BackendHealth>("/health", { signal });
}
