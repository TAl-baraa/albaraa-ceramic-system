import type { Currency } from "../../types/customer";
import type { ProductUnit } from "../../types/product";
import type {
    SaleDraftInput,
    SaleDraftItemInput,
    SaleDraftUpdateInput,
    SaleInvoiceItemRecord,
    SaleInvoiceListRecord,
    SaleInvoiceRecord,
    SaleInvoiceStatus,
    SalesSummary,
} from "../../types/sale";
import type {
    SaleCancellationRequestDto,
    SaleDraftCreateRequestDto,
    SaleDraftItemRequestDto,
    SaleDraftUpdateRequestDto,
    SaleInvoiceDto,
    SaleInvoiceItemDto,
    SaleInvoiceListItemDto,
    SalesSummaryDto,
} from "./salesApiTypes";
import { mergeSaleDraftItems, validateSaleDraft } from "../../utils/saleDraftValidation.ts";

const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class SalesMappingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SalesMappingError";
    }
}

function decimal(value: string, field: string, signed = false): number {
    if (!(signed ? SIGNED_DECIMAL : UNSIGNED_DECIMAL).test(value)) {
        throw new SalesMappingError(`${field} is not a valid decimal string`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER) {
        throw new SalesMappingError(`${field} is outside the supported numeric range`);
    }
    return parsed;
}

function safeId(value: number, field: string): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new SalesMappingError(`${field} is invalid`);
    }
    return value;
}

function count(value: number, field: string): number {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new SalesMappingError(`${field} is invalid`);
    }
    return value;
}

function date(value: string, field: string): string {
    if (!Number.isFinite(Date.parse(value))) {
        throw new SalesMappingError(`${field} is invalid`);
    }
    return value;
}

function unit(value: ProductUnit): ProductUnit {
    if (value !== "متر مربع" && value !== "قطعة") {
        throw new SalesMappingError("Invoice item unit is invalid");
    }
    return value;
}

function currency(value: Currency): Currency {
    if (value !== "IQD" && value !== "USD") throw new SalesMappingError("Currency is invalid");
    return value;
}

function status(value: SaleInvoiceStatus): SaleInvoiceStatus {
    if (value !== "draft" && value !== "completed" && value !== "cancelled") {
        throw new SalesMappingError("Invoice status is invalid");
    }
    return value;
}

function requestAmount(value: number, field: string, positive = false): string {
    if (!Number.isFinite(value) || value < (positive ? Number.MIN_VALUE : 0)) {
        throw new SalesMappingError(`${field} is invalid`);
    }
    return String(value);
}

function itemInputToDto(item: SaleDraftItemInput): SaleDraftItemRequestDto {
    if (!Number.isSafeInteger(item.productId) || item.productId <= 0) {
        throw new SalesMappingError("Product id is invalid");
    }
    if (item.unit === "قطعة" && !Number.isInteger(item.quantity)) {
        throw new SalesMappingError("Piece quantity must be a whole number");
    }
    return {
        productId: item.productId,
        quantity: requestAmount(item.quantity, "quantity", true),
        unitPrice: requestAmount(item.unitPrice, "unitPrice", true),
    };
}

export function saleInvoiceItemDtoToDomain(dto: SaleInvoiceItemDto): SaleInvoiceItemRecord {
    const itemUnit = unit(dto.unit);
    const quantity = decimal(dto.quantity, "quantity");
    if (itemUnit === "قطعة" && !Number.isInteger(quantity)) {
        throw new SalesMappingError("Piece quantity must be a whole number");
    }
    return {
        id: safeId(dto.id, "Item id"),
        invoiceId: safeId(dto.invoiceId, "Invoice id"),
        productId: safeId(dto.productId, "Product id"),
        productCodeSnapshot: dto.productCodeSnapshot.trim(),
        productNameSnapshot: dto.productNameSnapshot.trim(),
        unit: itemUnit,
        quantity,
        unitPrice: decimal(dto.unitPrice, "unitPrice"),
        total: decimal(dto.total, "item total"),
        apiCreatedAt: date(dto.createdAt, "item createdAt"),
    };
}

export function saleInvoiceListItemDtoToDomain(
    dto: SaleInvoiceListItemDto,
): SaleInvoiceListRecord {
    if (dto.customerId !== null) safeId(dto.customerId, "Customer id");
    return {
        id: safeId(dto.id, "Invoice id"),
        invoiceNumber: dto.invoiceNumber.trim(),
        customerId: dto.customerId,
        customerNameSnapshot: dto.customerNameSnapshot.trim(),
        currency: currency(dto.currency),
        status: status(dto.status),
        subtotal: decimal(dto.subtotal, "subtotal"),
        discount: decimal(dto.discount, "discount"),
        total: decimal(dto.total, "total"),
        paidAmount: decimal(dto.paidAmount, "paidAmount"),
        remainingAmount: decimal(dto.remainingAmount, "remainingAmount", true),
        itemCount: count(dto.itemCount, "itemCount"),
        createdAt: date(dto.createdAt, "createdAt"),
        updatedAt: date(dto.updatedAt, "updatedAt"),
    };
}

export function saleInvoiceDtoToDomain(dto: SaleInvoiceDto): SaleInvoiceRecord {
    const base = saleInvoiceListItemDtoToDomain(dto);
    if (dto.completionTransactionId !== null) safeId(dto.completionTransactionId, "Completion transaction id");
    if (dto.reversedCustomerTransactionId !== null) safeId(dto.reversedCustomerTransactionId, "Reversed transaction id");
    return {
        ...base,
        note: dto.note.trim(),
        completedAt: dto.completedAt === null ? null : date(dto.completedAt, "completedAt"),
        completionTransactionId: dto.completionTransactionId,
        stockMovementIds: [],
        cancelledAt: dto.cancelledAt === null ? null : date(dto.cancelledAt, "cancelledAt"),
        cancellationReason: dto.cancellationReason.trim(),
        reversalStockMovementIds: [],
        reversedCustomerTransactionId: dto.reversedCustomerTransactionId,
        items: dto.items.map(saleInvoiceItemDtoToDomain),
        completionAudit: {
            sourceReference: dto.completionAudit.sourceReference.trim(),
            stockMovementCount: count(dto.completionAudit.stockMovementCount, "stockMovementCount"),
            reversalMovementCount: count(dto.completionAudit.reversalMovementCount, "reversalMovementCount"),
            customerTransactionCreated: dto.completionAudit.customerTransactionCreated,
            customerTransactionVoided: dto.completionAudit.customerTransactionVoided,
        },
    };
}

export function draftCreateInputToDto(input: SaleDraftInput): SaleDraftCreateRequestDto {
    const validated = validateSaleDraft(input);
    return {
        customerId: validated.customerId,
        currency: currency(validated.currency),
        discount: requestAmount(validated.discount, "discount"),
        paidAmount: requestAmount(validated.paidAmount, "paidAmount"),
        note: validated.note.trim(),
        items: validated.items.map(itemInputToDto),
    };
}

export function draftUpdateInputToDto(input: SaleDraftUpdateInput): SaleDraftUpdateRequestDto {
    const dto: SaleDraftUpdateRequestDto = {};
    if (input.customerId !== undefined) dto.customerId = input.customerId;
    if (input.currency !== undefined) dto.currency = currency(input.currency);
    if (input.discount !== undefined) dto.discount = requestAmount(input.discount, "discount");
    if (input.paidAmount !== undefined) dto.paidAmount = requestAmount(input.paidAmount, "paidAmount");
    if (input.note !== undefined) dto.note = input.note.trim();
    if (input.items !== undefined) {
        if (input.items.length === 0) throw new SalesMappingError("At least one invoice item is required");
        dto.items = mergeSaleDraftItems(input.items).map(itemInputToDto);
    }
    return dto;
}

export function cancellationInputToDto(reasonInput: string): SaleCancellationRequestDto {
    const reason = reasonInput.trim();
    if (!reason) throw new SalesMappingError("Cancellation reason is required");
    return { reason };
}

export function salesSummaryDtoToDomain(dto: SalesSummaryDto): SalesSummary {
    return {
        currency: currency(dto.currency),
        totalInvoiceCount: count(dto.totalInvoiceCount, "totalInvoiceCount"),
        draftInvoiceCount: count(dto.draftInvoiceCount, "draftInvoiceCount"),
        completedInvoiceCount: count(dto.completedInvoiceCount, "completedInvoiceCount"),
        cancelledInvoiceCount: count(dto.cancelledInvoiceCount, "cancelledInvoiceCount"),
        completedSalesTotal: decimal(dto.completedSalesTotal, "completedSalesTotal"),
        positiveRemainingTotal: decimal(dto.positiveRemainingTotal, "positiveRemainingTotal"),
    };
}
