from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import APIError, api_error_handler, validation_error_handler

settings = get_settings()

app = FastAPI(title=settings.APP_NAME, version="0.1.0")
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["root"])
def root() -> dict[str, str]:
    return {"name": settings.APP_NAME, "status": "running"}
