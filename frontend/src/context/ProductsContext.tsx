import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiErrorToArabic } from "../api/apiErrorMessages.ts";
import { createApiClient } from "../api/apiClient.ts";
import { appConfig } from "../config/appConfig.ts";
import { ApiInventoryRepository } from "../repositories/ApiInventoryRepository.ts";
import { ApiProductRepository } from "../repositories/ApiProductRepository.ts";
import type { Product } from "../types/product";
import type { AddStockMovementResult, StockMovement, StockMovementInput } from "../types/stockMovement";

type Result=AddStockMovementResult;
type Value={products:Product[];stockMovements:StockMovement[];loading:boolean;error:string|null;refresh:()=>Promise<void>;addProduct:(p:Product)=>Promise<Result>;updateProduct:(p:Product)=>Promise<Result>;deleteProduct:(id:number)=>Promise<Result>;addStockMovement:(m:StockMovementInput)=>Promise<Result>;applySaleStockPlan:()=>void};
const Context=createContext<Value|null>(null);
export function ProductsProvider({children}:{children:ReactNode}){
 const repos=useMemo(()=>{const client=createApiClient(appConfig.apiBaseUrl);return{products:new ApiProductRepository(client),inventory:new ApiInventoryRepository(client)}},[]);
 const [products,setProducts]=useState<Product[]>([]),[stockMovements,setMovements]=useState<StockMovement[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const refresh=useCallback(async()=>{setLoading(true);setError(null);try{const [p,m]=await Promise.all([repos.products.listAll(),repos.inventory.listAllMovements()]);setProducts(p);setMovements(m.map(v=>({id:v.id,productId:v.productId,type:v.type,quantity:v.quantity,previousQuantity:v.previousQuantity,newQuantity:v.newQuantity,note:v.note,createdAt:v.createdAt,sourceType:v.sourceType==="sale_invoice"||v.sourceType==="sale_invoice_cancellation"?v.sourceType:"manual",sourceId:v.sourceId,sourceReference:v.sourceReference})));}catch(e){setError(apiErrorToArabic(e));throw e}finally{setLoading(false)}},[repos]);
 useEffect(()=>{void refresh().catch(()=>undefined)},[refresh]);
 const run=useCallback(async(fn:()=>Promise<unknown>):Promise<Result>=>{try{await fn();await refresh();return{success:true}}catch(e){return{success:false,error:apiErrorToArabic(e)}}},[refresh]);
 return <Context.Provider value={{products,stockMovements,loading,error,refresh,addProduct:p=>run(()=>repos.products.create({...p})),updateProduct:p=>run(()=>repos.products.update(p.id,{code:p.code,name:p.name,size:p.size,company:p.company,unit:p.unit,minimumQuantity:p.minimumQuantity,sellPriceIqd:p.sellPriceIqd,purchasePriceUsd:p.purchasePriceUsd})),deleteProduct:id=>run(()=>repos.products.remove(id)),addStockMovement:m=>run(()=>m.type==="in"?repos.inventory.createStockIn({productId:m.productId,quantity:m.quantity,note:m.note}):m.type==="out"?repos.inventory.createStockOut({productId:m.productId,quantity:m.quantity,note:m.note}):repos.inventory.createAdjustment({productId:m.productId,finalQuantity:m.quantity,note:m.note})),applySaleStockPlan:()=>undefined}}>{children}</Context.Provider>;
}
// oxlint-disable-next-line react/only-export-components
export function useProducts(){const value=useContext(Context);if(!value)throw new Error("useProducts must be used inside ProductsProvider");return value}
