import { useCallback, useEffect, useMemo, useState } from "react";

import { createApiClient } from "../api/apiClient.ts";
import { appConfig } from "../config/appConfig.ts";
import { ApiCustomerRepository } from "../repositories/ApiCustomerRepository.ts";
import { ApiCustomerTransactionRepository } from "../repositories/ApiCustomerTransactionRepository.ts";
import type {
    CustomerBalanceRecord,
    CustomerInput,
    CustomerRecord,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    CustomerUpdateInput,
} from "../types/customer";
import type { AsyncState } from "./useApiProducts";

export function useApiCustomers() {
    const repositories = useMemo(() => {
        const client = createApiClient(appConfig.apiBaseUrl);
        return {
            customers: new ApiCustomerRepository(client),
            transactions: new ApiCustomerTransactionRepository(client),
        };
    }, []);
    const [customers, setCustomers] = useState<CustomerRecord[]>([]);
    const [balances, setBalances] = useState<Map<number, CustomerBalanceRecord>>(new Map());
    const [state, setState] = useState<AsyncState>("idle");
    const [error, setError] = useState<unknown>(null);

    const refresh = useCallback(async (signal?: AbortSignal) => {
        setState("loading");
        setError(null);
        try {
            setCustomers(await repositories.customers.listAll({ includeBalances: true, signal }));
            setState("success");
        } catch (caught: unknown) {
            if (signal?.aborted) return;
            setError(caught);
            setState("error");
        }
    }, [repositories]);

    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal);
        return () => controller.abort();
    }, [refresh]);

    const refreshBalance = useCallback(async (customerId: number, signal?: AbortSignal) => {
        const balance = await repositories.transactions.getBalances(customerId, signal);
        setBalances((current) => new Map(current).set(customerId, balance));
        return balance;
    }, [repositories]);

    const createCustomer = useCallback(async (input: CustomerInput) => {
        const created = await repositories.customers.create(input);
        setCustomers((current) => [created, ...current]);
        return created;
    }, [repositories]);

    const updateCustomer = useCallback(async (id: number, input: CustomerUpdateInput) => {
        const updated = await repositories.customers.update(id, input);
        setCustomers((current) => current.map((item) => item.id === id ? updated : item));
        return updated;
    }, [repositories]);

    const removeCustomer = useCallback(async (id: number) => {
        await repositories.customers.remove(id);
        setCustomers((current) => current.filter((item) => item.id !== id));
        setBalances((current) => {
            const next = new Map(current);
            next.delete(id);
            return next;
        });
    }, [repositories]);

    const createTransaction = useCallback(async (
        customerId: number,
        input: Omit<CustomerTransactionInput, "customerId">,
    ) => {
        const created = await repositories.transactions.create(customerId, input);
        await refreshBalance(customerId);
        return created;
    }, [repositories, refreshBalance]);

    const correctTransaction = useCallback(async (
        customerId: number,
        transactionId: number,
        input: Omit<CustomerTransactionCorrectionInput, "transactionId">,
    ) => {
        const result = await repositories.transactions.correct(customerId, transactionId, input);
        setBalances((current) => new Map(current).set(customerId, result.balances));
        return result;
    }, [repositories]);

    const voidTransaction = useCallback(async (
        customerId: number,
        transactionId: number,
        reason: string,
    ) => {
        const result = await repositories.transactions.void(customerId, transactionId, reason);
        await refreshBalance(customerId);
        return result;
    }, [repositories, refreshBalance]);

    return {
        customers,
        balances,
        state,
        error,
        refresh,
        refreshBalance,
        createCustomer,
        updateCustomer,
        removeCustomer,
        createTransaction,
        correctTransaction,
        voidTransaction,
        listTransactions: repositories.transactions.list.bind(repositories.transactions),
    };
}
