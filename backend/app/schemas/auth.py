from pydantic import BaseModel, ConfigDict, Field
class LoginRequest(BaseModel):
    username: str = Field(min_length=1,max_length=100)
    password: str = Field(min_length=1,max_length=1024)
class AdminRead(BaseModel):
    username: str
    model_config=ConfigDict(extra="forbid")
class CsrfRead(BaseModel):
    csrf_token: str = Field(serialization_alias="csrfToken")
    model_config=ConfigDict(populate_by_name=True)
