from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base

class PersonaAssessment(Base):
    __tablename__ = "persona_assessments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True, nullable=False)
    hospital_id = Column(String, index=True, nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), index=True, nullable=True)
    persona_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    persona_name = Column(String, nullable=True)
    symptoms = Column(Text, nullable=False)
    symptom_duration = Column(String, nullable=True)
    severity = Column(String, nullable=True)  # mild, moderate, severe
    temperature = Column(Float, nullable=True)  # °F
    blood_pressure = Column(String, nullable=True)  # e.g. 120/80
    heart_rate = Column(Integer, nullable=True)  # bpm
    spo2 = Column(Float, nullable=True)  # %
    additional_notes = Column(Text, nullable=True)
    
    priority = Column(String, nullable=False, default="NORMAL", index=True)  # NORMAL, HIGH, EMERGENCY
    priority_reason = Column(Text, nullable=True)
    
    status = Column(String, nullable=False, default="WAITING", index=True)  # WAITING, ASSESSED, ESCALATED, REFERRED, COMPLETED
    escalation_reason = Column(Text, nullable=True)
    
    doctor_review_status = Column(String, nullable=False, default="PENDING", index=True)  # PENDING, REVIEWED, APPROVED, REJECTED
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    doctor_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
