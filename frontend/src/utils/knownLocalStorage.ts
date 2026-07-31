import { CUSTOMERS_STORAGE_KEY, CUSTOMER_TRANSACTIONS_STORAGE_KEY } from "./customerStorage.ts";
import { PRODUCTS_STORAGE_KEY } from "./productStorage.ts";
import { SALES_INVOICES_STORAGE_KEY, SALES_ITEMS_STORAGE_KEY } from "./salesStorage.ts";
import { STOCK_MOVEMENTS_STORAGE_KEY } from "./stockMovementStorage.ts";
export const KNOWN_BUSINESS_STORAGE_KEYS=[PRODUCTS_STORAGE_KEY,CUSTOMERS_STORAGE_KEY,CUSTOMER_TRANSACTIONS_STORAGE_KEY,STOCK_MOVEMENTS_STORAGE_KEY,SALES_INVOICES_STORAGE_KEY,SALES_ITEMS_STORAGE_KEY] as const;
export function clearKnownLocalStorageData(storage:Pick<Storage,"removeItem">=localStorage){KNOWN_BUSINESS_STORAGE_KEYS.forEach(key=>storage.removeItem(key));}
