import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient } from "../api/apiClient.ts";
import { appConfig } from "../config/appConfig.ts";
import { ApiSalesRepository } from "../repositories/ApiSalesRepository.ts";
import type { Currency } from "../types/customer";
import type { SaleDraftInput, SaleDraftUpdateInput, SaleInvoiceListRecord, SaleInvoiceRecord, SalesSummary } from "../types/sale";
import type { AsyncState } from "./useApiProducts";

export type SalesMutationEffects = { refreshProducts: true; refreshInventory: true; refreshCustomers: true; refreshDashboard: true; invoice: SaleInvoiceRecord };
type Options = { currency?: Currency; onSalesLifecycleChanged?: (effects: SalesMutationEffects) => void | Promise<void> };

export function useApiSales({ currency = "IQD", onSalesLifecycleChanged }: Options = {}) {
    const repository=useMemo(()=>new ApiSalesRepository(createApiClient(appConfig.apiBaseUrl)),[]);
    const [invoices,setInvoices]=useState<SaleInvoiceListRecord[]>([]), [selectedInvoice,setSelectedInvoice]=useState<SaleInvoiceRecord|null>(null), [summary,setSummary]=useState<SalesSummary|null>(null);
    const [state,setState]=useState<AsyncState>("idle"), [error,setError]=useState<unknown>(null);
    const refresh=useCallback(async(signal?:AbortSignal)=>{setState("loading");setError(null);try{const [nextInvoices,nextSummary]=await Promise.all([repository.listInvoices({page:1,pageSize:100,signal}),repository.getSummary(currency,{signal})]);setInvoices(nextInvoices.items);setSummary(nextSummary);setState("success");}catch(caught:unknown){if(signal?.aborted)return;setError(caught);setState("error");}},[currency,repository]);
    useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>controller.abort();},[refresh]);
    const select=useCallback(async(id:number)=>{const value=await repository.getInvoiceById(id);setSelectedInvoice(value);return value;},[repository]);
    const mutate=useCallback(async(operation:()=>Promise<SaleInvoiceRecord>, lifecycle=false)=>{const invoice=await operation();setSelectedInvoice(invoice);if(lifecycle) await onSalesLifecycleChanged?.({refreshProducts:true,refreshInventory:true,refreshCustomers:true,refreshDashboard:true,invoice});await refresh();return invoice;},[onSalesLifecycleChanged,refresh]);
    return {invoices,selectedInvoice,summary,state,error,refresh,selectInvoice:select,
        createDraft:(input:SaleDraftInput)=>mutate(()=>repository.createDraft(input)),
        updateDraft:(id:number,input:SaleDraftUpdateInput)=>mutate(()=>repository.updateDraft(id,input)),
        deleteDraft:async(id:number)=>{await repository.deleteDraft(id);if(selectedInvoice?.id===id)setSelectedInvoice(null);await refresh();},
        completeInvoice:(id:number)=>mutate(()=>repository.completeInvoice(id),true),
        cancelInvoice:(id:number,reason:string)=>mutate(()=>repository.cancelInvoice(id,reason),true)};
}
