import hmac
from fastapi import Request
from app.core.config import get_settings
from app.core.errors import APIError
from app.services.auth_service import decode_session
def current_admin(request:Request)->dict[str,object]:
    token=request.cookies.get(get_settings().AUTH_COOKIE_NAME)
    if not token:raise APIError(401,"not_authenticated","Authentication required")
    return decode_session(token)
def require_csrf(request:Request)->None:
    if request.method in {"GET","HEAD","OPTIONS"}:return
    payload=current_admin(request);expected=payload.get("csrf");provided=request.headers.get("X-CSRF-Token")
    if not isinstance(expected,str) or not provided or not hmac.compare_digest(expected,provided):raise APIError(403,"csrf_invalid","CSRF token is missing or invalid")
