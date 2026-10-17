from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Text
from app.core.database import Base

class Drug(Base):
    __tablename__ = "drugs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0.0)
    expiry_date = Column(Date)

class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    dosage = Column(String)
    instructions = Column(Text)
    dispensed = Column(Integer, default=0)  # 0=pending, 1=dispensed
