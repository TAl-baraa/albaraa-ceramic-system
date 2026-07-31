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
