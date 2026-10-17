from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime
from app.core.database import Base

class LabTestOrder(Base):
    __tablename__ = "lab_test_orders"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(String, unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    hospital_id = Column(String, index=True, nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    doctor_name = Column(String, nullable=True)
    test_name = Column(String, nullable=False)
    test_category = Column(String, nullable=False)
    clinical_notes = Column(Text, nullable=True)
    priority = Column(String, default="NORMAL")  # NORMAL, URGENT
    status = Column(String, default="ORDERED")   # ORDERED, SAMPLE_COLLECTED, PROCESSING, AWAITING_VERIFICATION, COMPLETED, CANCELLED
    sample_collected_at = Column(DateTime, nullable=True)
    collected_by_technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ordered_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LabReport(Base):
    __tablename__ = "lab_reports"

    id = Column(Integer, primary_key=True, index=True)
    lab_order_id = Column(Integer, ForeignKey("lab_test_orders.id"), nullable=False, index=True)
    sample_id = Column(String, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    hospital_id = Column(String, index=True, nullable=False)
    test_name = Column(String, nullable=False)
    test_category = Column(String, nullable=False)
    result_summary = Column(Text, nullable=True)
    result_data_json = Column(Text, nullable=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    technician_name = Column(String, nullable=False)
    verified_by_doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    verified_by_doctor_name = Column(String, nullable=True)
    verification_status = Column(String, default="PENDING")  # PENDING, VERIFIED, REJECTED
    verification_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    report_status = Column(String, default="DRAFT")  # DRAFT, AWAITING_VERIFICATION, VERIFIED, REJECTED
    has_critical_result = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LabResultParameter(Base):
    __tablename__ = "lab_result_parameters"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("lab_reports.id"), nullable=False, index=True)
    parameter_name = Column(String, nullable=False)
    result_value = Column(String, nullable=False)
    unit = Column(String, nullable=True)
    reference_range = Column(String, nullable=True)
    flag = Column(String, default="NORMAL")  # NORMAL, HIGH, LOW, CRITICAL
