import { appConfig } from "../config/appConfig.ts";import { createApiClient,setApiCsrfToken } from "./apiClient.ts";
const client=createApiClient(appConfig.apiBaseUrl);export type AdminUser={username:string};
export async function loginAdmin(username:string,password:string){const user=await client.post<AdminUser>("/auth/login",{body:{username,password}});await refreshCsrf();return user}
export async function getCurrentUser(){return client.get<AdminUser>("/auth/me")}
export async function refreshCsrf(){const value=await client.get<{csrfToken:string}>("/auth/csrf");setApiCsrfToken(value.csrfToken);return value.csrfToken}
export async function logoutAdmin(){await client.post<void>("/auth/logout");setApiCsrfToken(null)}
