import type {
    ProductCreateInput,
    ProductRecord,
    ProductUnit,
    ProductUpdateInput,
} from "../../types/product";
import type {
    ProductCreateDto,
    ProductDto,
    ProductUpdateDto,
} from "./productApiTypes";

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class ProductMappingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProductMappingError";
    }
}

function parseDecimal(value: string, field: string): number {
    if (!DECIMAL_PATTERN.test(value)) {
        throw new ProductMappingError(`${field} is not a valid decimal string`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new ProductMappingError(`${field} is outside the supported numeric range`);
    }
    return parsed;
}

function validateUnit(unit: ProductUnit): ProductUnit {
    if (unit !== "متر مربع" && unit !== "قطعة") {
        throw new ProductMappingError("Product unit is not supported");
    }
    return unit;
}

function finiteNumber(value: number, field: string): string {
    if (!Number.isFinite(value) || value < 0) {
        throw new ProductMappingError(`${field} must be a finite nonnegative number`);
    }
    return String(value);
}

function iqdNumber(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new ProductMappingError("sellPriceIqd must be a nonnegative safe integer");
    }
    return String(value);
}

function text(value: string): string {
    return value.trim();
}

export function productDtoToDomain(dto: ProductDto): ProductRecord {
    if (!Number.isSafeInteger(dto.id) || dto.id <= 0) {
        throw new ProductMappingError("Product id is invalid");
    }
    const sellPriceIqd = parseDecimal(dto.sellPriceIqd, "sellPriceIqd");
    if (!Number.isSafeInteger(sellPriceIqd)) {
        throw new ProductMappingError("sellPriceIqd is outside the safe integer range");
    }
    return {
        id: dto.id,
        code: dto.code.trim(),
        name: dto.name.trim(),
        size: dto.size.trim(),
        company: dto.company.trim(),
        unit: validateUnit(dto.unit),
        quantity: parseDecimal(dto.quantity, "quantity"),
        minimumQuantity: parseDecimal(dto.minimumQuantity, "minimumQuantity"),
        sellPriceIqd,
        purchasePriceUsd: parseDecimal(dto.purchasePriceUsd, "purchasePriceUsd"),
        apiMetadata: {
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
        },
    };
}

export function productCreateToDto(input: ProductCreateInput): ProductCreateDto {
    return {
        code: text(input.code),
        name: text(input.name),
        size: text(input.size),
        company: text(input.company),
        unit: validateUnit(input.unit),
        quantity: finiteNumber(input.quantity, "quantity"),
        minimumQuantity: finiteNumber(input.minimumQuantity, "minimumQuantity"),
        sellPriceIqd: iqdNumber(input.sellPriceIqd),
        purchasePriceUsd: finiteNumber(input.purchasePriceUsd, "purchasePriceUsd"),
    };
}

export function productUpdateToDto(input: ProductUpdateInput): ProductUpdateDto {
    if (Object.hasOwn(input, "quantity")) {
        throw new ProductMappingError(
            "Product quantity must be changed through the inventory movement API",
        );
    }
    const dto: ProductUpdateDto = {};
    if (input.code !== undefined) dto.code = text(input.code);
    if (input.name !== undefined) dto.name = text(input.name);
    if (input.size !== undefined) dto.size = text(input.size);
    if (input.company !== undefined) dto.company = text(input.company);
    if (input.unit !== undefined) dto.unit = validateUnit(input.unit);
    if (input.minimumQuantity !== undefined) {
        dto.minimumQuantity = finiteNumber(input.minimumQuantity, "minimumQuantity");
    }
    if (input.sellPriceIqd !== undefined) dto.sellPriceIqd = iqdNumber(input.sellPriceIqd);
    if (input.purchasePriceUsd !== undefined) {
        dto.purchasePriceUsd = finiteNumber(input.purchasePriceUsd, "purchasePriceUsd");
    }
    return dto;
}
