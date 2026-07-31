from datetime import datetime,timedelta,timezone
import hmac,secrets,time
import jwt
from pwdlib import PasswordHash
from app.core.config import get_settings
from app.core.errors import APIError

password_hash=PasswordHash.recommended()
_attempts:dict[str,list[float]]={}
def invalid_credentials()->APIError:return APIError(401,"invalid_credentials","Invalid username or password")
def check_throttle(key:str)->None:
    now=time.monotonic();attempts=[v for v in _attempts.get(key,[]) if now-v<60];_attempts[key]=attempts
    if len(attempts)>=5:raise APIError(429,"login_throttled","Too many login attempts. Please try again later.")
def authenticate(username:str,password:str,key:str)->None:
    settings=get_settings();check_throttle(key)
    valid_name=hmac.compare_digest(username,settings.ADMIN_USERNAME)
    try:valid_password=bool(settings.ADMIN_PASSWORD_HASH) and password_hash.verify(password,settings.ADMIN_PASSWORD_HASH)
    except Exception:valid_password=False
    if not(valid_name and valid_password):_attempts[key].append(time.monotonic());raise invalid_credentials()
    _attempts.pop(key,None)
def create_session(username:str)->tuple[str,str]:
    settings=get_settings();csrf=secrets.token_urlsafe(32);now=datetime.now(timezone.utc)
    token=jwt.encode({"sub":username,"csrf":csrf,"iat":now,"exp":now+timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)},settings.AUTH_SECRET_KEY,algorithm="HS256")
    return token,csrf
def decode_session(token:str)->dict[str,object]:
    try:
        payload=jwt.decode(token,get_settings().AUTH_SECRET_KEY,algorithms=["HS256"])
        if payload.get("sub")!=get_settings().ADMIN_USERNAME:raise ValueError
        return payload
    except Exception as exc:raise APIError(401,"not_authenticated","Authentication required") from exc
