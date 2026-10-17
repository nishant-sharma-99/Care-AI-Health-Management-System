from pydantic import BaseModel
from typing import Optional
from datetime import date

class PatientCreate(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None
    user_id: Optional[int] = None
    hospital_id: Optional[str] = None

class PatientOut(PatientCreate):
    id: int
    hospital_id: Optional[str] = None
    qr_code: Optional[str] = None
    model_config = {"from_attributes": True}

class DoctorCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    contact: Optional[str] = None

class DoctorOut(DoctorCreate):
    id: int
    model_config = {"from_attributes": True}

class AppointmentCreate(BaseModel):
    patient_id: Optional[int] = None
    doctor_id: int
    date: date
    time: str
    notes: Optional[str] = None

class AppointmentOut(AppointmentCreate):
    id: int
    status: str
    model_config = {"from_attributes": True}
