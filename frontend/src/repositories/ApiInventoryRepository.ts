import { ApiError, createApiClient, type ApiClient } from "../api/apiClient.ts";
import type {
    InventorySummaryDto,
    LowStockProductDto,
    StockMovementDto,
    StockMovementListDto,
} from "../api/inventory/inventoryApiTypes";
import {
    inventorySummaryDtoToDomain,
    lowStockProductDtoToDomain,
    stockAdjustmentInputToDto,
    stockInInputToDto,
    stockMovementDtoToDomain,
    stockOutInputToDto,
    InventoryMappingError,
} from "../api/inventory/inventoryMappers.ts";
import type {
    InventoryAdjustmentInput,
    InventoryQuantityInput,
    InventorySummary,
    LowStockProduct,
    StockMovementRecord,
} from "../types/stockMovement";
import type {
    InventoryRepository,
    InventoryRequestOptions,
    LowStockOptions,
    MovementListOptions,
    MovementPage,
} from "./InventoryRepository";

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 10_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateFilter(value: string | undefined, field: string): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (DATE_ONLY.test(trimmed)) return trimmed;
    if (!Number.isFinite(Date.parse(trimmed))) {
        throw new InventoryMappingError(`${field} is invalid`);
    }
    return trimmed;
}

export class ApiInventoryRepository implements InventoryRepository {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async getSummary(options: InventoryRequestOptions = {}): Promise<InventorySummary> {
        return inventorySummaryDtoToDomain(
            await this.client.get<InventorySummaryDto>("/inventory/summary", {
                signal: options.signal,
            }),
        );
    }

    async listLowStock(options: LowStockOptions = {}): Promise<LowStockProduct[]> {
        const response = await this.client.get<LowStockProductDto[]>("/inventory/low-stock", {
            signal: options.signal,
            query: {
                includeOutOfStock: options.includeOutOfStock ?? true,
                limit: options.limit ?? 50,
            },
        });
        return response.map(lowStockProductDtoToDomain);
    }

    async listMovements(options: MovementListOptions = {}): Promise<MovementPage> {
        const response = await this.client.get<StockMovementListDto>("/inventory/movements", {
            signal: options.signal,
            query: {
                productId: options.productId,
                movementType: options.movementType,
                sourceType: options.sourceType?.trim(),
                search: options.search?.trim(),
                dateFrom: dateFilter(options.dateFrom, "dateFrom"),
                dateTo: dateFilter(options.dateTo, "dateTo"),
                page: options.page ?? 1,
                pageSize: options.pageSize ?? 20,
            },
        });
        return { ...response, items: response.items.map(stockMovementDtoToDomain) };
    }

    async listAllMovements(
        options: Omit<MovementListOptions, "page" | "pageSize"> = {},
    ): Promise<StockMovementRecord[]> {
        const movements: StockMovementRecord[] = [];
        let page = 1;
        while (page <= MAX_PAGES) {
            const response = await this.listMovements({
                ...options,
                page,
                pageSize: MAX_PAGE_SIZE,
            });
            if (
                response.page !== page || response.pageSize <= 0 || response.total < 0 ||
                response.totalPages < 0
            ) {
                throw new ApiError({
                    status: 200,
                    code: "invalid_movement_pagination",
                    message: "The server returned invalid movement pagination data.",
                    kind: "server",
                });
            }
            movements.push(...response.items);
            if (
                response.items.length === 0 || movements.length >= response.total ||
                page >= response.totalPages
            ) return movements;
            page += 1;
        }
        throw new ApiError({
            status: 200,
            code: "movement_pagination_limit_exceeded",
            message: "Movement pagination did not terminate safely.",
            kind: "server",
        });
    }

    async getMovementById(
        id: number,
        options: InventoryRequestOptions = {},
    ): Promise<StockMovementRecord> {
        return stockMovementDtoToDomain(
            await this.client.get<StockMovementDto>(`/inventory/movements/${id}`, {
                signal: options.signal,
            }),
        );
    }

    async createStockIn(
        input: InventoryQuantityInput,
        options: InventoryRequestOptions = {},
    ): Promise<StockMovementRecord> {
        return stockMovementDtoToDomain(
            await this.client.post<StockMovementDto>("/inventory/movements/in", {
                body: stockInInputToDto(input), signal: options.signal,
            }),
        );
    }

    async createStockOut(
        input: InventoryQuantityInput,
        options: InventoryRequestOptions = {},
    ): Promise<StockMovementRecord> {
        return stockMovementDtoToDomain(
            await this.client.post<StockMovementDto>("/inventory/movements/out", {
                body: stockOutInputToDto(input), signal: options.signal,
            }),
        );
    }

    async createAdjustment(
        input: InventoryAdjustmentInput,
        options: InventoryRequestOptions = {},
    ): Promise<StockMovementRecord> {
        return stockMovementDtoToDomain(
            await this.client.post<StockMovementDto>("/inventory/movements/adjustment", {
                body: stockAdjustmentInputToDto(input), signal: options.signal,
            }),
        );
    }
}

export function createApiInventoryRepository(baseUrl: string): ApiInventoryRepository {
    return new ApiInventoryRepository(createApiClient(baseUrl));
}
