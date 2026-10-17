from pydantic import BaseModel, EmailStr
from typing import Literal

RoleType = Literal["admin", "doctor", "nurse", "pharmacist", "receptionist", "patient"]

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: RoleType = "patient"

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
