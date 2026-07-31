from fastapi import APIRouter

from app.api.routes.customers import router as customers_router
from app.api.routes.health import router as health_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.products import router as products_router
from app.api.routes.sales import router as sales_router, summary_router as sales_summary_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(products_router)
api_router.include_router(customers_router)
api_router.include_router(inventory_router)
api_router.include_router(sales_router)
api_router.include_router(sales_summary_router)
