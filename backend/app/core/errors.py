from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


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


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
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
