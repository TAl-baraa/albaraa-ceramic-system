export type DataSource = "localStorage" | "api";

export type AppConfig = {
    apiBaseUrl: string;
    dataSource: DataSource;
};

type Environment = Record<string, string | boolean | undefined>;

const DEFAULT_API_BASE_URL = "http://localhost:8000/api";

export function normalizeApiBaseUrl(value: string | undefined): string {
    const trimmed = value?.trim();
    return (trimmed || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function resolveAppConfig(environment: Environment): AppConfig {
    const requestedSource = environment.VITE_DATA_SOURCE;
    return {
        apiBaseUrl: normalizeApiBaseUrl(environment.VITE_API_BASE_URL as string | undefined),
        dataSource: requestedSource === "api" ? "api" : "localStorage",
    };
}

const runtimeEnvironment =
    (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {};

export const appConfig = resolveAppConfig(runtimeEnvironment);
