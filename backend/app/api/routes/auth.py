from fastapi import APIRouter,Depends,Request,Response
from app.api.dependencies.auth import current_admin,require_csrf
from app.core.config import get_settings
from app.schemas.auth import AdminRead,CsrfRead,LoginRequest
from app.services.auth_service import authenticate,create_session
router=APIRouter(prefix="/auth",tags=["auth"])
@router.post("/login",response_model=AdminRead)
def login(body:LoginRequest,request:Request,response:Response)->AdminRead:
    authenticate(body.username,body.password,request.client.host if request.client else "unknown");token,_=create_session(body.username);settings=get_settings();response.set_cookie(settings.AUTH_COOKIE_NAME,token,max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES*60,httponly=True,secure=settings.AUTH_COOKIE_SECURE,samesite="lax",path="/");return AdminRead(username=settings.ADMIN_USERNAME)
@router.get("/me",response_model=AdminRead)
def me(payload:dict[str,object]=Depends(current_admin))->AdminRead:return AdminRead(username=str(payload["sub"]))
@router.get("/csrf",response_model=CsrfRead)
def csrf(payload:dict[str,object]=Depends(current_admin))->CsrfRead:return CsrfRead(csrf_token=str(payload["csrf"]))
@router.post("/logout",status_code=204,dependencies=[Depends(require_csrf)])
def logout(response:Response)->None:response.delete_cookie(get_settings().AUTH_COOKIE_NAME,path="/")
