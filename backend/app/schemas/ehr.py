from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ClinicalRecordCreate(BaseModel):
    record_type: Optional[str] = "consultation"  # consultation, diagnosis, vital_signs, doctor_note, lab_report
    title: Optional[str] = None
    details: str
    vitals_json: Optional[str] = None
    ai_compatible_payload: Optional[str] = None
    doctor_id: Optional[int] = None

class ClinicalRecordOut(BaseModel):
    id: int
    ehr_id: int
    patient_id: int
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    record_type: str
    title: Optional[str] = None
    details: str
    vitals_json: Optional[str] = None
    ai_compatible_payload: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class EHRUpdate(BaseModel):
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    blood_group: Optional[str] = None

class EHROut(BaseModel):
    id: int
    patient_id: int
    hospital_id: Optional[str] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    blood_group: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    records: List[ClinicalRecordOut] = []

    class Config:
        from_attributes = True

class EHRPharmacistOut(BaseModel):
    id: int
    patient_id: int
    hospital_id: Optional[str] = None
    patient_name: str
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    blood_group: Optional[str] = None
    prescriptions: List[dict] = []

    class Config:
        from_attributes = True
