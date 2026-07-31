from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(
        self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class ProductNotFoundError(APIError):
    def __init__(self) -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "product_not_found", "Product not found")


class DuplicateProductCodeError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "duplicate_product_code",
            "A product with this code already exists",
        )


class ProductValidationError(APIError):
    def __init__(self, message: str = "Product data is invalid") -> None:
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            message,
        )


class CustomerNotFoundError(APIError):
    def __init__(self) -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "customer_not_found", "Customer not found")


class DuplicateCustomerPhoneError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "duplicate_customer_phone",
            "A customer with this phone number already exists",
        )


class CustomerHasTransactionsError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "customer_has_transactions",
            "A customer with financial transactions cannot be deleted",
        )


class CustomerTransactionNotFoundError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_404_NOT_FOUND,
            "transaction_not_found",
            "Customer transaction not found",
        )


class TransactionCustomerMismatchError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "transaction_customer_mismatch",
            "Transaction belongs to another customer",
        )


class TransactionAlreadyVoidedError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "transaction_already_voided",
            "Transaction is already voided",
        )


class SourceLinkedTransactionProtectedError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "source_linked_transaction_protected",
            "Invoice-linked transactions must be changed through the sales workflow.",
        )


class InvalidDateRangeError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_date_range",
            "dateFrom must be earlier than or equal to dateTo",
        )


class CustomerTransactionPersistenceError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "transaction_conflict",
            "The customer transaction could not be saved",
        )


class StockMovementNotFoundError(APIError):
    def __init__(self) -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, "stock_movement_not_found", "Stock movement not found")


class InvalidPieceQuantityError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_piece_quantity",
            "Quantities for products measured in pieces must be whole numbers",
        )


class InsufficientStockError(APIError):
    def __init__(self, *, product_id: int, code: str, requested: Any, available: Any, unit: str) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "insufficient_stock",
            "Requested stock exceeds the available quantity",
            {
                "productId": product_id,
                "productCode": code,
                "requestedQuantity": str(requested),
                "availableQuantity": str(available),
                "unit": unit,
            },
        )


class NoOpStockAdjustmentError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "no_op_stock_adjustment",
            "Adjustment final quantity must differ from current quantity",
        )


class UnsupportedStockSourceError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "unsupported_stock_source",
            "Unsupported stock movement source type",
        )


class ProductQuantityUpdateBlockedError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "product_quantity_update_blocked",
            "Product quantity must be changed through the inventory movement API.",
        )


class ProductHasStockMovementsError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "product_has_stock_movements",
            "A product with stock movement history cannot be deleted",
        )


class StockMovementPersistenceError(APIError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_409_CONFLICT,
            "stock_movement_conflict",
            "The stock movement could not be saved",
        )


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    error: dict[str, Any] = {"code": exc.code, "message": exc.message}
    if exc.details is not None:
        error["details"] = exc.details
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": error},
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details: list[dict[str, Any]] = []
    for error in exc.errors():
        details.append(
            {
                "field": ".".join(str(part) for part in error["loc"] if part != "body"),
                "message": error["msg"],
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": details,
            }
        },
    )
