from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base

class EHR(Base):
    __tablename__ = "ehrs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), unique=True, index=True, nullable=False)
    hospital_id = Column(String, index=True, nullable=True)
    medical_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    blood_group = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ClinicalRecord(Base):
    __tablename__ = "clinical_records"

    id = Column(Integer, primary_key=True, index=True)
    ehr_id = Column(Integer, ForeignKey("ehrs.id"), index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True, nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    doctor_name = Column(String, nullable=True)
    record_type = Column(String, default="consultation")  # consultation, diagnosis, vital_signs, doctor_note, lab_report
    title = Column(String, nullable=True)
    details = Column(Text, nullable=False)
    vitals_json = Column(Text, nullable=True)  # JSON-encoded dict for BP, HR, Temp, SpO2, Weight
    ai_compatible_payload = Column(Text, nullable=True)  # JSON-encoded payload reserved for future AI agents
    created_at = Column(DateTime, default=datetime.utcnow)
