import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.audit import log_audit_event
from app.models.patient import Patient, Doctor, Appointment
from app.models.user import User
from app.models.persona import PersonaAssessment
from app.models.ehr import EHR, ClinicalRecord
from app.routers.ehr import ensure_ehr_exists
from app.schemas.persona import (
    PersonaAssessmentCreate,
    PersonaAssessmentUpdate,
    PersonaDoctorReview,
    PersonaAssessmentOut,
    PriorityQueueItemOut
)

router = APIRouter(prefix="/persona", tags=["persona"])

DISCLAIMER_TEXT = "Priority is an initial triage/queue recommendation and does not constitute a medical diagnosis."

def evaluate_persona_priority(
    symptoms: str,
    severity: Optional[str] = None,
    temperature: Optional[float] = None,
    blood_pressure: Optional[str] = None,
    heart_rate: Optional[int] = None,
    spo2: Optional[float] = None
) -> tuple[str, str]:
    """
    Simple, explainable rule-based triage logic.
    Categorizes into EMERGENCY, HIGH, or NORMAL.
    Returns (priority, reason).
    """
    reasons = []
    is_emergency = False
    is_high = False

    symptoms_clean = symptoms.lower() if symptoms else ""
    sev_clean = severity.lower() if severity else ""

    # Parse Blood Pressure Systolic if formatted like "120/80"
    systolic_bp = None
    if blood_pressure:
        bp_match = re.search(r'(\d+)\s*/\s*(\d+)', blood_pressure)
        if bp_match:
            systolic_bp = int(bp_match.group(1))

    # --- 1. EMERGENCY INDICATORS ---
    emergency_keywords = [
        "chest pain", "cardiac", "heart attack",
        "breathlessness", "severe dyspnea", "gasping", "unable to breathe",
        "unconscious", "loss of consciousness", "syncope",
        "uncontrolled bleeding", "hemorrhage",
        "stroke", "seizure", "paralysis", "slurred speech",
        "severe trauma", "head injury"
    ]
    for kw in emergency_keywords:
        if kw in symptoms_clean:
            is_emergency = True
            reasons.append(f"Critical red-flag symptom detected: '{kw}'.")

    if spo2 is not None and spo2 < 90.0:
        is_emergency = True
        reasons.append(f"Critically low SpO2 level ({spo2}% < 90%).")

    if heart_rate is not None and (heart_rate > 130 or heart_rate < 40):
        is_emergency = True
        reasons.append(f"Severely abnormal heart rate ({heart_rate} bpm).")

    if systolic_bp is not None and (systolic_bp > 180 or systolic_bp < 80):
        is_emergency = True
        reasons.append(f"Severely abnormal blood pressure (Systolic {systolic_bp} mmHg).")

    if temperature is not None and temperature >= 103.0:
        is_emergency = True
        reasons.append(f"Critically high temperature ({temperature}°F).")

    if is_emergency:
        reason_str = "EMERGENCY Escalation: " + " ".join(reasons) + " Patient requires immediate doctor escalation."
        return "EMERGENCY", reason_str

    # --- 2. HIGH PRIORITY INDICATORS ---
    high_keywords = [
        "high fever", "persistent vomiting", "severe abdominal pain",
        "worsening breathing", "shortness of breath", "moderate trauma",
        "dizziness", "dehydration"
    ]
    for kw in high_keywords:
        if kw in symptoms_clean:
            is_high = True
            reasons.append(f"Concerning symptom present: '{kw}'.")

    if spo2 is not None and 90.0 <= spo2 <= 94.0:
        is_high = True
        reasons.append(f"Sub-optimal SpO2 level ({spo2}%).")

    if heart_rate is not None and 100 <= heart_rate <= 130:
        is_high = True
        reasons.append(f"Elevated heart rate ({heart_rate} bpm).")

    if systolic_bp is not None and ((140 <= systolic_bp <= 180) or (80 <= systolic_bp <= 90)):
        is_high = True
        reasons.append(f"Abnormal blood pressure (Systolic {systolic_bp} mmHg).")

    if temperature is not None and 100.4 <= temperature < 103.0:
        is_high = True
        reasons.append(f"Fever detected ({temperature}°F).")

    if sev_clean == "severe":
        is_high = True
        reasons.append("Reported symptom severity is 'severe'.")

    if is_high:
        reason_str = "HIGH Priority: " + " ".join(reasons) + " Patient requires earlier doctor review."
        return "HIGH", reason_str

    # --- 3. NORMAL PRIORITY ---
    reason_str = "NORMAL Priority: Routine/mild symptoms and stable basic vitals recorded."
    return "NORMAL", reason_str


def build_assessment_out(a: PersonaAssessment, patient_name: Optional[str] = None, doctor_name: Optional[str] = None) -> PersonaAssessmentOut:
    return PersonaAssessmentOut(
        id=a.id,
        patient_id=a.patient_id,
        patient_name=patient_name,
        hospital_id=a.hospital_id,
        appointment_id=a.appointment_id,
        persona_user_id=a.persona_user_id,
        persona_name=a.persona_name,
        symptoms=a.symptoms,
        symptom_duration=a.symptom_duration,
        severity=a.severity,
        temperature=a.temperature,
        blood_pressure=a.blood_pressure,
        heart_rate=a.heart_rate,
        spo2=a.spo2,
        additional_notes=a.additional_notes,
        priority=a.priority,
        priority_reason=a.priority_reason,
        status=a.status,
        escalation_reason=a.escalation_reason,
        doctor_review_status=a.doctor_review_status,
        doctor_id=a.doctor_id,
        doctor_name=doctor_name,
        doctor_notes=a.doctor_notes,
        disclaimer=DISCLAIMER_TEXT,
        created_at=a.created_at,
        updated_at=a.updated_at
    )


# --- API ENDPOINTS ---

@router.post("/assessments", response_model=PersonaAssessmentOut)
def create_assessment(
    data: PersonaAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "persona"))
):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    hospital_id = data.hospital_id or patient.hospital_id

    # Evaluate priority
    priority, priority_reason = evaluate_persona_priority(
        symptoms=data.symptoms,
        severity=data.severity,
        temperature=data.temperature,
        blood_pressure=data.blood_pressure,
        heart_rate=data.heart_rate,
        spo2=data.spo2
    )

    status_val = "ESCALATED" if priority == "EMERGENCY" else "WAITING"

    assessment = PersonaAssessment(
        patient_id=patient.id,
        hospital_id=hospital_id,
        appointment_id=data.appointment_id,
        persona_user_id=current_user.id,
        persona_name=current_user.username,
        symptoms=data.symptoms,
        symptom_duration=data.symptom_duration,
        severity=data.severity,
        temperature=data.temperature,
        blood_pressure=data.blood_pressure,
        heart_rate=data.heart_rate,
        spo2=data.spo2,
        additional_notes=data.additional_notes,
        priority=priority,
        priority_reason=priority_reason,
        status=status_val,
        doctor_review_status="PENDING",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    # Audit logging
    log_audit_event(
        db,
        current_user.id,
        "PERSONA_ASSESSMENT_CREATED",
        f"Persona '{current_user.username}' created initial assessment for patient {patient.name} ({hospital_id}). Symptoms: {data.symptoms[:50]}"
    )
    log_audit_event(
        db,
        current_user.id,
        "PERSONA_PRIORITY_ASSIGNED",
        f"Assigned priority [{priority}] to patient {patient.name} ({hospital_id}). Reason: {priority_reason}"
    )

    return build_assessment_out(assessment, patient_name=patient.name)


@router.get("/assessments", response_model=List[PersonaAssessmentOut])
def list_assessments(
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "persona"))
):
    query = db.query(PersonaAssessment)

    if status_filter:
        query = query.filter(PersonaAssessment.status == status_filter)
    if priority_filter:
        query = query.filter(PersonaAssessment.priority == priority_filter)
    if patient_id:
        query = query.filter(PersonaAssessment.patient_id == patient_id)

    assessments = query.order_by(PersonaAssessment.created_at.desc()).all()

    # Pre-fetch patients and doctors for name mapping
    p_ids = {a.patient_id for a in assessments}
    patients_map = {p.id: p.name for p in db.query(Patient).filter(Patient.id.in_(p_ids)).all()} if p_ids else {}

    doc_ids = {a.doctor_id for a in assessments if a.doctor_id}
    doctors_map = {d.id: d.name for d in db.query(Doctor).filter(Doctor.id.in_(doc_ids)).all()} if doc_ids else {}

    log_audit_event(
        db,
        current_user.id,
        "PERSONA_ASSESSMENT_VIEWED",
        f"User '{current_user.username}' ({current_user.role}) listed Persona assessments"
    )

    return [
        build_assessment_out(a, patient_name=patients_map.get(a.patient_id), doctor_name=doctors_map.get(a.doctor_id))
        for a in assessments
    ]


@router.get("/patient/{patient_id}", response_model=List[PersonaAssessmentOut])
def get_patient_assessments(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # RBAC Checks
    if current_user.role in ("pharmacist", "receptionist"):
        raise HTTPException(
            status_code=403,
            detail="Role not authorized to access clinical initial assessments"
        )

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    if current_user.role == "patient" and (not patient.user_id or patient.user_id != current_user.id):
        raise HTTPException(403, "Access denied: You can only view your own Persona assessment")

    assessments = db.query(PersonaAssessment).filter(
        PersonaAssessment.patient_id == patient_id
    ).order_by(PersonaAssessment.created_at.desc()).all()

    log_audit_event(
        db,
        current_user.id,
        "PERSONA_ASSESSMENT_VIEWED",
        f"User '{current_user.username}' viewed Persona assessments for patient ID {patient_id}"
    )

    return [build_assessment_out(a, patient_name=patient.name) for a in assessments]


@router.get("/my-assessments", response_model=List[PersonaAssessmentOut])
def get_my_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "patient":
        raise HTTPException(400, "This endpoint is for patient accounts")

    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []

    assessments = db.query(PersonaAssessment).filter(
        PersonaAssessment.patient_id == patient.id
    ).order_by(PersonaAssessment.created_at.desc()).all()

    return [build_assessment_out(a, patient_name=patient.name) for a in assessments]


@router.get("/assessments/{assessment_id}", response_model=PersonaAssessmentOut)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "persona"))
):
    a = db.query(PersonaAssessment).filter(PersonaAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Persona assessment not found")

    patient = db.query(Patient).filter(Patient.id == a.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == a.doctor_id).first() if a.doctor_id else None

    return build_assessment_out(a, patient_name=patient.name if patient else None, doctor_name=doctor.name if doctor else None)


@router.put("/assessments/{assessment_id}", response_model=PersonaAssessmentOut)
def update_assessment(
    assessment_id: int,
    data: PersonaAssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "persona"))
):
    a = db.query(PersonaAssessment).filter(PersonaAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Persona assessment not found")

    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        if v is not None:
            setattr(a, k, v)

    # Re-evaluate priority if symptoms or vitals modified
    priority, priority_reason = evaluate_persona_priority(
        symptoms=a.symptoms,
        severity=a.severity,
        temperature=a.temperature,
        blood_pressure=a.blood_pressure,
        heart_rate=a.heart_rate,
        spo2=a.spo2
    )
    a.priority = priority
    a.priority_reason = priority_reason
    a.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(a)

    patient = db.query(Patient).filter(Patient.id == a.patient_id).first()

    log_audit_event(
        db,
        current_user.id,
        "PERSONA_STATUS_UPDATED",
        f"User '{current_user.username}' updated Persona assessment #{a.id} for patient {patient.name if patient else a.patient_id}. Status: {a.status}"
    )

    return build_assessment_out(a, patient_name=patient.name if patient else None)


@router.post("/assessments/{assessment_id}/doctor-review", response_model=PersonaAssessmentOut)
def doctor_review_assessment(
    assessment_id: int,
    review: PersonaDoctorReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor"))
):
    a = db.query(PersonaAssessment).filter(PersonaAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Persona assessment not found")

    # Link doctor profile if current_user is a doctor
    doc_id = None
    doc_name = f"Dr. {current_user.username}"
    if current_user.role == "doctor":
        doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doc:
            doc_id = doc.id
            doc_name = doc.name

    a.doctor_review_status = review.doctor_review_status
    a.doctor_notes = review.doctor_notes
    if doc_id:
        a.doctor_id = doc_id
    if review.status:
        a.status = review.status
    a.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(a)

    patient = db.query(Patient).filter(Patient.id == a.patient_id).first()

    # Append to EHR if requested
    if review.append_to_ehr and patient:
        ehr = ensure_ehr_exists(patient, db)
        vitals_dict = {
            "temperature": a.temperature,
            "blood_pressure": a.blood_pressure,
            "heart_rate": a.heart_rate,
            "spo2": a.spo2
        }
        rec = ClinicalRecord(
            ehr_id=ehr.id,
            patient_id=patient.id,
            doctor_id=doc_id,
            doctor_name=doc_name,
            record_type="consultation",
            title=f"Persona Initial Assessment Review [{a.priority}]",
            details=f"Persona Initial Assessment:\n- Priority: {a.priority}\n- Symptoms: {a.symptoms}\n- Duration: {a.symptom_duration or 'N/A'}\n- Triage Reason: {a.priority_reason}\n\nDoctor Notes & Review:\n{review.doctor_notes or 'Assessment reviewed and approved by attending doctor.'}",
            vitals_json=str(vitals_dict)
        )
        db.add(rec)
        db.commit()

    log_audit_event(
        db,
        current_user.id,
        "PERSONA_DOCTOR_REVIEWED",
        f"Doctor '{current_user.username}' reviewed assessment #{a.id} (Status: {a.doctor_review_status}). Appended to EHR: {review.append_to_ehr}"
    )

    return build_assessment_out(a, patient_name=patient.name if patient else None, doctor_name=doc_name)


@router.get("/queue", response_model=List[PriorityQueueItemOut])
def get_smart_priority_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "persona", "receptionist"))
):
    """
    Returns prioritized patient consultation queue.
    Queue order:
    1. EMERGENCY
    2. HIGH
    3. NORMAL
    4. UNASSESSED / Scheduled
    Within same priority group, ordered chronologically by waiting time.
    """
    # Fetch active/scheduled appointments
    appointments = db.query(Appointment).filter(Appointment.status == "scheduled").all()

    # Map patients and doctors
    patient_ids = {app.patient_id for app in appointments}
    doctor_ids = {app.doctor_id for app in appointments}

    # Also fetch active WAITING or ESCALATED assessments without scheduled appointments
    assessments_active = db.query(PersonaAssessment).filter(
        PersonaAssessment.status.in_(["WAITING", "ESCALATED", "ASSESSED"])
    ).all()
    patient_ids.update({a.patient_id for a in assessments_active})

    patients_map = {p.id: p for p in db.query(Patient).filter(Patient.id.in_(patient_ids)).all()} if patient_ids else {}
    doctors_map = {d.id: d.name for d in db.query(Doctor).filter(Doctor.id.in_(doctor_ids)).all()} if doctor_ids else {}

    # Map latest assessment for each patient
    assessment_map = {}
    for a in assessments_active:
        if a.patient_id not in assessment_map or a.created_at > assessment_map[a.patient_id].created_at:
            assessment_map[a.patient_id] = a

    priority_weight = {
        "EMERGENCY": 1,
        "HIGH": 2,
        "NORMAL": 3,
        "UNASSESSED": 4
    }

    queue_items = []
    processed_patient_ids = set()

    # Process scheduled appointments
    for app in appointments:
        patient = patients_map.get(app.patient_id)
        if not patient:
            continue
        processed_patient_ids.add(patient.id)

        assessment = assessment_map.get(patient.id)
        if not assessment:
            # Check if there is any historical assessment
            assessment = db.query(PersonaAssessment).filter(
                PersonaAssessment.patient_id == patient.id
            ).order_by(PersonaAssessment.created_at.desc()).first()

        priority = assessment.priority if assessment else "UNASSESSED"
        p_reason = assessment.priority_reason if assessment else "Routine appointment without prior initial triage."
        a_id = assessment.id if assessment else None
        a_status = assessment.status if assessment else None
        dr_status = assessment.doctor_review_status if assessment else None
        c_time = assessment.created_at if assessment else datetime.combine(app.date, datetime.min.time())

        wait_mins = int((datetime.utcnow() - c_time).total_seconds() / 60) if c_time else 0

        queue_items.append({
            "appointment_id": app.id,
            "patient_id": patient.id,
            "hospital_id": patient.hospital_id,
            "patient_name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "doctor_id": app.doctor_id,
            "doctor_name": doctors_map.get(app.doctor_id, f"Doctor #{app.doctor_id}"),
            "date": str(app.date),
            "time": app.time,
            "priority": priority,
            "priority_reason": p_reason,
            "assessment_id": a_id,
            "assessment_status": a_status,
            "doctor_review_status": dr_status,
            "waiting_time_minutes": max(0, wait_mins),
            "created_at": c_time,
            "sort_weight": priority_weight.get(priority, 4)
        })

    # Add active triage assessments that might not have a formal appointment record yet
    for patient_id, assessment in assessment_map.items():
        if patient_id in processed_patient_ids:
            continue
        patient = patients_map.get(patient_id)
        if not patient:
            continue

        wait_mins = int((datetime.utcnow() - assessment.created_at).total_seconds() / 60)

        queue_items.append({
            "appointment_id": None,
            "patient_id": patient.id,
            "hospital_id": patient.hospital_id,
            "patient_name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "doctor_id": None,
            "doctor_name": "Triage / On Call Doctor",
            "date": str(assessment.created_at.date()),
            "time": assessment.created_at.strftime("%H:%M"),
            "priority": assessment.priority,
            "priority_reason": assessment.priority_reason,
            "assessment_id": assessment.id,
            "assessment_status": assessment.status,
            "doctor_review_status": assessment.doctor_review_status,
            "waiting_time_minutes": max(0, wait_mins),
            "created_at": assessment.created_at,
            "sort_weight": priority_weight.get(assessment.priority, 4)
        })

    # Sort queue: primary key = sort_weight, secondary key = created_at
    queue_items.sort(key=lambda x: (x["sort_weight"], x["created_at"]))

    # Assign 1-indexed position
    result = []
    for idx, item in enumerate(queue_items, start=1):
        item_out = PriorityQueueItemOut(
            position=idx,
            appointment_id=item["appointment_id"],
            patient_id=item["patient_id"],
            hospital_id=item["hospital_id"],
            patient_name=item["patient_name"],
            age=item["age"],
            gender=item["gender"],
            doctor_id=item["doctor_id"],
            doctor_name=item["doctor_name"],
            date=item["date"],
            time=item["time"],
            priority=item["priority"],
            priority_reason=item["priority_reason"],
            assessment_id=item["assessment_id"],
            assessment_status=item["assessment_status"],
            doctor_review_status=item["doctor_review_status"],
            waiting_time_minutes=item["waiting_time_minutes"],
            created_at=item["created_at"]
        )
        result.append(item_out)

    return result
