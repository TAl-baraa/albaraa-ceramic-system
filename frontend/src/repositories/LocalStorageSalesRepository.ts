import { ApiError } from "../api/apiClient.ts";
import { buildSaleCancellationPlan } from "../services/saleCancellation.ts";
import { buildSaleCompletionPlan } from "../services/saleCompletion.ts";
import type { Currency } from "../types/customer";
import type { SaleDraftInput, SaleDraftUpdateInput, SaleInvoice, SaleInvoiceItem, SaleInvoiceListRecord, SaleInvoiceRecord, SalesSummary } from "../types/sale";
import { readStoredCustomerTransactions, readStoredCustomers, writeStoredCustomerTransactions } from "../utils/customerStorage.ts";
import { readStoredProducts, writeStoredProducts } from "../utils/productStorage.ts";
import { calculateInvoiceTotals, calculateLineTotal, calculateSubtotal, generateNextInvoiceNumber } from "../utils/salesCalculations.ts";
import { readStoredSaleInvoiceItems, readStoredSaleInvoices, writeStoredSaleInvoiceItems, writeStoredSaleInvoices } from "../utils/salesStorage.ts";
import { readStoredStockMovements, writeStoredStockMovements } from "../utils/stockMovementStorage.ts";
import { validateSaleDraft } from "../utils/saleDraftValidation.ts";
import type { InvoiceListOptions, InvoicePage, SalesRepository } from "./SalesRepository";

type Store = Pick<Storage, "getItem" | "setItem">;
const fail = (code: string, message: string, kind: "not_found" | "conflict" | "validation" = "conflict") => new ApiError({ status: kind === "not_found" ? 404 : kind === "validation" ? 422 : 409, code, message, kind });

export class LocalStorageSalesRepository implements SalesRepository {
    private readonly storage: Store;
    constructor(storage: Store = localStorage) { this.storage = storage; }
    private record(invoice: SaleInvoice, allItems = readStoredSaleInvoiceItems(this.storage)): SaleInvoiceRecord {
        const items = allItems.filter((item) => item.invoiceId === invoice.id);
        return { ...invoice, items, itemCount: items.length, completionAudit: { sourceReference: invoice.invoiceNumber, stockMovementCount: invoice.stockMovementIds.length, reversalMovementCount: invoice.reversalStockMovementIds.length, customerTransactionCreated: invoice.completionTransactionId !== null, customerTransactionVoided: invoice.reversedCustomerTransactionId !== null } };
    }
    async listInvoices(options: InvoiceListOptions = {}): Promise<InvoicePage> {
        const search = options.search?.trim().toLocaleLowerCase("ar") ?? "";
        const allItems = readStoredSaleInvoiceItems(this.storage);
        const filtered = readStoredSaleInvoices(this.storage).filter((invoice) =>
            (!search || invoice.invoiceNumber.toLocaleLowerCase("ar").includes(search) || invoice.customerNameSnapshot.toLocaleLowerCase("ar").includes(search)) &&
            (!options.status || invoice.status === options.status) && (!options.currency || invoice.currency === options.currency) &&
            (!options.customerId || invoice.customerId === options.customerId) && (!options.dateFrom || invoice.createdAt >= options.dateFrom) && (!options.dateTo || invoice.createdAt <= options.dateTo)
        ).toSorted((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt) || b.id-a.id);
        const page=options.page??1, pageSize=options.pageSize??20;
        const items: SaleInvoiceListRecord[] = filtered.slice((page-1)*pageSize,page*pageSize).map((invoice) => ({ ...invoice, itemCount: allItems.filter((item)=>item.invoiceId===invoice.id).length }));
        return {items,total:filtered.length,page,pageSize,totalPages:filtered.length?Math.ceil(filtered.length/pageSize):0};
    }
    async listAllInvoices(options: Omit<InvoiceListOptions,"page"|"pageSize"> = {}) { return (await this.listInvoices({...options,page:1,pageSize:Number.MAX_SAFE_INTEGER})).items; }
    async getInvoiceById(id:number) { const invoice=readStoredSaleInvoices(this.storage).find((v)=>v.id===id); if(!invoice) throw fail("sale_invoice_not_found","Invoice not found","not_found"); return this.record(invoice); }
    async createDraft(input:SaleDraftInput) {
        const valid=validateSaleDraft(input), invoices=readStoredSaleInvoices(this.storage), products=readStoredProducts(this.storage), customers=readStoredCustomers(this.storage), now=new Date().toISOString();
        const customer=valid.customerId===null?null:customers.find((v)=>v.id===valid.customerId); if(valid.customerId!==null&&!customer) throw fail("customer_not_found","Customer not found","not_found");
        const id=Math.max(Date.now(),...invoices.map((v)=>v.id+1),1); let nextItem=id+1;
        const items:SaleInvoiceItem[]=valid.items.map((entry)=>{const product=products.find((v)=>v.id===entry.productId); if(!product) throw fail("product_not_found","Product not found","not_found"); return {id:nextItem++,invoiceId:id,productId:product.id,productCodeSnapshot:product.code,productNameSnapshot:product.name,unit:product.unit,quantity:entry.quantity,unitPrice:entry.unitPrice,total:calculateLineTotal(entry.quantity,entry.unitPrice)};});
        const totals=calculateInvoiceTotals(calculateSubtotal(items),valid.discount,valid.paidAmount);
        const invoice:SaleInvoice={id,invoiceNumber:generateNextInvoiceNumber(invoices,new Date(now).getFullYear()),customerId:valid.customerId,customerNameSnapshot:customer?.name??"بيع نقدي",currency:valid.currency,status:"draft",...totals,note:valid.note.trim(),createdAt:now,updatedAt:now,completedAt:null,completionTransactionId:null,stockMovementIds:[],cancelledAt:null,cancellationReason:"",reversalStockMovementIds:[],reversedCustomerTransactionId:null};
        writeStoredSaleInvoices([invoice,...invoices],this.storage); writeStoredSaleInvoiceItems([...readStoredSaleInvoiceItems(this.storage),...items],this.storage); return this.record(invoice);
    }
    async updateDraft(id:number,input:SaleDraftUpdateInput) { const current=await this.getInvoiceById(id); if(current.status!=="draft") throw fail("sale_invoice_not_draft","Invoice is not a draft"); const merged:SaleDraftInput={customerId:input.customerId??current.customerId,currency:input.currency??current.currency,discount:input.discount??current.discount,paidAmount:input.paidAmount??current.paidAmount,note:input.note??current.note,items:input.items??current.items}; await this.deleteDraft(id); const created=await this.createDraft(merged); const invoices=readStoredSaleInvoices(this.storage); const items=readStoredSaleInvoiceItems(this.storage); const preserved={...created,id:current.id,invoiceNumber:current.invoiceNumber,createdAt:current.createdAt}; const fixedItems=items.filter(v=>v.invoiceId!==created.id).concat(created.items.map(v=>({...v,invoiceId:current.id}))); writeStoredSaleInvoices([{...preserved,items:undefined,completionAudit:undefined,itemCount:undefined} as SaleInvoice,...invoices.filter(v=>v.id!==created.id)],this.storage); writeStoredSaleInvoiceItems(fixedItems,this.storage); return this.record(preserved,fixedItems); }
    async deleteDraft(id:number) { const invoices=readStoredSaleInvoices(this.storage), invoice=invoices.find(v=>v.id===id); if(!invoice) throw fail("sale_invoice_not_found","Invoice not found","not_found"); if(invoice.status!=="draft") throw fail("sale_invoice_not_draft","Invoice is not a draft"); writeStoredSaleInvoices(invoices.filter(v=>v.id!==id),this.storage); writeStoredSaleInvoiceItems(readStoredSaleInvoiceItems(this.storage).filter(v=>v.invoiceId!==id),this.storage); }
    async completeInvoice(id:number) { const invoices=readStoredSaleInvoices(this.storage), invoice=invoices.find(v=>v.id===id), items=readStoredSaleInvoiceItems(this.storage).filter(v=>v.invoiceId===id), movements=readStoredStockMovements(this.storage), transactions=readStoredCustomerTransactions(this.storage); const result=buildSaleCompletionPlan({invoice,invoices,items,products:readStoredProducts(this.storage),customers:readStoredCustomers(this.storage),stockMovements:movements,customerTransactions:transactions,completedAt:new Date().toISOString()}); if(!result.success) throw fail("sale_invoice_completion_failed",result.error); const p=result.plan; writeStoredProducts(p.updatedProducts,this.storage); writeStoredStockMovements([...p.stockMovements,...movements],this.storage); if(p.customerTransaction) writeStoredCustomerTransactions([p.customerTransaction,...transactions],this.storage); writeStoredSaleInvoices(invoices.map(v=>v.id===id?p.completedInvoice:v),this.storage); return this.record(p.completedInvoice); }
    async cancelInvoice(id:number,reason:string) { const invoices=readStoredSaleInvoices(this.storage), invoice=invoices.find(v=>v.id===id), items=readStoredSaleInvoiceItems(this.storage).filter(v=>v.invoiceId===id), movements=readStoredStockMovements(this.storage), transactions=readStoredCustomerTransactions(this.storage); const result=buildSaleCancellationPlan({invoice,items,products:readStoredProducts(this.storage),stockMovements:movements,customerTransactions:transactions,reason,cancelledAt:new Date().toISOString()}); if(!result.success) throw fail("sale_invoice_cancellation_failed",result.error); const p=result.plan; writeStoredProducts(p.updatedProducts,this.storage); writeStoredStockMovements([...p.reversalStockMovements,...movements],this.storage); if(p.voidedCustomerTransaction) writeStoredCustomerTransactions(transactions.map(v=>v.id===p.voidedCustomerTransaction!.id?p.voidedCustomerTransaction!:v),this.storage); writeStoredSaleInvoices(invoices.map(v=>v.id===id?p.cancelledInvoice:v),this.storage); return this.record(p.cancelledInvoice); }
    async getSummary(currency:Currency):Promise<SalesSummary> { const invoices=readStoredSaleInvoices(this.storage).filter(v=>v.currency===currency); const completed=invoices.filter(v=>v.status==="completed"); return {currency,totalInvoiceCount:invoices.length,draftInvoiceCount:invoices.filter(v=>v.status==="draft").length,completedInvoiceCount:completed.length,cancelledInvoiceCount:invoices.filter(v=>v.status==="cancelled").length,completedSalesTotal:completed.reduce((s,v)=>s+v.total,0),positiveRemainingTotal:completed.reduce((s,v)=>s+Math.max(0,v.remainingAmount),0)}; }
}
