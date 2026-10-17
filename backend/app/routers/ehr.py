from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Union
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.audit import log_audit_event
from app.models.patient import Patient, Doctor
from app.models.pharmacy import Prescription, Drug
from app.models.user import User
from app.models.ehr import EHR, ClinicalRecord
from app.schemas.ehr import (
    EHRUpdate, EHROut, EHRPharmacistOut,
    ClinicalRecordCreate, ClinicalRecordOut
)

router = APIRouter(tags=["ehr"])

def ensure_ehr_exists(patient: Patient, db: Session) -> EHR:
    ehr = db.query(EHR).filter(EHR.patient_id == patient.id).first()
    if not ehr:
        ehr = EHR(
            patient_id=patient.id,
            hospital_id=patient.hospital_id,
            medical_history=patient.medical_history
        )
        db.add(ehr)
        db.commit()
        db.refresh(ehr)
    elif not ehr.hospital_id and patient.hospital_id:
        ehr.hospital_id = patient.hospital_id
        db.commit()
        db.refresh(ehr)
    return ehr

@router.get("/patients/{patient_id}/ehr", response_model=Union[EHROut, EHRPharmacistOut])
def get_patient_ehr(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Role-based access restrictions
    if current_user.role == "receptionist":
        raise HTTPException(
            status_code=403,
            detail="Receptionists are not authorized to view clinical health records"
        )
    
    if current_user.role == "patient":
        if not patient.user_id or patient.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You can only view your own Electronic Health Record"
            )

    ehr = ensure_ehr_exists(patient, db)
    log_audit_event(
        db,
        current_user.id,
        "EHR_VIEWED",
        f"User '{current_user.username}' ({current_user.role}) viewed EHR for patient ID {patient_id} (Hospital ID: {patient.hospital_id})"
    )

    # Pharmacist RBAC: Return sanitized non-clinical view
    if current_user.role == "pharmacist":
        prescriptions = (
            db.query(Prescription, Drug.name.label("drug_name"))
            .join(Drug, Prescription.drug_id == Drug.id)
            .filter(Prescription.patient_id == patient.id)
            .all()
        )
        rx_list = []
        for rx, drug_name in prescriptions:
            rx_list.append({
                "id": rx.id,
                "drug_name": drug_name,
                "dosage": rx.dosage,
                "instructions": rx.instructions,
                "dispensed": bool(rx.dispensed)
            })

        return EHRPharmacistOut(
            id=ehr.id,
            patient_id=patient.id,
            hospital_id=patient.hospital_id,
            patient_name=patient.name,
            allergies=ehr.allergies,
            current_medications=ehr.current_medications,
            blood_group=ehr.blood_group,
            prescriptions=rx_list
        )

    # Doctor, Nurse, Admin, or Patient (self): Return full EHR
    records = db.query(ClinicalRecord).filter(ClinicalRecord.ehr_id == ehr.id).order_by(ClinicalRecord.created_at.desc()).all()
    ehr_dict = {
        "id": ehr.id,
        "patient_id": ehr.patient_id,
        "hospital_id": ehr.hospital_id,
        "medical_history": ehr.medical_history,
        "allergies": ehr.allergies,
        "chronic_conditions": ehr.chronic_conditions,
        "current_medications": ehr.current_medications,
        "blood_group": ehr.blood_group,
        "created_at": ehr.created_at,
        "updated_at": ehr.updated_at,
        "records": records
    }
    return EHROut(**ehr_dict)


@router.get("/patients/by-hospital-id/{hospital_id}/ehr", response_model=Union[EHROut, EHRPharmacistOut])
def get_patient_ehr_by_hospital_id(hospital_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.hospital_id == hospital_id.strip()).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with Hospital ID '{hospital_id}' not found")
    return get_patient_ehr(patient_id=patient.id, db=db, current_user=current_user)


@router.post("/patients/{patient_id}/ehr", response_model=EHROut)
def create_or_initialize_ehr(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse"))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    ehr = ensure_ehr_exists(patient, db)
    log_audit_event(
        db,
        current_user.id,
        "EHR_CREATED",
        f"User '{current_user.username}' initialized EHR for patient ID {patient_id} ({patient.hospital_id})"
    )
    records = db.query(ClinicalRecord).filter(ClinicalRecord.ehr_id == ehr.id).order_by(ClinicalRecord.created_at.desc()).all()
    return EHROut(
        id=ehr.id,
        patient_id=ehr.patient_id,
        hospital_id=ehr.hospital_id,
        medical_history=ehr.medical_history,
        allergies=ehr.allergies,
        chronic_conditions=ehr.chronic_conditions,
        current_medications=ehr.current_medications,
        blood_group=ehr.blood_group,
        created_at=ehr.created_at,
        updated_at=ehr.updated_at,
        records=records
    )


@router.put("/patients/{patient_id}/ehr", response_model=EHROut)
def update_patient_ehr(
    patient_id: int,
    data: EHRUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse"))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    ehr = ensure_ehr_exists(patient, db)
    payload = data.model_dump(exclude_unset=True)

    for field, val in payload.items():
        if val is not None:
            setattr(ehr, field, val)

    if data.medical_history is not None:
        patient.medical_history = data.medical_history

    db.commit()
    db.refresh(ehr)

    log_audit_event(
        db,
        current_user.id,
        "EHR_UPDATED",
        f"User '{current_user.username}' updated EHR background for patient ID {patient_id} ({patient.hospital_id})"
    )

    records = db.query(ClinicalRecord).filter(ClinicalRecord.ehr_id == ehr.id).order_by(ClinicalRecord.created_at.desc()).all()
    return EHROut(
        id=ehr.id,
        patient_id=ehr.patient_id,
        hospital_id=ehr.hospital_id,
        medical_history=ehr.medical_history,
        allergies=ehr.allergies,
        chronic_conditions=ehr.chronic_conditions,
        current_medications=ehr.current_medications,
        blood_group=ehr.blood_group,
        created_at=ehr.created_at,
        updated_at=ehr.updated_at,
        records=records
    )


@router.post("/patients/{patient_id}/ehr/records", response_model=ClinicalRecordOut)
def append_clinical_record(
    patient_id: int,
    data: ClinicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse"))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    ehr = ensure_ehr_exists(patient, db)

    doctor_id = data.doctor_id
    doctor_name = None

    if current_user.role == "doctor":
        doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doc:
            doctor_id = doc.id
            doctor_name = doc.name
        else:
            doctor_name = f"Dr. {current_user.username}"
    elif doctor_id:
        doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if doc:
            doctor_name = doc.name

    rec = ClinicalRecord(
        ehr_id=ehr.id,
        patient_id=patient.id,
        doctor_id=doctor_id,
        doctor_name=doctor_name,
        record_type=data.record_type or "consultation",
        title=data.title,
        details=data.details,
        vitals_json=data.vitals_json,
        ai_compatible_payload=data.ai_compatible_payload
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    log_audit_event(
        db,
        current_user.id,
        "CLINICAL_RECORD_ADDED",
        f"User '{current_user.username}' added clinical record [{rec.record_type}] '{rec.title or 'Note'}' to patient ID {patient_id}"
    )

    return rec


@router.get("/patients/{patient_id}/ehr/records", response_model=List[ClinicalRecordOut])
def list_clinical_records(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == "receptionist":
        raise HTTPException(status_code=403, detail="Receptionists are not authorized to view clinical records")

    if current_user.role == "patient" and (not patient.user_id or patient.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    ehr = ensure_ehr_exists(patient, db)
    return db.query(ClinicalRecord).filter(ClinicalRecord.ehr_id == ehr.id).order_by(ClinicalRecord.created_at.desc()).all()
