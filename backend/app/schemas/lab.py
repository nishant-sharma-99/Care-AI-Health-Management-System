from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class LabParameterSchema(BaseModel):
    parameter_name: str
    result_value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    flag: str = "NORMAL"  # NORMAL, HIGH, LOW, CRITICAL

class LabOrderCreate(BaseModel):
    patient_id: int
    test_name: str
    test_category: str
    clinical_notes: Optional[str] = None
    priority: str = "NORMAL"  # NORMAL, URGENT
    appointment_id: Optional[int] = None
    doctor_id: Optional[int] = None

class LabOrderStatusUpdate(BaseModel):
    status: str  # SAMPLE_COLLECTED, PROCESSING, CANCELLED

class LabReportCreate(BaseModel):
    result_summary: Optional[str] = None
    parameters: List[LabParameterSchema] = []
    report_status: str = "AWAITING_VERIFICATION"  # DRAFT or AWAITING_VERIFICATION

class LabReportVerify(BaseModel):
    approved: bool
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class LabOrderOut(BaseModel):
    id: int
    sample_id: str
    patient_id: int
    patient_name: Optional[str] = None
    hospital_id: str
    appointment_id: Optional[int] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    test_name: str
    test_category: str
    clinical_notes: Optional[str] = None
    priority: str
    status: str
    sample_collected_at: Optional[datetime] = None
    collected_by_technician_id: Optional[int] = None
    ordered_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LabReportOut(BaseModel):
    id: int
    lab_order_id: int
    sample_id: str
    patient_id: int
    patient_name: Optional[str] = None
    hospital_id: str
    test_name: str
    test_category: str
    result_summary: Optional[str] = None
    result_data_json: Optional[str] = None
    parameters: List[LabParameterSchema] = []
    technician_id: int
    technician_name: str
    verified_by_doctor_id: Optional[int] = None
    verified_by_doctor_name: Optional[str] = None
    verification_status: str
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    report_status: str
    has_critical_result: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
