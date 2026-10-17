import io
import base64
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.patient import Patient, Doctor, Appointment
from app.schemas.patient import PatientCreate, PatientOut, DoctorCreate, DoctorOut, AppointmentCreate, AppointmentOut

router = APIRouter(tags=["patients"])

def generate_qr_code(data: str) -> str:
    """
    Generates a secure QR code encoding ONLY the Hospital ID / patient identifier.
    Does NOT include sensitive medical history, diagnoses, or prescriptions.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

def generate_next_hospital_id(db: Session) -> str:
    """
    Generates the next sequential unique Hospital ID (e.g. MED000001, MED000002).
    """
    patients_with_hid = db.query(Patient.hospital_id).filter(Patient.hospital_id.isnot(None)).all()
    max_num = 0
    for (hid,) in patients_with_hid:
        if hid and hid.startswith("MED"):
            try:
                num = int(hid[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    next_num = max_num + 1
    return f"MED{next_num:06d}"

def ensure_patient_identity(patient: Patient, db: Session) -> Patient:
    """
    Ensures that legacy or existing patient records have a valid Hospital ID and QR code.
    """
    updated = False
    if not patient.hospital_id:
        patient.hospital_id = generate_next_hospital_id(db)
        updated = True
    if not patient.qr_code or not patient.qr_code.startswith("data:image"):
        patient.qr_code = generate_qr_code(patient.hospital_id)
        updated = True
    if updated:
        db.add(patient)
        db.commit()
        db.refresh(patient)
    return patient

# --- Patients ---
@router.post("/patients", response_model=PatientOut)
def create_patient(data: PatientCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "receptionist", "doctor", "nurse"))):
    payload = data.model_dump()
    hospital_id = payload.get("hospital_id")
    if not hospital_id:
        hospital_id = generate_next_hospital_id(db)
    payload["hospital_id"] = hospital_id
    payload["qr_code"] = generate_qr_code(hospital_id)
    
    p = Patient(**payload)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@router.get("/patients", response_model=List[PatientOut])
def list_patients(db: Session = Depends(get_db), _=Depends(get_current_user)):
    patients = db.query(Patient).all()
    for p in patients:
        ensure_patient_identity(p, db)
    return patients

# IMPORTANT: /patients/me must be defined before /patients/{patient_id}
@router.get("/patients/me", response_model=PatientOut)
def get_my_patient_profile(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    p = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not p:
        raise HTTPException(404, "No patient profile linked to your account")
    return ensure_patient_identity(p, db)

@router.get("/patients/by-hospital-id/{hospital_id}", response_model=PatientOut)
def get_patient_by_hospital_id(hospital_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Patient).filter(Patient.hospital_id == hospital_id.strip()).first()
    if not p:
        raise HTTPException(404, f"Patient with Hospital ID '{hospital_id}' not found")
    return ensure_patient_identity(p, db)

@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    return ensure_patient_identity(p, db)

@router.put("/patients/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, data: PatientCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "receptionist", "doctor", "nurse"))):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    
    dump = data.model_dump()
    # Preserve hospital_id if not provided or keep existing
    if not dump.get("hospital_id") and p.hospital_id:
        dump["hospital_id"] = p.hospital_id
    elif not dump.get("hospital_id") and not p.hospital_id:
        dump["hospital_id"] = generate_next_hospital_id(db)
        
    dump["qr_code"] = generate_qr_code(dump["hospital_id"])
    
    for k, v in dump.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p

# --- Doctors ---
@router.post("/doctors", response_model=DoctorOut)
def create_doctor(data: DoctorCreate, db: Session = Depends(get_db), _=Depends(require_role("admin", "receptionist"))):
    d = Doctor(**data.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return d

@router.get("/doctors", response_model=List[DoctorOut])
def list_doctors(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Doctor).all()

# --- Appointments ---
@router.post("/appointments", response_model=AppointmentOut)
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            raise HTTPException(400, "No patient profile linked to your account. Ask a receptionist to register you first.")
        appt = Appointment(patient_id=patient.id, doctor_id=data.doctor_id, date=data.date, time=data.time, notes=data.notes)
    else:
        if not data.patient_id:
            raise HTTPException(400, "patient_id is required")
        appt = Appointment(**data.model_dump())
    db.add(appt); db.commit(); db.refresh(appt)
    return appt

@router.get("/appointments", response_model=List[AppointmentOut])
def list_appointments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        return db.query(Appointment).filter(Appointment.patient_id == patient.id).all()
    return db.query(Appointment).all()

@router.put("/appointments/{appt_id}/status")
def update_appointment_status(appt_id: int, status: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    a = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not a: raise HTTPException(404, "Appointment not found")
    # patients can only cancel their own appointments
    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or a.patient_id != patient.id:
            raise HTTPException(403, "Not allowed")
        if status != "cancelled":
            raise HTTPException(403, "Patients can only cancel appointments")
    a.status = status
    db.commit()
    return {"message": "Status updated"}
