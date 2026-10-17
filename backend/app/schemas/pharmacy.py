from pydantic import BaseModel
from typing import Optional
from datetime import date

class DrugCreate(BaseModel):
    name: str
    quantity: int = 0
    unit_price: float = 0.0
    expiry_date: Optional[date] = None

class DrugOut(DrugCreate):
    id: int
    model_config = {"from_attributes": True}

class PrescriptionCreate(BaseModel):
    patient_id: int
    doctor_id: int
    drug_id: int
    dosage: Optional[str] = None
    instructions: Optional[str] = None

class PrescriptionOut(PrescriptionCreate):
    id: int
    dispensed: int
    model_config = {"from_attributes": True}

class InvoiceCreate(BaseModel):
    patient_id: int
    amount: float
    description: Optional[str] = None

class InvoiceOut(InvoiceCreate):
    id: int
    status: str
    stripe_payment_intent: Optional[str] = None
    model_config = {"from_attributes": True}
