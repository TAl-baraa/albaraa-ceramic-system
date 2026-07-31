import { useCallback, useEffect, useMemo, useState } from "react";

import { appConfig } from "../config/appConfig";
import { ApiProductRepository } from "../repositories/ApiProductRepository";
import type { ProductCreateInput, ProductRecord, ProductUpdateInput } from "../types/product";
import { createApiClient } from "../api/apiClient";

export type AsyncState = "idle" | "loading" | "success" | "error";

export function useApiProducts() {
    const repository = useMemo(
        () => new ApiProductRepository(createApiClient(appConfig.apiBaseUrl)),
        [],
    );
    const [products, setProducts] = useState<ProductRecord[]>([]);
    const [state, setState] = useState<AsyncState>("idle");
    const [error, setError] = useState<unknown>(null);

    const refresh = useCallback(
        async (signal?: AbortSignal) => {
            setState("loading");
            setError(null);
            try {
                setProducts(await repository.listAll({ signal }));
                setState("success");
            } catch (caught: unknown) {
                if (signal?.aborted) return;
                setError(caught);
                setState("error");
            }
        },
        [repository],
    );

    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        return () => controller.abort();
    }, [refresh]);

    const create = useCallback(
        async (input: ProductCreateInput) => {
            const created = await repository.create(input);
            setProducts((current) => [created, ...current]);
            return created;
        },
        [repository],
    );
    const update = useCallback(
        async (id: number, input: ProductUpdateInput) => {
            const updated = await repository.update(id, input);
            setProducts((current) =>
                current.map((product) => (product.id === id ? updated : product)),
            );
            return updated;
        },
        [repository],
    );
    const remove = useCallback(
        async (id: number) => {
            await repository.remove(id);
            setProducts((current) => current.filter((product) => product.id !== id));
        },
        [repository],
    );

    return { products, state, error, refresh, create, update, remove };
}
