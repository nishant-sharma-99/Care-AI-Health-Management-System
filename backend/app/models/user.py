from sqlalchemy import Column, Integer, String
from app.core.database import Base

ROLES = ("admin", "doctor", "nurse", "pharmacist", "receptionist", "patient", "persona", "lab_technician")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="patient")
