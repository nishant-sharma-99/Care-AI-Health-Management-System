from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import json
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.patient import Patient, Doctor
from app.models.ehr import EHR, ClinicalRecord
from app.models.lab import LabTestOrder, LabReport, LabResultParameter
from app.schemas.lab import (
    LabOrderCreate, LabOrderStatusUpdate, LabReportCreate,
    LabReportVerify, LabOrderOut, LabReportOut, LabParameterSchema
)
from app.routers.ehr import ensure_ehr_exists

router = APIRouter(prefix="/lab", tags=["laboratory"])

# Predefined Laboratory Test Catalog
LAB_CATALOG = [
    {
        "test_name": "Complete Blood Count (CBC)",
        "test_category": "Hematology",
        "description": "Measures key blood cells including hemoglobin, WBC, RBC, and platelets.",
        "parameters": [
            {"parameter_name": "Hemoglobin", "unit": "g/dL", "reference_range": "13.0 - 17.0 (M) / 12.0 - 15.0 (F)"},
            {"parameter_name": "WBC Count", "unit": "cells/µL", "reference_range": "4,000 - 11,000"},
            {"parameter_name": "RBC Count", "unit": "million/µL", "reference_range": "4.5 - 5.9"},
            {"parameter_name": "Platelet Count", "unit": "cells/µL", "reference_range": "150,000 - 450,000"},
            {"parameter_name": "Hematocrit (HCT)", "unit": "%", "reference_range": "40 - 50%"}
        ]
    },
    {
        "test_name": "Blood Glucose",
        "test_category": "Biochemistry",
        "description": "Evaluates fasting and post-prandial blood sugar levels.",
        "parameters": [
            {"parameter_name": "Fasting Blood Sugar (FBS)", "unit": "mg/dL", "reference_range": "70 - 99"},
            {"parameter_name": "Post Prandial Sugar (PPBS)", "unit": "mg/dL", "reference_range": "< 140"}
        ]
    },
    {
        "test_name": "HbA1c",
        "test_category": "Biochemistry",
        "description": "Assesses 3-month average blood glucose concentration.",
        "parameters": [
            {"parameter_name": "HbA1c Percentage", "unit": "%", "reference_range": "< 5.7 (Normal) / 5.7-6.4 (Prediabetes)"},
            {"parameter_name": "Estimated Average Glucose", "unit": "mg/dL", "reference_range": "< 117"}
        ]
    },
    {
        "test_name": "Lipid Profile",
        "test_category": "Biochemistry",
        "description": "Evaluates cholesterol breakdown and cardiovascular risk.",
        "parameters": [
            {"parameter_name": "Total Cholesterol", "unit": "mg/dL", "reference_range": "< 200"},
            {"parameter_name": "HDL Cholesterol", "unit": "mg/dL", "reference_range": "> 40 (Optimal)"},
            {"parameter_name": "LDL Cholesterol", "unit": "mg/dL", "reference_range": "< 100"},
            {"parameter_name": "Triglycerides", "unit": "mg/dL", "reference_range": "< 150"}
        ]
    },
    {
        "test_name": "Liver Function Test (LFT)",
        "test_category": "Biochemistry",
        "description": "Measures liver enzymes, bilirubin, and protein levels.",
        "parameters": [
            {"parameter_name": "Total Bilirubin", "unit": "mg/dL", "reference_range": "0.1 - 1.2"},
            {"parameter_name": "Direct Bilirubin", "unit": "mg/dL", "reference_range": "0.0 - 0.3"},
            {"parameter_name": "SGOT (AST)", "unit": "U/L", "reference_range": "8 - 45"},
            {"parameter_name": "SGPT (ALT)", "unit": "U/L", "reference_range": "7 - 56"},
            {"parameter_name": "Alkaline Phosphatase (ALP)", "unit": "U/L", "reference_range": "44 - 147"}
        ]
    },
    {
        "test_name": "Kidney Function Test (KFT)",
        "test_category": "Biochemistry",
        "description": "Evaluates renal filtration, urea, creatinine, and electrolytes.",
        "parameters": [
            {"parameter_name": "Blood Urea", "unit": "mg/dL", "reference_range": "7 - 20"},
            {"parameter_name": "Serum Creatinine", "unit": "mg/dL", "reference_range": "0.7 - 1.3"},
            {"parameter_name": "Uric Acid", "unit": "mg/dL", "reference_range": "3.5 - 7.2"},
            {"parameter_name": "Serum Sodium", "unit": "mEq/L", "reference_range": "135 - 145"},
            {"parameter_name": "Serum Potassium", "unit": "mEq/L", "reference_range": "3.5 - 5.0"}
        ]
    },
    {
        "test_name": "Thyroid Profile",
        "test_category": "Endocrinology",
        "description": "Measures T3, T4, and TSH hormone balance.",
        "parameters": [
            {"parameter_name": "Total T3", "unit": "ng/dL", "reference_range": "80 - 200"},
            {"parameter_name": "Total T4", "unit": "µg/dL", "reference_range": "4.5 - 12.0"},
            {"parameter_name": "TSH", "unit": "µIU/mL", "reference_range": "0.4 - 4.0"}
        ]
    },
    {
        "test_name": "Urine Routine",
        "test_category": "Pathology",
        "description": "Physical, chemical, and microscopic examination of urine sample.",
        "parameters": [
            {"parameter_name": "Color", "unit": "", "reference_range": "Pale Yellow"},
            {"parameter_name": "pH", "unit": "", "reference_range": "4.6 - 8.0"},
            {"parameter_name": "Protein", "unit": "", "reference_range": "Nil"},
            {"parameter_name": "Glucose", "unit": "", "reference_range": "Nil"},
            {"parameter_name": "Microscopic RBC", "unit": "/HPF", "reference_range": "0 - 2"}
        ]
    },
    {
        "test_name": "Dengue Test",
        "test_category": "Serology",
        "description": "Detects Dengue NS1 antigen and IgG/IgM antibodies.",
        "parameters": [
            {"parameter_name": "Dengue NS1 Antigen", "unit": "", "reference_range": "Negative"},
            {"parameter_name": "Dengue IgG Antibody", "unit": "", "reference_range": "Negative"},
            {"parameter_name": "Dengue IgM Antibody", "unit": "", "reference_range": "Negative"}
        ]
    },
    {
        "test_name": "Malaria Test",
        "test_category": "Serology",
        "description": "Rapid diagnostic test for P. falciparum and P. vivax.",
        "parameters": [
            {"parameter_name": "Malaria Antigen (P. falciparum)", "unit": "", "reference_range": "Negative"},
            {"parameter_name": "Malaria Antigen (P. vivax)", "unit": "", "reference_range": "Negative"}
        ]
    },
    {
        "test_name": "Hemoglobin (Hb)",
        "test_category": "Hematology",
        "description": "Standalone screening for anemia.",
        "parameters": [
            {"parameter_name": "Hemoglobin", "unit": "g/dL", "reference_range": "13.0 - 17.0 (M) / 12.0 - 15.0 (F)"}
        ]
    },
    {
        "test_name": "ESR",
        "test_category": "Hematology",
        "description": "Erythrocyte Sedimentation Rate marker for systemic inflammation.",
        "parameters": [
            {"parameter_name": "ESR (1st Hour)", "unit": "mm/hr", "reference_range": "0 - 15 (M) / 0 - 20 (F)"}
        ]
    }
]

def generate_sample_id(db: Session) -> str:
    count = db.query(func.count(LabTestOrder.id)).scalar() or 0
    num = count + 1
    sample_id = f"LAB-SMP-{num:06d}"
    while db.query(LabTestOrder).filter(LabTestOrder.sample_id == sample_id).first():
        num += 1
        sample_id = f"LAB-SMP-{num:06d}"
    return sample_id

def make_order_out(order: LabTestOrder, patient_name: Optional[str] = None) -> LabOrderOut:
    return LabOrderOut(
        id=order.id,
        sample_id=order.sample_id,
        patient_id=order.patient_id,
        patient_name=patient_name,
        hospital_id=order.hospital_id,
        appointment_id=order.appointment_id,
        doctor_id=order.doctor_id,
        doctor_name=order.doctor_name,
        test_name=order.test_name,
        test_category=order.test_category,
        clinical_notes=order.clinical_notes,
        priority=order.priority,
        status=order.status,
        sample_collected_at=order.sample_collected_at,
        collected_by_technician_id=order.collected_by_technician_id,
        ordered_at=order.ordered_at,
        updated_at=order.updated_at,
    )

def make_report_out(report: LabReport, patient_name: Optional[str] = None, parameters: list = None) -> LabReportOut:
    return LabReportOut(
        id=report.id,
        lab_order_id=report.lab_order_id,
        sample_id=report.sample_id,
        patient_id=report.patient_id,
        patient_name=patient_name,
        hospital_id=report.hospital_id,
        test_name=report.test_name,
        test_category=report.test_category,
        result_summary=report.result_summary,
        result_data_json=report.result_data_json,
        parameters=parameters or [],
        technician_id=report.technician_id,
        technician_name=report.technician_name,
        verified_by_doctor_id=report.verified_by_doctor_id,
        verified_by_doctor_name=report.verified_by_doctor_name,
        verification_status=report.verification_status,
        verification_notes=report.verification_notes,
        rejection_reason=report.rejection_reason,
        report_status=report.report_status,
        has_critical_result=report.has_critical_result,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("/catalog")
def get_lab_catalog():
    """Returns the predefined hospital laboratory test catalog."""
    return LAB_CATALOG


@router.post("/orders", response_model=LabOrderOut)
def create_lab_order(
    data: LabOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse"))
):
    """Doctor or staff creates a new laboratory test order."""
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

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

    if not doctor_name:
        doctor_name = f"Dr. {current_user.username}"

    sample_id = generate_sample_id(db)
    hospital_id_str = patient.hospital_id or f"MED{str(patient.id).zfill(6)}"

    order = LabTestOrder(
        sample_id=sample_id,
        patient_id=patient.id,
        hospital_id=hospital_id_str,
        appointment_id=data.appointment_id,
        doctor_id=doctor_id,
        doctor_name=doctor_name,
        test_name=data.test_name,
        test_category=data.test_category,
        clinical_notes=data.clinical_notes,
        priority=data.priority.upper() if data.priority else "NORMAL",
        status="ORDERED"
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    log_audit_event(
        db,
        current_user.id,
        "LAB_ORDER_CREATED",
        f"User '{current_user.username}' created lab order [{order.test_name}] (Sample ID: {order.sample_id}) for patient {patient.name} ({order.hospital_id})"
    )

    return make_order_out(order, patient.name)


@router.get("/orders", response_model=List[LabOrderOut])
def list_lab_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "lab_technician"))
):
    """List lab orders for staff."""
    orders = db.query(LabTestOrder, Patient.name.label("patient_name"))\
        .join(Patient, LabTestOrder.patient_id == Patient.id)\
        .order_by(LabTestOrder.ordered_at.desc()).all()

    result = []
    for order, p_name in orders:
        result.append(make_order_out(order, p_name))
    return result


@router.get("/orders/pending", response_model=List[LabOrderOut])
def list_pending_lab_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "lab_technician"))
):
    """List pending lab orders awaiting laboratory technician processing."""
    pending_statuses = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "AWAITING_VERIFICATION"]
    orders = db.query(LabTestOrder, Patient.name.label("patient_name"))\
        .join(Patient, LabTestOrder.patient_id == Patient.id)\
        .filter(LabTestOrder.status.in_(pending_statuses))\
        .order_by(LabTestOrder.priority.desc(), LabTestOrder.ordered_at.asc()).all()

    result = []
    for order, p_name in orders:
        result.append(make_order_out(order, p_name))
    return result


@router.get("/queue")
def get_lab_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "nurse", "lab_technician"))
):
    """
    Returns priority-sorted laboratory work queue (URGENT first, then oldest ordered_at).
    Includes position in queue.
    """
    pending_statuses = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "AWAITING_VERIFICATION"]
    raw_orders = db.query(LabTestOrder, Patient.name.label("patient_name"))\
        .join(Patient, LabTestOrder.patient_id == Patient.id)\
        .filter(LabTestOrder.status.in_(pending_statuses)).all()

    def sort_key(item):
        o, _ = item
        p_rank = 1 if o.priority == "URGENT" else 2
        return (p_rank, o.ordered_at)

    sorted_orders = sorted(raw_orders, key=sort_key)

    queue = []
    for idx, (order, p_name) in enumerate(sorted_orders, start=1):
        queue.append({
            "position": idx,
            "order_id": order.id,
            "sample_id": order.sample_id,
            "patient_id": order.patient_id,
            "patient_name": p_name,
            "hospital_id": order.hospital_id,
            "doctor_name": order.doctor_name,
            "test_name": order.test_name,
            "test_category": order.test_category,
            "priority": order.priority,
            "status": order.status,
            "clinical_notes": order.clinical_notes,
            "ordered_at": order.ordered_at,
            "sample_collected_at": order.sample_collected_at
        })
    return queue


@router.get("/orders/{order_id}", response_model=LabOrderOut)
def get_lab_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get single lab order by ID."""
    order_res = db.query(LabTestOrder, Patient.name.label("patient_name"))\
        .join(Patient, LabTestOrder.patient_id == Patient.id)\
        .filter(LabTestOrder.id == order_id).first()

    if not order_res:
        raise HTTPException(status_code=404, detail="Lab order not found")

    order, p_name = order_res

    if current_user.role == "patient":
        pat = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not pat or pat.id != order.patient_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return make_order_out(order, p_name)


@router.get("/orders/patient/{patient_id}", response_model=List[LabOrderOut])
def get_patient_lab_orders(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all lab orders for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == "patient":
        if not patient.user_id or patient.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    orders = db.query(LabTestOrder).filter(LabTestOrder.patient_id == patient_id)\
        .order_by(LabTestOrder.ordered_at.desc()).all()

    result = []
    for o in orders:
        result.append(make_order_out(o, patient.name))
    return result


@router.put("/orders/{order_id}/status", response_model=LabOrderOut)
def update_lab_order_status(
    order_id: int,
    data: LabOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor", "lab_technician"))
):
    """Update lab order processing status (e.g. SAMPLE_COLLECTED, PROCESSING)."""
    order = db.query(LabTestOrder).filter(LabTestOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    new_status = data.status.upper()
    valid_statuses = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "AWAITING_VERIFICATION", "COMPLETED", "CANCELLED"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status}'")

    order.status = new_status
    if new_status == "SAMPLE_COLLECTED" and not order.sample_collected_at:
        order.sample_collected_at = datetime.utcnow()
        order.collected_by_technician_id = current_user.id
        log_audit_event(
            db, current_user.id, "LAB_SAMPLE_COLLECTED",
            f"Technician '{current_user.username}' collected sample for Order #{order.id} (Sample ID: {order.sample_id})"
        )
    elif new_status == "PROCESSING":
        log_audit_event(
            db, current_user.id, "LAB_PROCESSING_STARTED",
            f"Technician '{current_user.username}' started processing Order #{order.id} (Sample ID: {order.sample_id})"
        )
    else:
        log_audit_event(
            db, current_user.id, "LAB_ORDER_STATUS_UPDATED",
            f"Order #{order.id} status updated to {new_status} by '{current_user.username}'"
        )

    db.commit()
    db.refresh(order)

    patient = db.query(Patient).filter(Patient.id == order.patient_id).first()
    return make_order_out(order, patient.name if patient else "Unknown")


@router.post("/orders/{order_id}/report", response_model=LabReportOut)
def create_or_update_lab_report(
    order_id: int,
    data: LabReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "lab_technician"))
):
    """
    Lab Technician enters structured parameters and submits report.
    Can set report_status to DRAFT or AWAITING_VERIFICATION.
    """
    order = db.query(LabTestOrder).filter(LabTestOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    patient = db.query(Patient).filter(Patient.id == order.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    target_report_status = data.report_status.upper() if data.report_status else "AWAITING_VERIFICATION"
    if target_report_status not in ["DRAFT", "AWAITING_VERIFICATION"]:
        raise HTTPException(status_code=400, detail="Report status must be DRAFT or AWAITING_VERIFICATION")

    has_critical = any(p.flag.upper() == "CRITICAL" for p in data.parameters)
    report = db.query(LabReport).filter(LabReport.lab_order_id == order.id).first()

    params_json = json.dumps([p.model_dump() for p in data.parameters])

    if not report:
        report = LabReport(
            lab_order_id=order.id,
            sample_id=order.sample_id,
            patient_id=order.patient_id,
            hospital_id=order.hospital_id,
            test_name=order.test_name,
            test_category=order.test_category,
            result_summary=data.result_summary,
            result_data_json=params_json,
            technician_id=current_user.id,
            technician_name=current_user.username,
            verification_status="PENDING",
            report_status=target_report_status,
            has_critical_result=has_critical
        )
        db.add(report)
        db.commit()
        db.refresh(report)
    else:
        report.result_summary = data.result_summary
        report.result_data_json = params_json
        report.technician_id = current_user.id
        report.technician_name = current_user.username
        report.report_status = target_report_status
        report.verification_status = "PENDING"
        report.has_critical_result = has_critical
        db.query(LabResultParameter).filter(LabResultParameter.report_id == report.id).delete()
        db.commit()
        db.refresh(report)

    for p in data.parameters:
        param_entry = LabResultParameter(
            report_id=report.id,
            parameter_name=p.parameter_name,
            result_value=p.result_value,
            unit=p.unit,
            reference_range=p.reference_range,
            flag=p.flag.upper()
        )
        db.add(param_entry)

    if target_report_status == "AWAITING_VERIFICATION":
        order.status = "AWAITING_VERIFICATION"

    db.commit()
    db.refresh(order)
    db.refresh(report)

    log_audit_event(
        db, current_user.id,
        "LAB_REPORT_SUBMITTED" if target_report_status == "AWAITING_VERIFICATION" else "LAB_REPORT_CREATED",
        f"Technician '{current_user.username}' submitted lab report for Sample {report.sample_id} ({report.test_name}) - Status: {target_report_status}"
    )

    parameters = [LabParameterSchema(**p.model_dump()) for p in data.parameters]
    return make_report_out(report, patient.name, parameters)


@router.get("/reports/{report_id}", response_model=LabReportOut)
def get_lab_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lab report details."""
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Lab report not found")

    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()

    if current_user.role == "patient":
        if not patient or not patient.user_id or patient.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if report.report_status != "VERIFIED":
            raise HTTPException(status_code=403, detail="Patient can only view finalized/verified laboratory reports")

    if current_user.role in ["receptionist", "pharmacist"]:
        raise HTTPException(status_code=403, detail="Role not authorized to view clinical lab report details")

    param_records = db.query(LabResultParameter).filter(LabResultParameter.report_id == report.id).all()
    parameters = [
        LabParameterSchema(
            parameter_name=p.parameter_name,
            result_value=p.result_value,
            unit=p.unit,
            reference_range=p.reference_range,
            flag=p.flag
        ) for p in param_records
    ]

    log_audit_event(
        db, current_user.id, "LAB_REPORT_VIEWED",
        f"User '{current_user.username}' ({current_user.role}) viewed lab report ID {report.id} (Sample: {report.sample_id})"
    )

    return make_report_out(report, patient.name if patient else "Unknown", parameters)


@router.get("/reports/patient/{patient_id}", response_model=List[LabReportOut])
def get_patient_lab_reports(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all lab reports for a patient."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == "patient":
        if not patient.user_id or patient.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role in ["receptionist", "pharmacist"]:
        raise HTTPException(status_code=403, detail="Not authorized to view clinical laboratory reports")

    query = db.query(LabReport).filter(LabReport.patient_id == patient_id)
    if current_user.role == "patient":
        query = query.filter(LabReport.report_status == "VERIFIED")

    reports = query.order_by(LabReport.created_at.desc()).all()

    result = []
    for r in reports:
        param_records = db.query(LabResultParameter).filter(LabResultParameter.report_id == r.id).all()
        parameters = [
            LabParameterSchema(
                parameter_name=p.parameter_name,
                result_value=p.result_value,
                unit=p.unit,
                reference_range=p.reference_range,
                flag=p.flag
            ) for p in param_records
        ]
        result.append(make_report_out(r, patient.name, parameters))

    return result


@router.post("/reports/{report_id}/verify", response_model=LabReportOut)
def verify_lab_report(
    report_id: int,
    data: LabReportVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor"))
):
    """
    Doctor reviews and Approves or Rejects the lab report.
    Upon APPROVAL:
    - Report status becomes VERIFIED (FINAL).
    - Lab Order status becomes COMPLETED.
    - Automatically appends a ClinicalRecord to the Patient Central EHR.
    """
    report = db.query(LabReport).filter(LabReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Lab report not found")

    order = db.query(LabTestOrder).filter(LabTestOrder.id == report.lab_order_id).first()
    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    doc_id = doc.id if doc else None
    doc_name = doc.name if doc else f"Dr. {current_user.username}"

    if data.approved:
        report.verification_status = "VERIFIED"
        report.report_status = "VERIFIED"
        report.verified_by_doctor_id = doc_id
        report.verified_by_doctor_name = doc_name
        report.verification_notes = data.verification_notes or "Results reviewed and verified."

        if order:
            order.status = "COMPLETED"

        ehr = ensure_ehr_exists(patient, db)
        param_records = db.query(LabResultParameter).filter(LabResultParameter.report_id == report.id).all()
        param_summary_lines = [f"• {p.parameter_name}: {p.result_value} {p.unit or ''} (Ref: {p.reference_range or 'N/A'}) [{p.flag}]" for p in param_records]
        param_text = "\n".join(param_summary_lines)

        critical_note = " ⚠️ CRITICAL RESULT HIGHLIGHTED." if report.has_critical_result else ""

        clinical_rec = ClinicalRecord(
            ehr_id=ehr.id,
            patient_id=patient.id,
            doctor_id=doc_id,
            doctor_name=doc_name,
            record_type="lab_report",
            title=f"{report.test_name} Laboratory Report",
            details=f"Laboratory report completed and clinically verified for {report.test_name} (Sample ID: {report.sample_id}).{critical_note}\n\nSummary: {report.result_summary or 'No summary provided.'}\n\nParameters:\n{param_text}\n\nDoctor Verification Notes: {report.verification_notes}",
            ai_compatible_payload=json.dumps({
                "lab_report_id": report.id,
                "sample_id": report.sample_id,
                "test_name": report.test_name,
                "test_category": report.test_category,
                "verification_status": "VERIFIED",
                "has_critical_result": report.has_critical_result
            })
        )
        db.add(clinical_rec)
        db.commit()

        log_audit_event(
            db, current_user.id, "LAB_REPORT_VERIFIED",
            f"Doctor '{doc_name}' verified lab report ID {report.id} (Sample: {report.sample_id})"
        )
        log_audit_event(
            db, current_user.id, "LAB_REPORT_FINALIZED",
            f"Lab report ID {report.id} finalized for patient {patient.name} ({patient.hospital_id})"
        )
        log_audit_event(
            db, current_user.id, "LAB_REPORT_LINKED_TO_EHR",
            f"Lab report ID {report.id} linked to EHR for patient {patient.name} (EHR ID: {ehr.id})"
        )
    else:
        report.verification_status = "REJECTED"
        report.report_status = "REJECTED"
        report.rejection_reason = data.rejection_reason or "Report rejected during doctor review."

        if order:
            order.status = "PROCESSING"

        log_audit_event(
            db, current_user.id, "LAB_REPORT_REJECTED",
            f"Doctor '{doc_name}' rejected lab report ID {report.id} (Sample: {report.sample_id}). Reason: {report.rejection_reason}"
        )

    db.commit()
    db.refresh(report)
    if order:
        db.refresh(order)

    param_records = db.query(LabResultParameter).filter(LabResultParameter.report_id == report.id).all()
    parameters = [
        LabParameterSchema(
            parameter_name=p.parameter_name,
            result_value=p.result_value,
            unit=p.unit,
            reference_range=p.reference_range,
            flag=p.flag
        ) for p in param_records
    ]

    return make_report_out(report, patient.name, parameters)
