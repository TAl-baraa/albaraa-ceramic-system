from fastapi import APIRouter, Depends
from app.api.dependencies.auth import current_admin, require_csrf
from app.api.routes.auth import router as auth_router

from app.api.routes.customers import router as customers_router
from app.api.routes.health import router as health_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.products import router as products_router
from app.api.routes.sales import router as sales_router, summary_router as sales_summary_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
protected = APIRouter(dependencies=[Depends(current_admin), Depends(require_csrf)])
protected.include_router(products_router)
protected.include_router(customers_router)
protected.include_router(inventory_router)
protected.include_router(sales_router)
protected.include_router(sales_summary_router)
api_router.include_router(protected)
