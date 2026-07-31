import type {
    CustomerBalanceRecord,
    CustomerInput,
    CustomerRecord,
    CustomerTransactionCorrectionInput,
    CustomerTransactionInput,
    CustomerTransactionRecord,
    CustomerUpdateInput,
} from "../../types/customer";
import type {
    ApiCurrency,
    ApiTransactionSourceType,
    ApiTransactionStatus,
    ApiTransactionType,
    CustomerBalanceDto,
    CustomerCreateDto,
    CustomerDto,
    CustomerTransactionCorrectionDto,
    CustomerTransactionCreateDto,
    CustomerTransactionDto,
    CustomerTransactionVoidDto,
    CustomerUpdateDto,
} from "./customerApiTypes";

const UNSIGNED_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SIGNED_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class CustomerMappingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CustomerMappingError";
    }
}

function validId(value: number, field: string, nullable = false): number {
    if (!Number.isSafeInteger(value) || value < (nullable ? 0 : 1)) {
        throw new CustomerMappingError(`${field} is invalid`);
    }
    return value;
}

function date(value: string, field: string): string {
    if (!Number.isFinite(Date.parse(value))) {
        throw new CustomerMappingError(`${field} is invalid`);
    }
    return value;
}

function decimal(value: string, field: string, signed = false): number {
    if (!(signed ? SIGNED_DECIMAL : UNSIGNED_DECIMAL).test(value)) {
        throw new CustomerMappingError(`${field} is not a valid decimal string`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new CustomerMappingError(`${field} is outside the supported numeric range`);
    }
    return parsed;
}

function positiveAmount(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
        throw new CustomerMappingError("Transaction amount must be greater than zero");
    }
    return String(value);
}

function requiredText(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new CustomerMappingError(`${field} is required`);
    return trimmed;
}

function optionalText(value: string): string {
    return value.trim();
}

function transactionType(value: ApiTransactionType): ApiTransactionType {
    if (!["debt", "credit", "payment_received", "payment_paid"].includes(value)) {
        throw new CustomerMappingError("Transaction type is invalid");
    }
    return value;
}

function currency(value: ApiCurrency): ApiCurrency {
    if (value !== "IQD" && value !== "USD") {
        throw new CustomerMappingError("Currency is invalid");
    }
    return value;
}

function status(value: ApiTransactionStatus): ApiTransactionStatus {
    if (value !== "active" && value !== "voided") {
        throw new CustomerMappingError("Transaction status is invalid");
    }
    return value;
}

function sourceType(value: ApiTransactionSourceType): ApiTransactionSourceType {
    if (value !== "manual" && value !== "sale_invoice") {
        throw new CustomerMappingError("Transaction source is invalid");
    }
    return value;
}

export function customerDtoToDomain(dto: CustomerDto): CustomerRecord {
    validId(dto.id, "Customer id");
    return {
        id: dto.id,
        name: requiredText(dto.name, "Customer name"),
        phone: optionalText(dto.phone),
        address: optionalText(dto.address),
        notes: optionalText(dto.notes),
        createdAt: date(dto.createdAt, "createdAt"),
        lastPaymentAt:
            dto.lastPaymentAt === null ? null : date(dto.lastPaymentAt, "lastPaymentAt"),
        apiMetadata: { updatedAt: date(dto.updatedAt, "updatedAt") },
        ...(dto.balances === null
            ? {}
            : { apiBalance: customerBalanceDtoToDomain(dto.balances) }),
    };
}

export function customerCreateToDto(input: CustomerInput): CustomerCreateDto {
    return {
        name: requiredText(input.name, "Customer name"),
        phone: optionalText(input.phone),
        address: optionalText(input.address),
        notes: optionalText(input.notes),
    };
}

export function customerUpdateToDto(input: CustomerUpdateInput): CustomerUpdateDto {
    const dto: CustomerUpdateDto = {};
    if (input.name !== undefined) dto.name = requiredText(input.name, "Customer name");
    if (input.phone !== undefined) dto.phone = optionalText(input.phone);
    if (input.address !== undefined) dto.address = optionalText(input.address);
    if (input.notes !== undefined) dto.notes = optionalText(input.notes);
    return dto;
}

export function customerBalanceDtoToDomain(dto: CustomerBalanceDto): CustomerBalanceRecord {
    validId(dto.customerId, "Customer id");
    const validStatuses = ["owes_store", "store_owes", "settled"];
    if (!validStatuses.includes(dto.IQD.status) || !validStatuses.includes(dto.USD.status)) {
        throw new CustomerMappingError("Balance status is invalid");
    }
    return {
        customerId: dto.customerId,
        balances: {
            IQD: decimal(dto.IQD.balance, "IQD balance", true),
            USD: decimal(dto.USD.balance, "USD balance", true),
        },
        statuses: { IQD: dto.IQD.status, USD: dto.USD.status },
    };
}

export function customerTransactionDtoToDomain(
    dto: CustomerTransactionDto,
): CustomerTransactionRecord {
    validId(dto.id, "Transaction id");
    validId(dto.customerId, "Customer id");
    if (dto.correctedTransactionId !== null) validId(dto.correctedTransactionId, "Correction id");
    if (dto.sourceId !== null) validId(dto.sourceId, "Source id");
    const mappedCurrency = currency(dto.currency);
    return {
        id: dto.id,
        customerId: dto.customerId,
        type: transactionType(dto.transactionType),
        amount: decimal(dto.amount, "amount"),
        currency: mappedCurrency,
        note: optionalText(dto.note),
        createdAt: date(dto.createdAt, "createdAt"),
        recordedAt: date(dto.recordedAt, "recordedAt"),
        balanceAfter: { IQD: 0, USD: 0 },
        status: status(dto.status),
        correctedTransactionId: dto.correctedTransactionId,
        voidedAt: dto.voidedAt === null ? null : date(dto.voidedAt, "voidedAt"),
        voidReason: optionalText(dto.voidReason),
        createdByCorrection: dto.createdByCorrection,
        sourceType: sourceType(dto.sourceType),
        sourceId: dto.sourceId,
        sourceReference: optionalText(dto.sourceReference),
        apiMetadata: {
            updatedAt: date(dto.updatedAt, "updatedAt"),
            effectAmount: decimal(dto.effectAmount, "effectAmount", true),
            runningBalance:
                dto.runningBalance === null
                    ? null
                    : decimal(dto.runningBalance, "runningBalance", true),
        },
    };
}

export function transactionCreateToDto(
    input: Omit<CustomerTransactionInput, "customerId">,
): CustomerTransactionCreateDto {
    return {
        transactionType: transactionType(input.type as ApiTransactionType),
        amount: positiveAmount(input.amount),
        currency: currency(input.currency),
        note: optionalText(input.note),
    };
}

export function transactionCorrectionToDto(
    input: Omit<CustomerTransactionCorrectionInput, "transactionId">,
): CustomerTransactionCorrectionDto {
    return {
        transactionType: transactionType(input.type),
        amount: positiveAmount(input.amount),
        note: optionalText(input.note),
        reason: requiredText(input.reason, "Correction reason"),
    };
}

export function transactionVoidToDto(reason: string): CustomerTransactionVoidDto {
    return { reason: requiredText(reason, "Void reason") };
}
