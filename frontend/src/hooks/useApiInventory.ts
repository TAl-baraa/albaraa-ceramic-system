import { useCallback, useEffect, useMemo, useState } from "react";

import { createApiClient } from "../api/apiClient.ts";
import { appConfig } from "../config/appConfig.ts";
import { ApiInventoryRepository } from "../repositories/ApiInventoryRepository.ts";
import type {
    InventoryAdjustmentInput,
    InventoryQuantityInput,
    InventorySummary,
    LowStockProduct,
    StockMovementRecord,
} from "../types/stockMovement";
import type { AsyncState } from "./useApiProducts";

type UseApiInventoryOptions = {
    onInventoryChanged?: (movement: StockMovementRecord) => void | Promise<void>;
};

export function useApiInventory(options: UseApiInventoryOptions = {}) {
    const onInventoryChanged = options.onInventoryChanged;
    const repository = useMemo(
        () => new ApiInventoryRepository(createApiClient(appConfig.apiBaseUrl)),
        [],
    );
    const [summary, setSummary] = useState<InventorySummary | null>(null);
    const [movements, setMovements] = useState<StockMovementRecord[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
    const [state, setState] = useState<AsyncState>("idle");
    const [error, setError] = useState<unknown>(null);

    const refresh = useCallback(async (signal?: AbortSignal) => {
        setState("loading");
        setError(null);
        try {
            const [nextSummary, movementPage, nextLowStock] = await Promise.all([
                repository.getSummary({ signal }),
                repository.listMovements({ page: 1, pageSize: 100, signal }),
                repository.listLowStock({ includeOutOfStock: true, limit: 200, signal }),
            ]);
            setSummary(nextSummary);
            setMovements(movementPage.items);
            setLowStockProducts(nextLowStock);
            setState("success");
        } catch (caught: unknown) {
            if (signal?.aborted) return;
            setError(caught);
            setState("error");
        }
    }, [repository]);

    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        return () => controller.abort();
    }, [refresh]);

    const afterMutation = useCallback(async (movement: StockMovementRecord) => {
        await onInventoryChanged?.(movement);
        await refresh();
        return movement;
    }, [onInventoryChanged, refresh]);

    const stockIn = useCallback(
        async (input: InventoryQuantityInput) =>
            afterMutation(await repository.createStockIn(input)),
        [afterMutation, repository],
    );
    const stockOut = useCallback(
        async (input: InventoryQuantityInput) =>
            afterMutation(await repository.createStockOut(input)),
        [afterMutation, repository],
    );
    const adjust = useCallback(
        async (input: InventoryAdjustmentInput) =>
            afterMutation(await repository.createAdjustment(input)),
        [afterMutation, repository],
    );

    return {
        summary,
        movements,
        lowStockProducts,
        state,
        error,
        refresh,
        stockIn,
        stockOut,
        adjust,
    };
}
