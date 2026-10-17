from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PersonaAssessmentCreate(BaseModel):
    patient_id: int
    hospital_id: Optional[str] = None
    appointment_id: Optional[int] = None
    symptoms: str
    symptom_duration: Optional[str] = None
    severity: Optional[str] = "moderate"  # mild, moderate, severe
    temperature: Optional[float] = None  # in °F
    blood_pressure: Optional[str] = None  # e.g. "120/80"
    heart_rate: Optional[int] = None  # bpm
    spo2: Optional[float] = None  # %
    additional_notes: Optional[str] = None

class PersonaAssessmentUpdate(BaseModel):
    symptoms: Optional[str] = None
    symptom_duration: Optional[str] = None
    severity: Optional[str] = None
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[float] = None
    additional_notes: Optional[str] = None
    status: Optional[str] = None  # WAITING, ASSESSED, ESCALATED, REFERRED, COMPLETED
    escalation_reason: Optional[str] = None

class PersonaDoctorReview(BaseModel):
    doctor_review_status: str  # REVIEWED, APPROVED, REJECTED
    doctor_notes: Optional[str] = None
    status: Optional[str] = None  # ASSESSED, ESCALATED, COMPLETED
    append_to_ehr: Optional[bool] = False  # If True, appends clinical record to EHR

class PersonaAssessmentOut(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    hospital_id: Optional[str] = None
    appointment_id: Optional[int] = None
    persona_user_id: int
    persona_name: Optional[str] = None
    symptoms: str
    symptom_duration: Optional[str] = None
    severity: Optional[str] = None
    temperature: Optional[float] = None
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[float] = None
    additional_notes: Optional[str] = None
    priority: str
    priority_reason: Optional[str] = None
    status: str
    escalation_reason: Optional[str] = None
    doctor_review_status: str
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    doctor_notes: Optional[str] = None
    disclaimer: str = "Priority is an initial triage/queue recommendation and does not constitute a medical diagnosis."
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PriorityQueueItemOut(BaseModel):
    position: int
    appointment_id: Optional[int] = None
    patient_id: int
    hospital_id: Optional[str] = None
    patient_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    priority: str  # EMERGENCY, HIGH, NORMAL, UNASSESSED
    priority_reason: Optional[str] = None
    assessment_id: Optional[int] = None
    assessment_status: Optional[str] = None
    doctor_review_status: Optional[str] = None
    waiting_time_minutes: int = 0
    created_at: datetime
